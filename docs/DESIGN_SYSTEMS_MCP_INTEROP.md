# Design Systems MCP Interoperability

## Scope

Memi includes a bounded, read-only adapter for the public corpus format used by
[`southleft/design-systems-mcp`](https://github.com/southleft/design-systems-mcp).
The adapter validates caller-supplied JSON objects and converts approved entry
metadata into compact agent context. It does not fetch URLs, read files, write
files, call an MCP server, or execute corpus content.

Implementation: `src/integrations/design-systems-mcp.ts`

MCP clients can call `design_systems_context` with JSON strings instead of
importing TypeScript. The tool exposes both formats below, applies the same
validation and byte limits, and remains read-only.

## Supported inputs

### Native corpus manifest

The upstream repository currently generates `content/manifest.json` with this
shape:

```json
{
  "files": ["entry-a.json", "entry-b.json"],
  "generated_at": "2026-07-09T17:15:49.000Z",
  "total_files": 2
}
```

The caller supplies that manifest and a filename-keyed map of already-loaded
entry objects. Filenames must be plain `.json` names, counts must agree, and
every declared file must have an entry. Extra map keys are ignored.

```ts
import { normalizeDesignSystemsMcpCorpus } from "./src/integrations/design-systems-mcp.js";

const result = normalizeDesignSystemsMcpCorpus(
  { manifest, entries: entriesByFilename },
  { category: "tokens", maxEntries: 8, maxBytes: 4_000 },
);

agentPrompt += `\n\n${result.context}`;
```

Each entry follows the upstream `ContentEntry` fields used by Memi: `id`,
`title`, `source`, `content` or `summary`, and `metadata`. `chunks` may be
present but is validated and then omitted from agent context.

### Category manifest v1

The adapter also accepts the proposed compact category envelope:

```json
{
  "schema_version": "design-systems-mcp/category-manifest/v1",
  "category": "tokens",
  "generated_at": "2026-07-09T17:15:49.000Z",
  "total_entries": 1,
  "entries": [
    {
      "id": "dtcg-format",
      "title": "Design Tokens Format Module",
      "summary": "Portable token syntax, types, aliases, and group behavior.",
      "source": {
        "type": "url",
        "location": "https://tr.designtokens.org/format/",
        "ingested_at": "2026-07-09T17:15:49.000Z"
      },
      "metadata": {
        "category": "tokens",
        "tags": ["dtcg", "format", "tokens"],
        "confidence": "high",
        "last_updated": "2026-07-09T17:15:49.000Z"
      }
    }
  ]
}
```

Use `normalizeDesignSystemsMcpCategoryManifest(manifest, options)` for this
shape. Every entry category must match the envelope category.

## Output contract

Both functions return:

```ts
interface DesignSystemsMcpAgentContext {
  source: "southleft/design-systems-mcp";
  scope: DesignSystemsMcpCategory | "all";
  context: string;
  totalEntries: number;
  matchedEntries: number;
  includedEntries: number;
  omittedEntries: number;
  bytes: number;
}
```

Compact output is deterministic:

1. Category filtering happens before limits.
2. Entries sort by confidence (`high`, `medium`, `low`), category, title, then ID.
3. Tags are deduplicated, sorted, and limited to five.
4. Summaries collapse whitespace and control characters; `summary` takes
   precedence over full `content`.
5. Fields are single-line and pipe characters are escaped.
6. `maxEntries`, `summaryCharacters`, and exact UTF-8 `maxBytes` limits apply.

Defaults are 12 entries, 240 summary characters, and 6,000 bytes. The adapter
accepts at most 500 corpus entries, 50 emitted entries, 1,000 summary
characters per emitted entry, and 64,000 output bytes. These limits are
deliberate context and memory boundaries, not pagination behavior.

## Errors

Validation failures throw `DesignSystemsMcpInteropError`. The error includes a
stable `code`, a human-readable message, and path-qualified `issues` that can be
shown directly in CLI diagnostics.

| Code | Corrective action |
| --- | --- |
| `INVALID_CORPUS_MANIFEST` | Fix filenames, duplicates, dates, bounds, or `total_files`. |
| `CORPUS_ENTRY_MISMATCH` | Load every file declared by the corpus manifest. |
| `INVALID_CORPUS_ENTRY` | Fix the named entry and its path-qualified fields. |
| `INVALID_CATEGORY_MANIFEST` | Fix schema version, count, entry fields, or category consistency. |
| `INVALID_OPTIONS` | Use supported categories and documented numeric bounds. |

Corpus text remains untrusted reference material. Consumers should place the
returned block in a clearly delimited context section and must not interpret
entry text as tool instructions.

## Upstream proposal

No external issue or pull request has been submitted. A concrete, non-breaking
proposal for `southleft/design-systems-mcp` is:

1. Add an optional `format` argument to `browse_by_category` with values `text`
   and `manifest-v1`. Keep `text` as the default, preserving all current clients.
2. For `manifest-v1`, return the category envelope shown above as JSON in the
   MCP text result. Set `schema_version` exactly to
   `design-systems-mcp/category-manifest/v1`.
3. Emit `summary` instead of `content` and omit `chunks`, embeddings, and
   ingestion-only metadata. Normalize summary whitespace and cap each summary
   at 600 Unicode characters.
4. Preserve source attribution through `source.type`, `source.location`, and
   `source.ingested_at`. Preserve category, tags, confidence, and
   `last_updated` under `metadata`.
5. Set `total_entries` to the exact emitted entry count and sort entries by
   confidence, title, then ID before serialization.
6. Generate the response from the same validated `ContentEntry[]` used by the
   existing category browser. Add an upstream fixture and contract test that
   checks schema version, count consistency, category consistency, stable
   ordering, and a response byte ceiling.

This proposal gives Memi and other MCP clients a stable read-only interchange
format without coupling consumers to Supabase, vector search, Cloudflare
transport details, or the repository's internal chunk representation.

## Upstream references

- [Current corpus manifest generator](https://github.com/southleft/design-systems-mcp/blob/893b73fc46abe1ee87258896c58caf144c9c9796/scripts/build/generate-manifest.ts)
- [Current content types](https://github.com/southleft/design-systems-mcp/blob/893b73fc46abe1ee87258896c58caf144c9c9796/types/content.ts)
- [Current category tool documentation](https://github.com/southleft/design-systems-mcp/tree/893b73fc46abe1ee87258896c58caf144c9c9796#browse_by_category)
