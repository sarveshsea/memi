import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NoteManifestSchema } from "../types.js";

const root = process.cwd();

const AGENT_MARKETPLACE_NOTES = [
  "hermes-agent-bridge",
  "openclaw-agent-bridge",
  "agent-messaging-gateway",
  "multi-agent-kanban",
  "agent-skill-migration",
  "mcp-server-studio",
  "approval-sandbox-policies",
  "model-router-diagnostics",
  "agent-memory-profiles",
  "cron-agent-workflows",
  "agent-session-checkpoints",
  "apple-desktop-automation",
  "browser-research-agent",
  "gateway-ops-observability",
  "secure-secrets-for-agents",
];

describe("agent Notes marketplace pack", () => {
  it("ships the 15 Hermes/OpenClaw-comparable agent Notes with freshness metadata", async () => {
    for (const name of AGENT_MARKETPLACE_NOTES) {
      const noteDir = join(root, "notes", name);
      const manifest = NoteManifestSchema.parse(JSON.parse(await readFile(join(noteDir, "note.json"), "utf8")));
      const markdown = await readFile(join(noteDir, `${name}.md`), "utf8");

      expect(manifest.name).toBe(name);
      expect(manifest.version).toMatch(/^0\.1\.0$/);
      expect(manifest.category).toMatch(/^(connect|generate|research|craft)$/);
      expect(manifest.sourceUrls.length).toBeGreaterThanOrEqual(2);
      expect(manifest.lastResearchedAt).toBe("2026-05-07T00:00:00.000Z");
      expect(manifest.freshnessDays).toBeGreaterThanOrEqual(30);
      expect(manifest.skills).toHaveLength(1);
      expect(manifest.skills[0].file).toBe(`${name}.md`);
      expect(markdown).toContain("## When to Use");
      expect(markdown).toContain("## Workflow");
      expect(markdown).toContain("## Sources");
    }
  });

  it("includes the agent Notes in the generated Notes catalog and archives", async () => {
    const catalogPath = join(root, "examples", "site-bundle", "notes", "catalog.v1.json");
    const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
    const names = new Set(catalog.notes.map((entry: { name: string }) => entry.name));

    for (const name of AGENT_MARKETPLACE_NOTES) {
      expect(names.has(name)).toBe(true);
      expect(existsSync(join(root, "examples", "site-bundle", "notes", name, `${name}-0.1.0.tgz`))).toBe(true);
    }
  });
});
