import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  captureKnowledgeEvent,
  getKnowledgeItem,
  knowledgeStorePath,
  refreshKnowledgeStore,
} from "../knowledge-store.js";
import type { StudioEvent } from "../types.js";

describe("studio knowledge store", () => {
  it("indexes markdown and yaml context from the active repository", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-knowledge-store-"));
    try {
      await mkdir(join(root, "docs"), { recursive: true });
      await mkdir(join(root, "design"), { recursive: true });
      await mkdir(join(root, "research"), { recursive: true });

      await writeFile(join(root, "README.md"), "# Product OS\n\nA design intelligence repo.");
      await writeFile(join(root, "docs", "design-reference.md"), "# Design Reference\n\nUse tokens and source-backed decisions.");
      await writeFile(join(root, "design", "tokens.yaml"), "title: Token System\nkind: tokens\nsummary: YAML design token registry\n");
      await writeFile(join(root, "research", "AICP_BIDDING_RESEARCH.md"), "# AICP Bidding\n\nDo not index stale bids.");

      const index = await refreshKnowledgeStore(root);
      const titles = index.items.map((item) => item.title);
      const persisted = JSON.parse(await readFile(knowledgeStorePath(root), "utf-8"));

      expect(index.projectRoot).toBe(root);
      expect(index.counts.markdown).toBe(2);
      expect(index.counts.yaml).toBe(1);
      expect(titles).toEqual(expect.arrayContaining(["Product OS", "Design Reference", "Token System"]));
      expect(JSON.stringify(index).toLowerCase()).not.toMatch(/aicp|bidding|bids?/);
      expect(index.items.find((item) => item.title === "Token System")).toMatchObject({
        kind: "yaml",
        sourcePath: "design/tokens.yaml",
        tags: expect.arrayContaining(["yaml", "tokens"]),
      });
      expect(persisted.items.length).toBe(index.items.length);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("captures durable agent research and design decisions into the knowledge database", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-knowledge-capture-"));
    try {
      await refreshKnowledgeStore(root);
      const event = makeEvent("research_note", "Documented research synthesis", {
        title: "Screenwriter Notes Research",
        source: "codex",
        summary: "Writers need fast offline capture and keyboard-first review.",
        tags: ["research", "notes"],
      });

      const captured = await captureKnowledgeEvent(root, event, { harness: "codex", action: "raw" });
      const index = await refreshKnowledgeStore(root);
      const detail = await getKnowledgeItem(root, captured.id);

      expect(captured).toMatchObject({
        kind: "agent-capture",
        title: "Screenwriter Notes Research",
        eventId: event.id,
        sessionId: event.sessionId,
      });
      expect(index.items.map((item) => item.id)).toContain(captured.id);
      expect(detail?.content).toContain("Writers need fast offline capture");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

function makeEvent(type: StudioEvent["type"], message: string, data: Record<string, unknown>): StudioEvent {
  return {
    id: `${type}-event`,
    sessionId: "studio-knowledge-session",
    type,
    timestamp: "2026-05-05T00:00:00.000Z",
    message,
    data,
  };
}
