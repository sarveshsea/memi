import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";
import type { DesignChangelogEntry, ProjectMemoryIndex, ProjectMemoryItem, ProjectMemoryKind } from "./types.js";

const KIND_ORDER: ProjectMemoryKind[] = ["home", "research", "spec", "system", "monitor", "changelog"];
const MEMORY_SOURCE_EXTENSIONS = new Set([".md", ".mdx", ".json", ".html", ".yaml", ".yml"]);
const STALE_MEMORY_PATTERN = /\b(dibs|aicp|bidding|bids?|bid)\b/i;
const EXCLUDED_PREVIEW_PATHS = [
  /(^|\/)preview\/generated\//,
  /(^|\/)preview\/standalone\//,
  /(^|\/)preview\/changelog\.html$/,
];

export function projectMemoryDir(projectRoot: string): string {
  return join(resolve(projectRoot), ".memoire", "project-memory");
}

export function projectMemoryIndexPath(projectRoot: string): string {
  return join(projectMemoryDir(projectRoot), "index.json");
}

export async function refreshProjectMemory(projectRoot: string): Promise<ProjectMemoryIndex> {
  const index = await indexProjectMemory(projectRoot);
  await mkdir(projectMemoryDir(projectRoot), { recursive: true });
  await writeFile(projectMemoryIndexPath(projectRoot), `${JSON.stringify(index, null, 2)}\n`, "utf-8");
  return index;
}

export async function indexProjectMemory(projectRoot: string): Promise<ProjectMemoryIndex> {
  const root = resolve(projectRoot);
  const items: ProjectMemoryItem[] = [homeItem(root)];

  items.push(...await indexResearch(root));
  items.push(...await indexSpecs(root));
  items.push(...await indexSystems(root));
  items.push(...await indexMonitor(root));
  items.push(...await indexChangelog(root));

  items.sort((a, b) => {
    const kindDelta = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
    if (kindDelta !== 0) return kindDelta;
    return `${a.title}:${a.sourcePath}`.localeCompare(`${b.title}:${b.sourcePath}`);
  });

  const counts = KIND_ORDER.reduce((acc, kind) => {
    acc[kind] = items.filter((item) => item.kind === kind).length;
    return acc;
  }, {} as Record<ProjectMemoryKind, number>);

  return {
    schemaVersion: 1,
    projectRoot: root,
    generatedAt: new Date().toISOString(),
    counts,
    items,
  };
}

async function indexResearch(root: string): Promise<ProjectMemoryItem[]> {
  const files = await walkFiles(join(root, "research"));
  return compactItems(await Promise.all(files
    .filter((file) => MEMORY_SOURCE_EXTENSIONS.has(extname(file)))
    .map(async (file) => {
      const metadata = await fileMetadata(root, file);
      const content = await readText(file);
      const json = extname(file) === ".json" ? parseJSON(content) : null;
      const title = pickString(json, ["title", "name"]) ?? markdownTitle(content) ?? titleFromFile(file);
      if (isStaleMemorySource(root, file, content, title)) return null;
      return memoryItem({
        kind: "research",
        root,
        file,
        title,
        summary: pickString(json, ["summary", "description"]) ?? firstText(content) ?? "Research source indexed from the workspace.",
        status: pickString(json, ["status"]) ?? "indexed",
        tags: normalizeTags(json?.tags, ["research"]),
        data: { ...metadata, ...(json && typeof json === "object" ? { document: json } : {}) },
      });
    })));
}

async function indexSpecs(root: string): Promise<ProjectMemoryItem[]> {
  const files = await walkFiles(join(root, "specs"));
  return compactItems(await Promise.all(files
    .filter((file) => extname(file) === ".json")
    .map(async (file) => {
      const metadata = await fileMetadata(root, file);
      const content = await readText(file);
      const json = parseJSON(content);
      const atomicLevel = pickString(json, ["level", "atomicLevel"]);
      const type = pickString(json, ["type", "kind"]);
      const title = pickString(json, ["name", "title", "id"]) ?? titleFromFile(file);
      if (isStaleMemorySource(root, file, content, title)) return null;
      return memoryItem({
        kind: "spec",
        root,
        file,
        title,
        summary: pickString(json, ["summary", "description", "purpose"]) ?? "Structured Mémoire spec.",
        status: atomicLevel ?? type ?? "spec",
        tags: normalizeTags(json?.tags, [type, atomicLevel].filter(Boolean) as string[]),
        data: { ...metadata, spec: json },
      });
    })));
}

async function indexSystems(root: string): Promise<ProjectMemoryItem[]> {
  const items: ProjectMemoryItem[] = [];
  const dashboardPath = join(root, ".memoire", "dashboard", "data.json");
  const dashboard = await readJSONFile(dashboardPath);
  if (dashboard) {
    const counts = dashboardCounts(dashboard);
    items.push(memoryItem({
      kind: "system",
      root,
      file: dashboardPath,
      title: "Dashboard Data",
      summary: `${counts.tokens} tokens, ${counts.components} components, ${counts.layouts} layouts indexed from dashboard state.`,
      status: "dashboard",
      tags: ["tokens", "components", "dashboard"],
      data: { counts, dashboard },
    }));
  }

  const previewFiles = await walkFiles(join(root, "preview"));
  for (const file of previewFiles.filter((item) => extname(item) === ".html" && !isExcludedPreviewPath(root, item))) {
    const metadata = await fileMetadata(root, file);
    const content = await readText(file);
    if (isStaleMemorySource(root, file, content, titleFromFile(file))) continue;
    items.push(memoryItem({
      kind: "system",
      root,
      file,
      title: titleFromFile(file),
      summary: "Preview artifact available from the Mémoire local preview surface.",
      status: "preview",
      tags: ["preview", "system"],
      links: [{ label: "Preview file", href: String(metadata.sourcePath) }],
      data: metadata,
    }));
  }

  return items;
}

async function indexMonitor(root: string): Promise<ProjectMemoryItem[]> {
  const indexPath = join(root, ".memoire", "studio", "session-index.json");
  const sessionIndex = await readJSONFile(indexPath);
  if (!sessionIndex) return [];
  const sessions = Array.isArray(sessionIndex.sessions) ? sessionIndex.sessions : [];
  return [memoryItem({
    kind: "monitor",
    root,
    file: indexPath,
    title: "Studio Sessions",
    summary: `${sessions.length} indexed Studio session${sessions.length === 1 ? "" : "s"}.`,
    status: sessions.some((session) => session?.status === "running") ? "running" : "indexed",
    tags: ["sessions", "monitor"],
    data: { sessionIndex },
  })];
}

async function indexChangelog(root: string): Promise<ProjectMemoryItem[]> {
  const localItems = await indexLocalDesignChangelog(root);
  const file = join(root, "CHANGELOG.md");
  const content = await readText(file);
  if (!content || isStaleMemorySource(root, file, content, "Changelog")) return localItems;
  return [...localItems, memoryItem({
    kind: "changelog",
    root,
    file,
    title: "Changelog",
    summary: markdownTitle(content) ?? firstText(content) ?? "Project changelog.",
    status: "release-notes",
    tags: ["release-notes", "decisions"],
    data: { excerpt: content.slice(0, 2400) },
  })];
}

async function indexLocalDesignChangelog(root: string): Promise<ProjectMemoryItem[]> {
  const dir = join(projectMemoryDir(root), "changelog");
  const files = await walkFiles(dir);
  return compactItems(await Promise.all(files
    .filter((file) => extname(file) === ".json")
    .map(async (file) => {
      const metadata = await fileMetadata(root, file);
      const json = await readJSONFile(file) as DesignChangelogEntry | null;
      if (!json || json.schemaVersion !== 1 || typeof json.title !== "string") return null;
      return memoryItem({
        kind: "changelog",
        root,
        file,
        title: json.title,
        summary: typeof json.summary === "string" && json.summary.trim() ? json.summary : "Local Studio design changelog entry.",
        status: json.status === "archived" ? "archived" : "active",
        tags: normalizeTags(["design-changelog", ...(Array.isArray(json.tags) ? json.tags : [])]),
        links: [
          { label: "Local changelog entry", href: String(metadata.sourcePath) },
          ...(typeof json.sessionId === "string" && json.sessionId ? [{ label: "Source session", href: json.sessionId }] : []),
        ],
        data: {
          ...metadata,
          entry: json,
          fileRefs: Array.isArray(json.fileRefs) ? json.fileRefs : [],
          captureWarnings: Array.isArray(json.captureWarnings) ? json.captureWarnings : [],
        },
      });
    })));
}

function homeItem(root: string): ProjectMemoryItem {
  const now = new Date(0).toISOString();
  return {
    id: "home:project-overview",
    kind: "home",
    title: "Project Overview",
    summary: "Filesystem-first project memory for runs, research, specs, systems, monitor state, and changelog entries.",
    status: "active",
    tags: ["overview"],
    sourcePath: ".memoire/project-memory/index.json",
    createdAt: now,
    updatedAt: now,
    links: [{ label: "Memory index", href: ".memoire/project-memory/index.json" }],
    data: { workspaceLabel: "Memoire workspace" },
  };
}

function memoryItem(input: {
  kind: ProjectMemoryKind;
  root: string;
  file: string;
  title: string;
  summary: string;
  status: string;
  tags?: string[];
  links?: Array<{ label: string; href: string }>;
  data?: Record<string, unknown>;
}): ProjectMemoryItem {
  const sourcePath = relative(input.root, input.file);
  const updatedAt = new Date().toISOString();
  return {
    id: `${input.kind}:${slug(sourcePath || input.title)}`,
    kind: input.kind,
    title: input.title,
    summary: input.summary,
    status: input.status,
    tags: input.tags ?? [],
    sourcePath,
    createdAt: updatedAt,
    updatedAt,
    links: input.links ?? [{ label: "Source", href: sourcePath }],
    data: input.data ?? {},
  };
}

async function walkFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(entries
      .filter((entry) => !entry.name.startsWith(".") && entry.name !== "node_modules")
      .map(async (entry) => {
        const path = join(dir, entry.name);
        return entry.isDirectory() ? walkFiles(path) : [path];
      }));
    return nested.flat();
  } catch {
    return [];
  }
}

async function readText(file: string): Promise<string> {
  try {
    return await readFile(file, "utf-8");
  } catch {
    return "";
  }
}

async function readJSONFile(file: string): Promise<Record<string, unknown> | null> {
  const content = await readText(file);
  return parseJSON(content);
}

async function fileMetadata(root: string, file: string): Promise<Record<string, unknown>> {
  try {
    const info = await stat(file);
    return {
      sourcePath: relative(root, file),
      byteLength: info.size,
      modifiedAt: info.mtime.toISOString(),
    };
  } catch {
    return { sourcePath: relative(root, file) };
  }
}

function parseJSON(content: string): Record<string, unknown> | null {
  if (!content.trim()) return null;
  try {
    const value = JSON.parse(content);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function compactItems<T>(items: Array<T | null>): T[] {
  return items.filter((item): item is T => item !== null);
}

function isStaleMemorySource(root: string, file: string, content: string, title: string): boolean {
  const relativePath = relative(root, file);
  return STALE_MEMORY_PATTERN.test(`${relativePath}\n${title}\n${content}`);
}

function isExcludedPreviewPath(root: string, file: string): boolean {
  const relativePath = relative(root, file);
  return EXCLUDED_PREVIEW_PATHS.some((pattern) => pattern.test(relativePath));
}

function markdownTitle(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

function firstText(content: string): string | null {
  return content
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .find((line) => line.length > 0 && !line.startsWith("---")) ?? null;
}

function titleFromFile(file: string): string {
  const name = basename(file, extname(file));
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function pickString(value: Record<string, unknown> | null, keys: string[]): string | null {
  if (!value) return null;
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

function normalizeTags(value: unknown, fallback: string[] = []): string[] {
  const tags = Array.isArray(value) ? value : fallback;
  return [...new Set(tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0).map((tag) => tag.trim()))];
}

function dashboardCounts(value: Record<string, unknown>): { tokens: number; components: number; layouts: number } {
  return {
    tokens: arrayLength(value.tokens) || arrayLength(value.tokenCollections),
    components: arrayLength(value.components),
    layouts: arrayLength(value.layouts),
  };
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "item";
}
