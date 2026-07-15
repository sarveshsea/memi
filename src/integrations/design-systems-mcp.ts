import { z } from "zod";

const SOURCE = "southleft/design-systems-mcp" as const;
const CATEGORY_MANIFEST_VERSION = "design-systems-mcp/category-manifest/v1" as const;
const MAX_CORPUS_FILES = 500;
const MAX_CONTENT_CHARACTERS = 1_000_000;
const MAX_CONTEXT_BYTES = 64_000;
const MIN_CONTEXT_BYTES = 256;

export const DESIGN_SYSTEMS_MCP_CATEGORIES = [
  "components",
  "tokens",
  "patterns",
  "workflows",
  "guidelines",
  "general",
  "glossary",
  "accessibility",
  "figma",
  "documentation",
  "workflow",
  "governance",
  "tools",
  "case-studies",
  "foundations",
] as const;

export type DesignSystemsMcpCategory = typeof DESIGN_SYSTEMS_MCP_CATEGORIES[number];
export type DesignSystemsMcpInteropErrorCode =
  | "INVALID_CORPUS_MANIFEST"
  | "INVALID_CATEGORY_MANIFEST"
  | "INVALID_CORPUS_ENTRY"
  | "CORPUS_ENTRY_MISMATCH"
  | "INVALID_OPTIONS";

export interface DesignSystemsMcpContextOptions {
  category?: DesignSystemsMcpCategory;
  maxBytes?: number;
  maxEntries?: number;
  summaryCharacters?: number;
}

export interface DesignSystemsMcpAgentContext {
  source: typeof SOURCE;
  scope: DesignSystemsMcpCategory | "all";
  context: string;
  totalEntries: number;
  matchedEntries: number;
  includedEntries: number;
  omittedEntries: number;
  bytes: number;
}

export class DesignSystemsMcpInteropError extends Error {
  readonly code: DesignSystemsMcpInteropErrorCode;
  readonly issues: string[];

  constructor(code: DesignSystemsMcpInteropErrorCode, message: string, issues: string[]) {
    super(`${message}: ${issues.join("; ")}`);
    this.name = "DesignSystemsMcpInteropError";
    this.code = code;
    this.issues = [...issues];
  }
}

const CategorySchema = z.enum(DESIGN_SYSTEMS_MCP_CATEGORIES);
const ConfidenceSchema = z.enum(["high", "medium", "low"]);
const IsoDateSchema = z.string().datetime({ offset: true });
const PlainJsonFilenameSchema = z.string()
  .min(1)
  .max(255)
  .refine(
    (filename) => /^[^/\\\0]+\.json$/i.test(filename) && filename !== ".json",
    "Expected a plain JSON filename without directories or traversal segments",
  );

export const DesignSystemsMcpCorpusManifestSchema = z.object({
  files: z.array(PlainJsonFilenameSchema).max(MAX_CORPUS_FILES),
  generated_at: IsoDateSchema.optional(),
  total_files: z.number().int().nonnegative().max(MAX_CORPUS_FILES),
}).strict().superRefine((manifest, ctx) => {
  if (manifest.total_files !== manifest.files.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["total_files"],
      message: `Expected total_files to match files length ${manifest.files.length}`,
    });
  }

  const duplicates = manifest.files.filter((filename, index) => manifest.files.indexOf(filename) !== index);
  if (duplicates.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["files"],
      message: `Duplicate filenames are not allowed: ${Array.from(new Set(duplicates)).sort().join(", ")}`,
    });
  }
});

const SourceSchema = z.object({
  type: z.enum(["pdf", "html", "url"]),
  location: z.string().min(1).max(2_048),
  ingested_at: IsoDateSchema,
});

const ChunkSchema = z.object({
  id: z.string().min(1).max(200),
  text: z.string().max(100_000),
  metadata: z.record(z.unknown()).optional(),
});

const MetadataSchema = z.object({
  category: CategorySchema,
  tags: z.array(z.string().min(1).max(80)).max(64),
  confidence: ConfidenceSchema,
  version: z.string().max(100).optional(),
  last_updated: IsoDateSchema,
  author: z.string().max(200).optional(),
  system: z.string().max(200).optional(),
});

export const DesignSystemsMcpEntrySchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(400),
  source: SourceSchema,
  content: z.string().max(MAX_CONTENT_CHARACTERS).optional(),
  summary: z.string().min(1).max(2_000).optional(),
  chunks: z.array(ChunkSchema).max(2_000).optional(),
  metadata: MetadataSchema,
}).superRefine((entry, ctx) => {
  if (entry.summary === undefined && entry.content === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["summary"],
      message: "Expected summary or content so the entry can produce agent context",
    });
  }
});

export const DesignSystemsMcpCategoryManifestSchema = z.object({
  schema_version: z.literal(CATEGORY_MANIFEST_VERSION),
  category: CategorySchema,
  generated_at: IsoDateSchema.optional(),
  total_entries: z.number().int().nonnegative().max(MAX_CORPUS_FILES),
  entries: z.array(DesignSystemsMcpEntrySchema).max(MAX_CORPUS_FILES),
}).strict().superRefine((manifest, ctx) => {
  if (manifest.total_entries !== manifest.entries.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["total_entries"],
      message: `Expected total_entries to match entries length ${manifest.entries.length}`,
    });
  }

  manifest.entries.forEach((entry, index) => {
    if (entry.metadata.category !== manifest.category) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entries", index, "metadata", "category"],
        message: `Expected entry category to match manifest category "${manifest.category}"`,
      });
    }
  });
});

type DesignSystemsMcpEntry = z.infer<typeof DesignSystemsMcpEntrySchema>;
type ContextOptions = Required<Pick<DesignSystemsMcpContextOptions, "maxBytes" | "maxEntries" | "summaryCharacters">> & {
  category?: DesignSystemsMcpCategory;
};

const ContextOptionsSchema = z.object({
  category: CategorySchema.optional(),
  maxBytes: z.number().int().min(MIN_CONTEXT_BYTES).max(MAX_CONTEXT_BYTES).default(6_000),
  maxEntries: z.number().int().min(1).max(50).default(12),
  summaryCharacters: z.number().int().min(40).max(1_000).default(240),
}).strict();

export function normalizeDesignSystemsMcpCorpus(
  input: { manifest: unknown; entries: unknown },
  options: DesignSystemsMcpContextOptions = {},
): DesignSystemsMcpAgentContext {
  const parsedOptions = parseOptions(options);
  const manifest = parseWithSchema(
    DesignSystemsMcpCorpusManifestSchema,
    input.manifest,
    "INVALID_CORPUS_MANIFEST",
    "Invalid design-systems-mcp corpus manifest",
  );
  const entryMap = assertEntryMap(input.entries);
  const missingFiles = manifest.files.filter((filename) => !Object.hasOwn(entryMap, filename));

  if (missingFiles.length > 0) {
    throw new DesignSystemsMcpInteropError(
      "CORPUS_ENTRY_MISMATCH",
      "The corpus does not satisfy its manifest",
      [`Missing entries for manifest files: ${missingFiles.join(", ")}`],
    );
  }

  const entries = manifest.files.map((filename) => parseWithSchema(
    DesignSystemsMcpEntrySchema,
    entryMap[filename],
    "INVALID_CORPUS_ENTRY",
    `Invalid design-systems-mcp corpus entry "${filename}"`,
  ));

  return buildAgentContext(entries, parsedOptions.category ?? "all", manifest.total_files, parsedOptions);
}

export function normalizeDesignSystemsMcpCategoryManifest(
  input: unknown,
  options: Omit<DesignSystemsMcpContextOptions, "category"> = {},
): DesignSystemsMcpAgentContext {
  const parsedOptions = parseOptions(options);
  const manifest = parseWithSchema(
    DesignSystemsMcpCategoryManifestSchema,
    input,
    "INVALID_CATEGORY_MANIFEST",
    "Invalid design-systems-mcp category manifest",
  );

  return buildAgentContext(manifest.entries, manifest.category, manifest.total_entries, parsedOptions);
}

function assertEntryMap(raw: unknown): Record<string, unknown> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new DesignSystemsMcpInteropError(
      "CORPUS_ENTRY_MISMATCH",
      "The corpus does not satisfy its manifest",
      ["entries: Expected a filename-keyed object"],
    );
  }
  return raw as Record<string, unknown>;
}

function parseOptions(raw: DesignSystemsMcpContextOptions): ContextOptions {
  const parsed = parseWithSchema(
    ContextOptionsSchema,
    raw,
    "INVALID_OPTIONS",
    "Invalid design-systems-mcp adapter options",
  );
  return {
    category: parsed.category,
    maxBytes: parsed.maxBytes ?? 6_000,
    maxEntries: parsed.maxEntries ?? 12,
    summaryCharacters: parsed.summaryCharacters ?? 240,
  };
}

function parseWithSchema<T>(
  schema: z.ZodType<T>,
  raw: unknown,
  code: DesignSystemsMcpInteropErrorCode,
  message: string,
): T {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;

  const issues = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "input";
    return `${path}: ${issue.message}`;
  });
  throw new DesignSystemsMcpInteropError(code, message, issues);
}

function buildAgentContext(
  entries: DesignSystemsMcpEntry[],
  scope: DesignSystemsMcpCategory | "all",
  totalEntries: number,
  options: ContextOptions,
): DesignSystemsMcpAgentContext {
  const matched = entries
    .filter((entry) => scope === "all" || entry.metadata.category === scope)
    .map((entry) => normalizeEntry(entry, options.summaryCharacters))
    .sort(compareEntries);
  const candidates = matched.slice(0, options.maxEntries);
  const lines: string[] = [];

  for (const candidate of candidates) {
    const nextCount = lines.length + 1;
    const header = contextHeader(scope, nextCount, matched.length, totalEntries);
    const prefix = lines.length === 0 ? `${header}\n` : `${header}\n${lines.join("\n")}\n`;
    const remainingBytes = options.maxBytes - Buffer.byteLength(prefix, "utf8");
    if (remainingBytes < 48) break;

    const line = truncateUtf8(formatEntry(candidate), remainingBytes);
    if (Buffer.byteLength(line, "utf8") < 48) break;
    lines.push(line);

    if (line.endsWith("...")) break;
  }

  const header = contextHeader(scope, lines.length, matched.length, totalEntries);
  const context = lines.length > 0 ? `${header}\n${lines.join("\n")}` : header;

  return {
    source: SOURCE,
    scope,
    context,
    totalEntries,
    matchedEntries: matched.length,
    includedEntries: lines.length,
    omittedEntries: matched.length - lines.length,
    bytes: Buffer.byteLength(context, "utf8"),
  };
}

interface NormalizedEntry {
  id: string;
  title: string;
  category: DesignSystemsMcpCategory;
  confidence: "high" | "medium" | "low";
  tags: string[];
  summary: string;
  source: string;
}

function normalizeEntry(entry: DesignSystemsMcpEntry, summaryCharacters: number): NormalizedEntry {
  const summary = normalizeText(entry.summary ?? entry.content ?? "");
  return {
    id: normalizeText(entry.id),
    title: normalizeText(entry.title),
    category: entry.metadata.category,
    confidence: entry.metadata.confidence,
    tags: Array.from(new Set(entry.metadata.tags.map(normalizeText).filter(Boolean))).sort().slice(0, 5),
    summary: truncateCharacters(summary, summaryCharacters),
    source: normalizeText(entry.source.location),
  };
}

function compareEntries(left: NormalizedEntry, right: NormalizedEntry): number {
  const confidenceRank = { high: 0, medium: 1, low: 2 } as const;
  return confidenceRank[left.confidence] - confidenceRank[right.confidence]
    || left.category.localeCompare(right.category)
    || left.title.localeCompare(right.title)
    || left.id.localeCompare(right.id);
}

function formatEntry(entry: NormalizedEntry): string {
  const tags = entry.tags.length > 0 ? entry.tags.join(",") : "none";
  return `- [${entry.confidence}] ${escapeField(entry.title)} | ${entry.category} | tags=${escapeField(tags)} | ${escapeField(entry.summary)} | source=${escapeField(entry.source)}`;
}

function contextHeader(
  scope: DesignSystemsMcpCategory | "all",
  included: number,
  matched: number,
  total: number,
): string {
  return `design-systems-mcp agent context (read-only)\nscope=${scope} included=${included} matched=${matched} total=${total} omitted=${matched - included}`;
}

function normalizeText(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
}

function escapeField(value: string): string {
  return value.replaceAll("|", "/");
}

function truncateCharacters(value: string, maxCharacters: number): string {
  const characters = Array.from(value);
  if (characters.length <= maxCharacters) return value;
  return `${characters.slice(0, Math.max(0, maxCharacters - 3)).join("")}...`;
}

function truncateUtf8(value: string, maxBytes: number): string {
  if (Buffer.byteLength(value, "utf8") <= maxBytes) return value;
  if (maxBytes <= 3) return ".".repeat(Math.max(0, maxBytes));

  const budget = maxBytes - 3;
  const output: string[] = [];
  let bytes = 0;
  for (const character of value) {
    const characterBytes = Buffer.byteLength(character, "utf8");
    if (bytes + characterBytes > budget) break;
    output.push(character);
    bytes += characterBytes;
  }
  return `${output.join("")}...`;
}
