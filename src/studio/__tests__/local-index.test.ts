import { describe, expect, it } from "vitest";
import { STUDIO_LOCAL_INDEX_SCHEMA, STUDIO_LOCAL_INDEX_TABLES } from "../local-index.js";

describe("studio local index contract", () => {
  it("defines the local-first SQLite/FTS tables for sessions, outputs, research, and marketplace installs", () => {
    expect(STUDIO_LOCAL_INDEX_TABLES).toEqual([
      "sessions",
      "events",
      "references",
      "outputs",
      "tool_runs",
      "citations",
      "research_sources",
      "research_highlights",
      "research_tags",
      "marketplace_installs",
    ]);
    expect(STUDIO_LOCAL_INDEX_SCHEMA).toContain("CREATE VIRTUAL TABLE IF NOT EXISTS studio_fts USING fts5");
    expect(STUDIO_LOCAL_INDEX_SCHEMA).toContain("chat_mode TEXT NOT NULL");
    expect(STUDIO_LOCAL_INDEX_SCHEMA).toContain("permission_mode TEXT NOT NULL");
    expect(STUDIO_LOCAL_INDEX_SCHEMA).toContain("logo_path TEXT");
  });
});
