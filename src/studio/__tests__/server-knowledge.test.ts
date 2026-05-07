import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { StudioRuntimeServer } from "../server.js";

const servers: StudioRuntimeServer[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.stop()));
});

describe("studio knowledge runtime APIs", () => {
  it("serves, refreshes, reads, and captures knowledge items", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-studio-knowledge-api-"));
    try {
      await mkdir(join(root, "docs"), { recursive: true });
      await writeFile(join(root, "docs", "agent-design.md"), "# Agent Design\n\nMarkdown context for design agents.");

      const server = new StudioRuntimeServer({ projectRoot: root, port: 0 });
      servers.push(server);
      const runtime = await server.start();

      const listed = await fetch(`${runtime.url}/api/knowledge`).then((res) => res.json());
      const refreshed = await fetch(`${runtime.url}/api/knowledge/refresh`, { method: "POST" }).then((res) => res.json());
      const markdownId = listed.items.find((item: { kind: string }) => item.kind === "markdown").id;
      const detail = await fetch(`${runtime.url}/api/knowledge/${encodeURIComponent(markdownId)}`).then((res) => res.json());
      const captured = await fetch(`${runtime.url}/api/knowledge/capture`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event: {
            id: "decision-1",
            sessionId: "studio-session-1",
            type: "design_decision",
            timestamp: "2026-05-05T00:00:00.000Z",
            message: "Use markdown-backed source cards.",
            data: { title: "Source Cards", tags: ["decision"] },
          },
          session: { harness: "claude-code", action: "raw" },
        }),
      }).then((res) => res.json());

      expect(listed.counts.markdown).toBe(1);
      expect(refreshed.counts.markdown).toBe(1);
      expect(detail.item).toMatchObject({ title: "Agent Design", contentType: "text/markdown" });
      expect(captured.item).toMatchObject({ kind: "agent-capture", title: "Source Cards" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("serves a compact knowledge index without heavy item content", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-studio-knowledge-compact-"));
    try {
      await mkdir(join(root, "docs"), { recursive: true });
      await mkdir(join(root, "apps", "studio", "src-tauri", "gen", "schemas"), { recursive: true });
      await writeFile(join(root, "docs", "agent-design.md"), `# Agent Design\n\n${"Markdown context. ".repeat(200)}`);
      await writeFile(join(root, "docs", "tokens.json"), JSON.stringify({
        name: "Token payload",
        description: "JSON source for compact payload tests.",
        nested: { content: "large parsed document".repeat(100) },
      }, null, 2));
      await writeFile(join(root, "apps", "studio", "src-tauri", "gen", "schemas", "desktop-schema.json"), JSON.stringify({
        name: "Generated Tauri schema",
      }, null, 2));

      const server = new StudioRuntimeServer({ projectRoot: root, port: 0 });
      servers.push(server);
      const runtime = await server.start();

      const compact = await fetch(`${runtime.url}/api/knowledge?detail=compact`).then((res) => res.json());
      const full = await fetch(`${runtime.url}/api/knowledge`).then((res) => res.json());
      const markdown = compact.items.find((item: { kind: string }) => item.kind === "markdown");
      const json = compact.items.find((item: { sourcePath: string }) => item.sourcePath === "docs/tokens.json");
      const fullJson = full.items.find((item: { sourcePath: string }) => item.sourcePath === "docs/tokens.json");

      expect(compact.items.map((item: { sourcePath: string }) => item.sourcePath)).not.toContain("apps/studio/src-tauri/gen/schemas/desktop-schema.json");
      expect(markdown.content).toBe("");
      expect(json.content).toBe("");
      expect(json.data.document).toBeUndefined();
      expect(fullJson.content).toContain("Token payload");
      expect(fullJson.data.document).toMatchObject({ name: "Token payload" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
