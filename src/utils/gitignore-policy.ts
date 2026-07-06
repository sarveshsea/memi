/**
 * Managed .gitignore block for team setups: keep .memoire/ workspace state
 * local while tracking the shared baseline. Idempotent via fence markers —
 * re-running init never duplicates the block, and edits inside the fence are
 * reconciled back to the canonical body.
 *
 * Honesty note: a pre-existing `.memoire/` ignore line OUTSIDE the fence
 * defeats the negation (git cannot re-include files inside an ignored
 * directory), so we detect and report it instead of silently "succeeding".
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const GITIGNORE_FENCE_START = "# >>> memi (managed) >>>";
export const GITIGNORE_FENCE_END = "# <<< memi (managed) <<<";

const BLOCK_BODY = [
  ".memoire/*",
  "!.memoire/baseline.json",
];

export interface GitignorePolicyResult {
  path: string;
  action: "created" | "updated" | "unchanged";
  /** A `.memoire/` ignore line outside the managed block that defeats the baseline negation. */
  conflictingLine?: string;
}

export function renderGitignoreBlock(): string {
  return [GITIGNORE_FENCE_START, ...BLOCK_BODY, GITIGNORE_FENCE_END].join("\n");
}

/** A bare `.memoire/` (or `.memoire`) directory ignore blocks the negation inside the fence. */
function findConflictingLine(content: string): string | undefined {
  const fenced = extractFence(content);
  const outside = fenced ? content.replace(fenced.block, "") : content;
  return outside
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line === ".memoire" || line === ".memoire/");
}

function extractFence(content: string): { block: string } | null {
  const start = content.indexOf(GITIGNORE_FENCE_START);
  if (start === -1) return null;
  const end = content.indexOf(GITIGNORE_FENCE_END, start);
  if (end === -1) return { block: content.slice(start) };
  return { block: content.slice(start, end + GITIGNORE_FENCE_END.length) };
}

/**
 * Ensure the managed block exists and matches the canonical body.
 * Creates .gitignore when missing; appends or reconciles otherwise.
 */
export async function ensureGitignorePolicy(projectRoot: string): Promise<GitignorePolicyResult> {
  const path = join(projectRoot, ".gitignore");
  const block = renderGitignoreBlock();

  let content: string | null = null;
  try {
    content = await readFile(path, "utf-8");
  } catch {
    // No .gitignore yet.
  }

  if (content === null) {
    await writeFile(path, `${block}\n`, "utf-8");
    return { path, action: "created" };
  }

  const fence = extractFence(content);
  const conflictingLine = findConflictingLine(content);

  if (fence) {
    if (fence.block === block) {
      return { path, action: "unchanged", conflictingLine };
    }
    await writeFile(path, content.replace(fence.block, block), "utf-8");
    return { path, action: "updated", conflictingLine };
  }

  const separator = content.endsWith("\n") ? "\n" : "\n\n";
  await writeFile(path, `${content}${separator}${block}\n`, "utf-8");
  return { path, action: "updated", conflictingLine };
}

/** Read-only variant for `memi doctor` — reports state without writing. */
export async function checkGitignorePolicy(projectRoot: string): Promise<{
  present: boolean;
  upToDate: boolean;
  conflictingLine?: string;
}> {
  let content: string;
  try {
    content = await readFile(join(projectRoot, ".gitignore"), "utf-8");
  } catch {
    return { present: false, upToDate: false };
  }
  const fence = extractFence(content);
  return {
    present: fence !== null,
    upToDate: fence?.block === renderGitignoreBlock(),
    conflictingLine: findConflictingLine(content),
  };
}
