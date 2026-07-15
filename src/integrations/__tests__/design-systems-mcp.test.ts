import { describe, expect, it, vi } from "vitest";
import {
  DesignSystemsMcpInteropError,
  normalizeDesignSystemsMcpCategoryManifest,
  normalizeDesignSystemsMcpCorpus,
} from "../design-systems-mcp.js";

const CORPUS_MANIFEST = {
  files: ["patterns.json", "tokens.json", "workflow.json"],
  generated_at: "2026-07-09T17:15:49.000Z",
  total_files: 3,
};

const CORPUS_ENTRIES = {
  "patterns.json": entry({
    id: "patterns",
    title: "Component Composition Patterns",
    category: "patterns",
    confidence: "medium",
    tags: ["composition", "components"],
    content: "  Prefer clear component boundaries.\n\nCompose primitives into focused patterns.  ",
  }),
  "tokens.json": entry({
    id: "tokens",
    title: "Design Tokens Format Module",
    category: "tokens",
    confidence: "high",
    tags: ["dtcg", "tokens", "format", "dtcg"],
    content: "Use typed, portable token values and preserve aliases between token groups.",
  }),
  "workflow.json": entry({
    id: "workflow",
    title: "Design System Contribution Workflow",
    category: "workflows",
    confidence: "low",
    tags: ["governance", "review"],
    content: "Review proposed changes with design and engineering owners before release.",
  }),
};

describe("design-systems-mcp corpus adapter", () => {
  it("normalizes the native corpus manifest without network access or input mutation", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const before = structuredClone(CORPUS_ENTRIES);

    const result = normalizeDesignSystemsMcpCorpus({
      manifest: CORPUS_MANIFEST,
      entries: CORPUS_ENTRIES,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(CORPUS_ENTRIES).toEqual(before);
    expect(result).toMatchObject({
      source: "southleft/design-systems-mcp",
      scope: "all",
      totalEntries: 3,
      matchedEntries: 3,
      includedEntries: 3,
      omittedEntries: 0,
      bytes: expect.any(Number),
    });
    expect(result.context).toContain("scope=all included=3 matched=3 total=3 omitted=0");
    expect(result.context).toContain("[high] Design Tokens Format Module | tokens");
    expect(result.context).toContain("tags=dtcg,format,tokens");
    expect(result.context).not.toContain("\n\n");
    expect(result.bytes).toBe(Buffer.byteLength(result.context, "utf8"));

    fetchSpy.mockRestore();
  });

  it("filters before sorting and emits deterministic high-confidence-first context", () => {
    const input = {
      manifest: CORPUS_MANIFEST,
      entries: {
        "workflow.json": CORPUS_ENTRIES["workflow.json"],
        "tokens.json": CORPUS_ENTRIES["tokens.json"],
        "patterns.json": CORPUS_ENTRIES["patterns.json"],
      },
    };

    const first = normalizeDesignSystemsMcpCorpus(input, { maxEntries: 2 });
    const second = normalizeDesignSystemsMcpCorpus(input, { maxEntries: 2 });
    const filtered = normalizeDesignSystemsMcpCorpus(input, { category: "tokens" });

    expect(first).toEqual(second);
    expect(first.context.indexOf("[high]")).toBeLessThan(first.context.indexOf("[medium]"));
    expect(first).toMatchObject({ includedEntries: 2, omittedEntries: 1 });
    expect(filtered).toMatchObject({
      scope: "tokens",
      totalEntries: 3,
      matchedEntries: 1,
      includedEntries: 1,
      omittedEntries: 0,
    });
    expect(filtered.context).not.toContain("Contribution Workflow");
  });

  it("fails with actionable manifest and corpus mismatch errors", () => {
    expect(() => normalizeDesignSystemsMcpCorpus({
      manifest: { ...CORPUS_MANIFEST, total_files: 2 },
      entries: CORPUS_ENTRIES,
    })).toThrowError(expect.objectContaining({
      name: "DesignSystemsMcpInteropError",
      code: "INVALID_CORPUS_MANIFEST",
      issues: expect.arrayContaining([expect.stringMatching(/total_files.*files length/i)]),
    }));

    expect(() => normalizeDesignSystemsMcpCorpus({
      manifest: { files: ["../tokens.json"], total_files: 1 },
      entries: { "../tokens.json": CORPUS_ENTRIES["tokens.json"] },
    })).toThrow(/files\.0.*plain JSON filename/i);

    expect(() => normalizeDesignSystemsMcpCorpus({
      manifest: CORPUS_MANIFEST,
      entries: { "tokens.json": CORPUS_ENTRIES["tokens.json"] },
    })).toThrowError(expect.objectContaining({
      code: "CORPUS_ENTRY_MISMATCH",
      issues: expect.arrayContaining(["Missing entries for manifest files: patterns.json, workflow.json"]),
    }));
  });
});

describe("design-systems-mcp category adapter", () => {
  it("accepts the proposed category manifest and prefers its compact summary", () => {
    const manifest = {
      schema_version: "design-systems-mcp/category-manifest/v1",
      category: "accessibility",
      generated_at: "2026-07-09T17:15:49.000Z",
      total_entries: 1,
      entries: [{
        ...entry({
          id: "wcag",
          title: "WCAG Focus Appearance",
          category: "accessibility",
          confidence: "high",
          tags: ["wcag", "focus"],
          content: "This full body should not be selected when a summary is available.",
        }),
        summary: "Interactive controls need a visible keyboard focus indicator.",
      }],
    };

    const result = normalizeDesignSystemsMcpCategoryManifest(manifest);

    expect(result).toMatchObject({
      scope: "accessibility",
      totalEntries: 1,
      matchedEntries: 1,
      includedEntries: 1,
      omittedEntries: 0,
    });
    expect(result.context).toContain("visible keyboard focus indicator");
    expect(result.context).not.toContain("full body");
  });

  it("enforces category consistency and a UTF-8 byte budget", () => {
    expect(() => normalizeDesignSystemsMcpCategoryManifest({
      schema_version: "design-systems-mcp/category-manifest/v1",
      category: "tokens",
      total_entries: 1,
      entries: [CORPUS_ENTRIES["patterns.json"]],
    })).toThrowError(expect.objectContaining({
      code: "INVALID_CATEGORY_MANIFEST",
      issues: expect.arrayContaining([expect.stringMatching(/entries\.0.*category.*tokens/i)]),
    }));

    const longManifest = {
      schema_version: "design-systems-mcp/category-manifest/v1",
      category: "tokens",
      total_entries: 2,
      entries: [
        entry({
          id: "unicode-a",
          title: "Portable Token Guidance",
          category: "tokens",
          confidence: "high",
          tags: ["tokens"],
          content: `Use portable token aliases ${"e".repeat(800)}.`,
        }),
        entry({
          id: "unicode-b",
          title: "Token Naming Guidance",
          category: "tokens",
          confidence: "medium",
          tags: ["naming"],
          content: `Keep names semantic ${"n".repeat(800)}.`,
        }),
      ],
    };
    const result = normalizeDesignSystemsMcpCategoryManifest(longManifest, {
      maxBytes: 420,
      summaryCharacters: 300,
    });

    expect(result.bytes).toBeLessThanOrEqual(420);
    expect(result.bytes).toBe(Buffer.byteLength(result.context, "utf8"));
    expect(result.includedEntries).toBeGreaterThan(0);
    expect(result.omittedEntries).toBe(result.matchedEntries - result.includedEntries);
    expect(result.context.endsWith("\ufffd")).toBe(false);
    expect(result.bytes).toBeLessThan(Buffer.byteLength(JSON.stringify(longManifest), "utf8") / 4);
  });

  it("surfaces invalid options as adapter errors", () => {
    expect(() => normalizeDesignSystemsMcpCategoryManifest({
      schema_version: "design-systems-mcp/category-manifest/v1",
      category: "tokens",
      total_entries: 1,
      entries: [CORPUS_ENTRIES["tokens.json"]],
    }, { maxBytes: 40 })).toThrowError(DesignSystemsMcpInteropError);
  });
});

function entry(input: {
  id: string;
  title: string;
  category: string;
  confidence: string;
  tags: string[];
  content: string;
}) {
  return {
    id: input.id,
    title: input.title,
    source: {
      type: "url",
      location: `https://example.com/${input.id}`,
      ingested_at: "2026-07-09T17:15:49.000Z",
    },
    content: input.content,
    chunks: [],
    metadata: {
      category: input.category,
      tags: input.tags,
      confidence: input.confidence,
      last_updated: "2026-07-09T17:15:49.000Z",
    },
  };
}
