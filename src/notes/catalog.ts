import { createHash, randomUUID } from "node:crypto";
import { execFile, type ExecFileOptions } from "node:child_process";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile, cp, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { NoteCategorySchema, NoteManifestSchema, type NoteManifest } from "./types.js";

export const DEFAULT_NOTES_CATALOG_URL = "https://www.memoire.cv/notes/catalog.v1.json";
export const DEFAULT_COMMUNITY_NOTES_CATALOG_URL = "https://www.memoire.cv/notes/community/catalog.v1.json";

export const NoteCatalogArchiveSchema = z.object({
  url: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  size: z.number().int().nonnegative(),
});

export const NoteCatalogEntrySchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
  title: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().min(1),
  category: NoteCategorySchema,
  tags: z.array(z.string()).default([]),
  sourceUrls: z.array(z.string().url()).default([]),
  lastResearchedAt: z.string().datetime().optional(),
  freshnessDays: z.number().int().positive().optional(),
  sourceKind: z.enum(["official", "community"]).optional(),
  sourceRepo: z.string().url().optional(),
  sourcePath: z.string().optional(),
  reviewStatus: z.enum(["draft", "submitted", "approved", "rejected"]).optional(),
  contributionUrl: z.string().url().optional(),
  archive: NoteCatalogArchiveSchema,
  manifest: NoteManifestSchema.optional(),
});
export type NoteCatalogEntry = z.infer<typeof NoteCatalogEntrySchema>;

export const NoteCatalogSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  baseUrl: z.string().min(1),
  notes: z.array(NoteCatalogEntrySchema),
});
export type NoteCatalog = z.infer<typeof NoteCatalogSchema>;

export interface LoadNotesCatalogOptions {
  catalogUrl?: string | null;
  timeoutMs?: number;
}

export interface InstallCatalogNoteOptions extends LoadNotesCatalogOptions {
  onProgress?: (event: { type: "progress" | "completed"; message: string; bytes?: number }) => void;
}

export async function loadNotesCatalog(options: LoadNotesCatalogOptions = {}): Promise<NoteCatalog> {
  const catalogUrl = options.catalogUrl || process.env.MEMOIRE_NOTES_CATALOG_URL || DEFAULT_NOTES_CATALOG_URL;
  const bytes = await readBytesFromUrl(catalogUrl, options.timeoutMs ?? 2_500);
  return NoteCatalogSchema.parse(JSON.parse(bytes.toString("utf-8")));
}

export function findCatalogNote(catalog: NoteCatalog, name: string, version?: string | null): NoteCatalogEntry | null {
  const candidates = catalog.notes.filter((entry) => entry.name === name || entry.id === name);
  if (version) return candidates.find((entry) => entry.version === version) ?? null;
  return candidates.sort((left, right) => right.version.localeCompare(left.version, undefined, { numeric: true }))[0] ?? null;
}

export function isSafeNoteName(value: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(value) && !value.includes("..") && !value.includes("/") && !value.includes("\\");
}

export function assertSafeArchiveEntries(entries: string[]): void {
  if (entries.length === 0) throw new Error("Note archive is empty");
  for (const entry of entries) {
    const normalized = entry.trim();
    if (!normalized) throw new Error("Note archive contains an empty entry");
    if (normalized.startsWith("/") || /^[A-Za-z]:[\\/]/.test(normalized)) {
      throw new Error(`Note archive contains absolute path: ${entry}`);
    }
    if (normalized.includes("\\")) {
      throw new Error(`Note archive contains unsupported path separator: ${entry}`);
    }
    const safe = posix.normalize(normalized);
    if (safe === ".." || safe.startsWith("../") || safe.includes("/../")) {
      throw new Error(`Note archive contains path traversal entry: ${entry}`);
    }
  }
}

export async function installCatalogNote(
  projectRoot: string,
  entry: NoteCatalogEntry,
  options: InstallCatalogNoteOptions = {},
): Promise<NoteManifest> {
  if (!isSafeNoteName(entry.name)) throw new Error(`Invalid note name in catalog: ${entry.name}`);
  const downloadsDir = join(projectRoot, ".memoire", "downloads", "notes");
  const notesRoot = join(projectRoot, ".memoire", "notes");
  await mkdir(downloadsDir, { recursive: true });
  await mkdir(notesRoot, { recursive: true });

  options.onProgress?.({ type: "progress", message: `Downloading ${entry.name}` });
  const archiveBytes = await readBytesFromUrl(entry.archive.url, options.timeoutMs ?? 30_000);
  const sha256 = createHash("sha256").update(archiveBytes).digest("hex");
  if (sha256 !== entry.archive.sha256.toLowerCase()) {
    throw new Error(`Checksum mismatch for ${entry.name}: expected ${entry.archive.sha256}, got ${sha256}`);
  }

  const archivePath = join(downloadsDir, `${entry.name}-${entry.version}.tgz`);
  await writeFile(archivePath, archiveBytes);
  const archiveEntries = await listTarEntries(archivePath);
  assertSafeArchiveEntries(archiveEntries);

  options.onProgress?.({ type: "progress", message: `Extracting ${entry.name}`, bytes: archiveBytes.byteLength });
  const extractDir = await mkdtemp(join(tmpdir(), `memoire-note-${entry.name}-`));
  const stagingDir = join(notesRoot, `.install-${entry.name}-${Date.now()}-${randomUUID().slice(0, 8)}`);
  try {
    await execFileChecked("tar", ["-xzf", archivePath, "-C", extractDir], { timeout: 30_000 });
    const sourceDir = await findExtractedNoteDir(extractDir, entry.name);
    const raw = await readFile(join(sourceDir, "note.json"), "utf-8");
    const manifest = NoteManifestSchema.parse(JSON.parse(raw));
    if (manifest.name !== entry.name) {
      throw new Error(`Downloaded note manifest name "${manifest.name}" does not match catalog entry "${entry.name}"`);
    }

    await rm(stagingDir, { recursive: true, force: true });
    await cp(sourceDir, stagingDir, { recursive: true });
    await rm(join(notesRoot, manifest.name), { recursive: true, force: true });
    await rename(stagingDir, join(notesRoot, manifest.name));
    options.onProgress?.({ type: "completed", message: `Installed ${manifest.name}@${manifest.version}` });
    return manifest;
  } finally {
    await rm(extractDir, { recursive: true, force: true }).catch(() => {});
    await rm(stagingDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function findExtractedNoteDir(root: string, expectedName: string): Promise<string> {
  const direct = join(root, expectedName);
  if (await isDirectory(direct)) return direct;
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = join(root, entry.name);
    if (await isFile(join(candidate, "note.json"))) return candidate;
  }
  if (await isFile(join(root, "note.json"))) return root;
  throw new Error(`Downloaded note ${expectedName} does not contain note.json`);
}

async function readBytesFromUrl(url: string, timeoutMs: number): Promise<Buffer> {
  if (url.startsWith("file:")) return readFile(fileURLToPath(url));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}

async function listTarEntries(archivePath: string): Promise<string[]> {
  const output = await execFileOutput("tar", ["-tzf", archivePath], { timeout: 10_000 });
  return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function execFileOutput(command: string, args: string[], options: ExecFileOptions = {}): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    execFile(command, args, { encoding: "utf-8", maxBuffer: 1024 * 1024, ...options }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(String(stderr ?? "").trim() || error.message));
        return;
      }
      resolveOutput(String(stdout ?? ""));
    });
  });
}

function execFileChecked(command: string, args: string[], options: ExecFileOptions = {}): Promise<void> {
  return execFileOutput(command, args, options).then(() => undefined);
}

async function isDirectory(path: string): Promise<boolean> {
  return stat(path).then((info) => info.isDirectory()).catch(() => false);
}

async function isFile(path: string): Promise<boolean> {
  return stat(path).then((info) => info.isFile()).catch(() => false);
}

export function catalogEntryToManifest(entry: NoteCatalogEntry): NoteManifest {
  return entry.manifest ?? {
    name: entry.name,
    version: entry.version,
    description: entry.description,
    category: entry.category,
    tags: entry.tags,
    sourceUrls: entry.sourceUrls,
    lastResearchedAt: entry.lastResearchedAt,
    freshnessDays: entry.freshnessDays,
    skills: [{
      file: `${entry.name}.md`,
      name: entry.title,
      activateOn: entry.category === "generate" ? "component-creation" : "always",
      freedomLevel: "reference",
    }],
    dependencies: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function noteArchiveName(entry: NoteCatalogEntry): string {
  return `${entry.name}-${entry.version}.tgz`;
}

export function localArchiveUrl(path: string): string {
  return `file://${resolve(path)}`;
}

export function noteTitleFromName(name: string): string {
  return basename(name).split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
