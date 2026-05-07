import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  analyzeMarkdownForFigJam,
  getMarkdownCorpusStatus,
  setupMarkdownCorpus,
} from "../markdown-corpus.js";

let root: string;

beforeEach(async () => {
  root = join(tmpdir(), `memoire-markdown-corpus-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(root, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("markdown corpus integration", () => {
  it("analyzes markdown deeply enough for FigJam candidates", async () => {
    const file = join(root, "checkout.md");
    await writeFile(file, `---
title: Checkout Flow
---

# Checkout

| Step | Owner |
| --- | --- |
| Pay | User |

- Open cart
- Enter payment
- Confirm

\`\`\`mermaid
sequenceDiagram
  User->>App: Pay
\`\`\`
`, "utf-8");

    const report = await analyzeMarkdownForFigJam({ projectRoot: root, sourcePath: file });

    expect(report.candidates.map((candidate) => candidate.kind)).toContain("sequence");
    expect(report.candidates.map((candidate) => candidate.kind)).toContain("checklist-to-flow");
    expect(report.candidates[0]).toMatchObject({
      title: "Checkout Flow",
      confidence: expect.any(Number),
      diagnostics: expect.any(Array),
    });
    expect(report.summary.tables).toBe(1);
    expect(report.summary.frontmatter).toBe(true);
  });

  it("sets up and reads a deterministic markdown-only corpus from fixture sources", async () => {
    const fixture = join(root, "fixture");
    await mkdir(join(fixture, "docs"), { recursive: true });
    await writeFile(join(fixture, "README.md"), "# Fixture\n\n- One\n- Two\n", "utf-8");
    await writeFile(join(fixture, "docs", "guide.mdx"), "```mermaid\nflowchart TD\n  A --> B\n```\n", "utf-8");
    await writeFile(join(fixture, "docs", "skip.ts"), "export {}\n", "utf-8");

    const status = await setupMarkdownCorpus({
      projectRoot: root,
      catalog: [
        { owner: "fixture", repo: "docs", license: "MIT", branch: "main", policy: "download", localSource: fixture },
        { owner: "blocked", repo: "agpl", license: "AGPL-3.0", branch: "main", policy: "metadata-only" },
      ],
    });
    const reread = await getMarkdownCorpusStatus(root);

    expect(status.status).toBe("ready");
    expect(reread.repos).toHaveLength(2);
    expect(reread.repos[0]).toMatchObject({ repo: "fixture/docs", files: 2, skipped: 1 });
    expect(reread.repos[1]).toMatchObject({ repo: "blocked/agpl", files: 0, skipped: 1 });
  });
});
