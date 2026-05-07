import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { StudioDesignSystemTrace, StudioDesignSystemTraceFile } from "./types.js";

const execFileAsync = promisify(execFile);

export async function collectDesignSystemTrace(projectRoot: string): Promise<StudioDesignSystemTrace> {
  const generatedAt = new Date().toISOString();
  try {
    const [statusOutput, numstatOutput] = await Promise.all([
      runGit(projectRoot, ["status", "--short"]),
      runGit(projectRoot, ["diff", "--numstat", "--", "."]),
    ]);
    const files = mergeStatusAndNumstat(statusOutput, numstatOutput);
    const insertions = files.reduce((sum, file) => sum + file.insertions, 0);
    const deletions = files.reduce((sum, file) => sum + file.deletions, 0);
    const designSystemFiles = files.filter((file) => file.designSystem);
    return {
      generatedAt,
      projectRoot,
      status: files.length > 0 ? "changed" : "clean",
      filesChanged: files.length,
      insertions,
      deletions,
      reviewLabel: files.length > 0
        ? `${files.length} file${files.length === 1 ? "" : "s"} changed  +${insertions}  -${deletions}`
        : "No design-system changes",
      files,
      designSystemFiles,
      error: null,
    };
  } catch (error) {
    return {
      generatedAt,
      projectRoot,
      status: "unavailable",
      filesChanged: 0,
      insertions: 0,
      deletions: 0,
      reviewLabel: "Design trace unavailable",
      files: [],
      designSystemFiles: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runGit(projectRoot: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", projectRoot, ...args], {
    maxBuffer: 2 * 1024 * 1024,
    timeout: 5000,
  });
  return stdout;
}

function mergeStatusAndNumstat(statusOutput: string, numstatOutput: string): StudioDesignSystemTraceFile[] {
  const files = new Map<string, StudioDesignSystemTraceFile>();
  for (const line of numstatOutput.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [rawInsertions, rawDeletions, ...pathParts] = line.split(/\s+/);
    const path = normalizeGitPath(pathParts.join(" "));
    if (!path) continue;
    files.set(path, makeTraceFile({
      path,
      status: "modified",
      insertions: parseCount(rawInsertions),
      deletions: parseCount(rawDeletions),
    }));
  }

  for (const line of statusOutput.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const status = line.slice(0, 2).trim() || "modified";
    const path = normalizeGitPath(line.slice(3));
    if (!path) continue;
    const existing = files.get(path);
    files.set(path, {
      ...makeTraceFile({
        path,
        status,
        insertions: existing?.insertions ?? 0,
        deletions: existing?.deletions ?? 0,
      }),
    });
  }

  return [...files.values()].sort((left, right) => Number(right.designSystem) - Number(left.designSystem) || left.path.localeCompare(right.path));
}

function makeTraceFile(input: { path: string; status: string; insertions: number; deletions: number }): StudioDesignSystemTraceFile {
  const kind = classifyTraceFile(input.path);
  return {
    ...input,
    kind,
    designSystem: kind !== "other",
  };
}

function classifyTraceFile(path: string): StudioDesignSystemTraceFile["kind"] {
  const normalized = path.toLowerCase();
  if (/(\btokens?\b|theme|tailwind|styles?\.css|\.css$)/.test(normalized)) return normalized.includes("token") ? "token" : "style";
  if (/^(specs|src\/specs|.*\/specs)\//.test(normalized) || /spec/.test(normalized) && /\.(json|mdx?|ts)$/.test(normalized)) return "spec";
  if (/figma|plugin\/|widget/.test(normalized)) return "figma";
  if (/component|apps\/studio\/src|src\/studio|src\/codegen|src\/shadcn/.test(normalized) && /\.(tsx?|css|json)$/.test(normalized)) return "component";
  if (/package\.json|package-lock\.json|tauri\.conf|cargo\.(toml|lock)|server\.json|vite\.config/.test(normalized)) return "config";
  if (/research|knowledge|notes|marketplace/.test(normalized)) return "research";
  return "other";
}

function normalizeGitPath(path: string): string {
  const renamed = path.includes(" -> ") ? path.split(" -> ").at(-1) ?? path : path;
  return renamed.replace(/^"|"$/g, "").trim();
}

function parseCount(value: string): number {
  const count = Number.parseInt(value, 10);
  return Number.isFinite(count) ? count : 0;
}
