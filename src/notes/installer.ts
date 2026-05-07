/**
 * Note Installer — Install, remove, and scaffold Mémoire Notes.
 *
 * Sources:
 *   - Local path:  memi notes install ./my-note
 *   - GitHub repo: memi notes install github:user/repo
 *   - (Future)     memi notes install note-name  (from registry)
 */

import { readFile, writeFile, mkdir, rm, readdir, stat, copyFile, cp } from "fs/promises";
import { join, basename, resolve } from "path";
import { execFile, type ExecFileOptions } from "child_process";
import { createLogger } from "../engine/logger.js";
import { NoteManifestSchema, type NoteCategory, type NoteManifest } from "./types.js";
import { buildWorkspaceSkillManifest, parseSkillMarkdown } from "./frontmatter.js";
import {
  findCatalogNote,
  installCatalogNote,
  isSafeNoteName,
  loadNotesCatalog,
  type InstallCatalogNoteOptions,
} from "./catalog.js";

const log = createLogger("notes-installer");
const GITHUB_REPO_PATTERN = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\/([A-Za-z0-9._-]{1,100})$/;

function notesDir(projectRoot: string): string {
  return join(projectRoot, ".memoire", "notes");
}

function assertSafeName(name: string): void {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    throw new Error(`Invalid note name "${name}" — must be kebab-case (a-z, 0-9, hyphens)`);
  }
  if (name.includes("..") || name.includes("/") || name.includes("\\")) {
    throw new Error(`Note name "${name}" contains path traversal characters`);
  }
}

// ── Install ──────────────────────────────────────────────

export async function installNote(
  source: string,
  projectRoot: string,
  options: InstallCatalogNoteOptions = {},
): Promise<NoteManifest> {
  const dest = notesDir(projectRoot);
  await mkdir(dest, { recursive: true });

  if (source.startsWith("github:")) {
    return installFromGithub(source.slice(7), dest);
  }

  if (isSafeNoteName(source) && !looksLikePath(source)) {
    try {
      const catalog = await loadNotesCatalog(options);
      const entry = findCatalogNote(catalog, source);
      if (entry) return installCatalogNote(projectRoot, entry, options);
      if (options.catalogUrl) throw new Error(`Note "${source}" was not found in catalog ${options.catalogUrl}`);
    } catch (error) {
      if (options.catalogUrl) throw error;
      log.warn({ err: error, source }, "Remote note catalog unavailable; falling back to local path install");
    }
  }

  // Treat as local path
  const localPath = resolve(source);
  return installFromLocal(localPath, dest);
}

async function installFromLocal(sourcePath: string, destRoot: string): Promise<NoteManifest> {
  const { manifest, generated } = await readManifestFromSource(sourcePath, basename(sourcePath));

  assertSafeName(manifest.name);

  const targetDir = join(destRoot, manifest.name);
  await mkdir(targetDir, { recursive: true });

  // Copy all files and directories from source to target
  const entries = await readdir(sourcePath);
  for (const entry of entries) {
    const srcFile = join(sourcePath, entry);
    const dstFile = join(targetDir, entry);
    const fileStat = await stat(srcFile);

    if (fileStat.isDirectory()) {
      await cp(srcFile, dstFile, { recursive: true });
    } else {
      await copyFile(srcFile, dstFile);
    }
  }

  if (generated) {
    await writeFile(join(targetDir, "note.json"), JSON.stringify(manifest, null, 2));
  }

  log.info({ name: manifest.name, version: manifest.version }, "Note installed from local path");
  return manifest;
}

async function installFromGithub(repo: string, destRoot: string): Promise<NoteManifest> {
  const source = parseGithubNoteRepo(repo);

  // Validate git is available
  try {
    await execFileChecked("git", ["--version"], { timeout: 10_000 });
  } catch {
    throw new Error("Git is not installed. Install git or use local path: memi notes install ./my-note");
  }

  // Clone into a temp directory first
  const tmpDir = join(destRoot, ".tmp-clone-" + Date.now());
  try {
    await execFileChecked("git", ["clone", "--depth", "1", source.cloneUrl, tmpDir], {
      timeout: 30_000,
    });

    const { manifest, generated } = await readManifestFromSource(tmpDir, source.repo);

    assertSafeName(manifest.name);

    // Move to final location
    const targetDir = join(destRoot, manifest.name);
    await rm(targetDir, { recursive: true, force: true });

    // Copy files and directories (skip .git)
    await mkdir(targetDir, { recursive: true });
    const entries = await readdir(tmpDir);
    for (const entry of entries) {
      if (entry === ".git") continue;
      const srcFile = join(tmpDir, entry);
      const dstFile = join(targetDir, entry);
      const fileStat = await stat(srcFile);
      if (fileStat.isDirectory()) {
        await cp(srcFile, dstFile, { recursive: true });
      } else {
        await copyFile(srcFile, dstFile);
      }
    }

    if (generated) {
      await writeFile(join(targetDir, "note.json"), JSON.stringify(manifest, null, 2));
    }

    log.info({ name: manifest.name, repo }, "Note installed from GitHub");
    return manifest;
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export function parseGithubNoteRepo(repo: string): { owner: string; repo: string; cloneUrl: string } {
  if (repo.trim() !== repo) {
    throw new Error("GitHub Note source must be exactly `github:owner/repo` with no surrounding whitespace");
  }

  const match = repo.match(GITHUB_REPO_PATTERN);
  if (!match || repo.includes("..") || repo.endsWith(".git")) {
    throw new Error(`Invalid GitHub Note source "github:${repo}". Use exactly github:owner/repo.`);
  }

  const [, owner, repoName] = match;
  return {
    owner,
    repo: repoName,
    cloneUrl: `https://github.com/${owner}/${repoName}.git`,
  };
}

function execFileChecked(command: string, args: string[], options: ExecFileOptions = {}): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    execFile(command, args, {
      encoding: "utf-8",
      maxBuffer: 1024 * 1024,
      ...options,
    }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(String(stderr ?? "").trim() || error.message));
        return;
      }
      resolvePromise();
    });
  });
}

function looksLikePath(source: string): boolean {
  return source.startsWith(".")
    || source.startsWith("/")
    || source.includes("/")
    || source.includes("\\")
    || source.startsWith("file:");
}

async function readManifestFromSource(sourcePath: string, fallbackName: string): Promise<{ manifest: NoteManifest; generated: boolean }> {
  const noteJsonPath = join(sourcePath, "note.json");
  try {
    const raw = await readFile(noteJsonPath, "utf-8");
    return {
      manifest: NoteManifestSchema.parse(JSON.parse(raw)),
      generated: false,
    };
  } catch {
    const skillPath = join(sourcePath, "SKILL.md");
    const skillRaw = await readFile(skillPath, "utf-8");
    const parsedSkill = parseSkillMarkdown(skillRaw);
    return {
      manifest: buildWorkspaceSkillManifest(
        parsedSkill.frontmatter,
        parsedSkill.body,
        {
          noteDir: sourcePath,
          fallbackName,
          skillFileName: "SKILL.md",
        },
      ),
      generated: true,
    };
  }
}

// ── Remove ───────────────────────────────────────────────

export async function removeNote(name: string, projectRoot: string): Promise<void> {
  assertSafeName(name);
  const noteDir = join(notesDir(projectRoot), name);

  try {
    await stat(noteDir);
  } catch {
    throw new Error(`Note "${name}" is not installed`);
  }

  await rm(noteDir, { recursive: true, force: true });
  log.info({ name }, "Note removed");
}

// ── Scaffold ─────────────────────────────────────────────

export async function scaffoldNote(
  name: string,
  category: NoteCategory,
  projectRoot: string,
): Promise<string> {
  assertSafeName(name);

  const noteDir = join(notesDir(projectRoot), name);
  await mkdir(noteDir, { recursive: true });

  const manifest: NoteManifest = {
    name,
    version: "0.1.0",
    description: `${name} — a Mémoire Note`,
    category,
    tags: [],
    sourceUrls: [],
    skills: [{
      file: `${name}.md`,
      name: name.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "),
      activateOn: category === "research" ? "research-to-dashboard"
        : category === "connect" ? "always"
        : category === "generate" ? "component-creation"
        : "component-creation",
      freedomLevel: "high",
    }],
    dependencies: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await writeFile(
    join(noteDir, "note.json"),
    JSON.stringify(manifest, null, 2),
  );

  const skillContent = `# ${manifest.skills[0].name}

> ${manifest.description}

## Freedom Level: ${manifest.skills[0].freedomLevel}

This note activates on: \`${manifest.skills[0].activateOn}\`

## Workflow

1. **OBSERVE** — Gather context from the current design system and project
2. **PLAN** — Decompose the request into actionable steps
3. **EXECUTE** — Apply changes using the appropriate tools
4. **VALIDATE** — Verify the output meets quality standards

## Guidelines

<!-- Add your skill-specific knowledge, decision trees, and best practices here -->

## Anti-Patterns

<!-- Document what NOT to do -->
`;

  await writeFile(join(noteDir, `${name}.md`), skillContent);

  log.info({ name, category }, "Note scaffolded");
  return noteDir;
}

// ── Info ─────────────────────────────────────────────────

export async function getNoteInfo(
  name: string,
  projectRoot: string,
): Promise<NoteManifest | null> {
  assertSafeName(name);
  const manifestPath = join(notesDir(projectRoot), name, "note.json");
  try {
    const raw = await readFile(manifestPath, "utf-8");
    return NoteManifestSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}
