import { execFile } from "node:child_process";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { collectDesignSystemTrace } from "../design-system-trace.js";

const execFileAsync = promisify(execFile);

describe("studio design-system trace", () => {
  it("summarizes git-backed design-system changes for review", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-design-trace-"));
    try {
      await git(root, ["init"]);
      await git(root, ["config", "user.email", "studio@example.com"]);
      await git(root, ["config", "user.name", "Studio"]);
      await mkdir(join(root, "apps", "studio", "src"), { recursive: true });
      await mkdir(join(root, "src", "studio"), { recursive: true });
      await writeFile(join(root, "apps", "studio", "src", "styles.css"), ":root {}\n");
      await writeFile(join(root, "src", "studio", "server.ts"), "export const ok = true;\n");
      await git(root, ["add", "."]);
      await git(root, ["commit", "-m", "initial"]);

      await writeFile(join(root, "apps", "studio", "src", "styles.css"), ":root {}\n.button {}\n");
      await writeFile(join(root, "src", "studio", "server.ts"), "export const ok = true;\nexport const trace = true;\n");
      await writeFile(join(root, "README.md"), "notes\n");

      const trace = await collectDesignSystemTrace(root);

      expect(trace.status).toBe("changed");
      expect(trace.filesChanged).toBe(3);
      expect(trace.insertions).toBeGreaterThanOrEqual(2);
      expect(trace.reviewLabel).toContain("files changed");
      expect(trace.designSystemFiles.map((file) => file.path)).toEqual(expect.arrayContaining([
        "apps/studio/src/styles.css",
        "src/studio/server.ts",
      ]));
      expect(trace.designSystemFiles.find((file) => file.path.endsWith("styles.css"))).toMatchObject({
        kind: "style",
        designSystem: true,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

async function git(root: string, args: string[]): Promise<void> {
  await execFileAsync("git", ["-C", root, ...args]);
}
