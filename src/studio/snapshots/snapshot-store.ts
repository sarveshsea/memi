/**
 * SnapshotStore — per-session persistent snapshot of HarnessDriver state.
 *
 * Pattern adapted from t3code's providerSnapshot/providerStatusCache. The
 * snapshot captures everything needed to resume a session after a runtime
 * crash or reconnect: session/turn state, accumulated tokens, last error.
 *
 * Today, killing the runtime mid-turn drops the live conversation. With
 * snapshots, the next driver constructor for the same sessionId reads
 * the snapshot and resumes from where it left off.
 *
 * Two implementations:
 *   - FileSnapshotStore — persists JSON files to .memoire/studio/snapshots/
 *   - MemorySnapshotStore — for tests
 *
 * The store is injected into HarnessDriverConfig.snapshotStore. When not
 * provided, drivers behave exactly as before (no snapshotting, no resume).
 * This keeps the dependency optional and the rollout incremental.
 */

import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { HarnessId, SessionId, ThreadId, TurnId } from "../contracts/ids.js";
import type { SessionState, TurnState } from "../contracts/provider-runtime.js";

export interface HarnessSnapshot {
  readonly sessionId: SessionId;
  readonly harnessId: HarnessId;
  readonly threadId?: ThreadId;
  readonly sessionState: SessionState;
  readonly currentTurnId?: TurnId;
  readonly currentTurnState?: TurnState;
  readonly model?: string;
  readonly totalInputTokens: number;
  readonly totalOutputTokens: number;
  readonly totalReasoningTokens: number;
  readonly estimatedCostUsd: number;
  readonly lastError?: string;
  readonly lastEventAt: string;
  readonly lastEventSeq: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SnapshotStore {
  load(sessionId: SessionId): Promise<HarnessSnapshot | null>;
  save(snapshot: HarnessSnapshot): Promise<void>;
  list(): Promise<HarnessSnapshot[]>;
  delete(sessionId: SessionId): Promise<void>;
  prune(opts: { olderThanMs?: number; max?: number }): Promise<number>;
}

/**
 * In-memory implementation. Useful for tests, dry-runs, and the case where
 * crash-recovery isn't worth the disk I/O (very short sessions).
 */
export class MemorySnapshotStore implements SnapshotStore {
  private readonly map = new Map<string, HarnessSnapshot>();

  async load(sessionId: SessionId): Promise<HarnessSnapshot | null> {
    return this.map.get(sessionId) ?? null;
  }

  async save(snapshot: HarnessSnapshot): Promise<void> {
    this.map.set(snapshot.sessionId, snapshot);
  }

  async list(): Promise<HarnessSnapshot[]> {
    return Array.from(this.map.values());
  }

  async delete(sessionId: SessionId): Promise<void> {
    this.map.delete(sessionId);
  }

  async prune(opts: { olderThanMs?: number; max?: number }): Promise<number> {
    const now = Date.now();
    let removed = 0;
    if (opts.olderThanMs !== undefined) {
      for (const [key, snap] of this.map) {
        if (now - Date.parse(snap.updatedAt) > opts.olderThanMs) {
          this.map.delete(key);
          removed += 1;
        }
      }
    }
    if (opts.max !== undefined && this.map.size > opts.max) {
      const sorted = Array.from(this.map.entries()).sort(
        (a, b) => Date.parse(a[1].updatedAt) - Date.parse(b[1].updatedAt),
      );
      while (this.map.size > opts.max) {
        const [key] = sorted.shift()!;
        this.map.delete(key);
        removed += 1;
      }
    }
    return removed;
  }
}

/**
 * Disk-backed implementation. Each session gets its own JSON file under
 * <projectRoot>/.memoire/studio/snapshots/<sessionId>.json. Writes are
 * atomic (write-to-temp + rename) so a crash mid-write doesn't corrupt.
 */
export class FileSnapshotStore implements SnapshotStore {
  private readonly dir: string;
  private ensureDirPromise: Promise<void> | null = null;

  constructor(projectRoot: string) {
    this.dir = join(projectRoot, ".memoire", "studio", "snapshots");
  }

  private ensureDir(): Promise<void> {
    if (!this.ensureDirPromise) {
      this.ensureDirPromise = fs.mkdir(this.dir, { recursive: true }).then(() => undefined);
    }
    return this.ensureDirPromise;
  }

  private filePath(sessionId: SessionId): string {
    // sessionId already carries a sane prefix and uuid — safe for filename use.
    return join(this.dir, `${sessionId}.json`);
  }

  async load(sessionId: SessionId): Promise<HarnessSnapshot | null> {
    try {
      const raw = await fs.readFile(this.filePath(sessionId), "utf-8");
      return JSON.parse(raw) as HarnessSnapshot;
    } catch (error: unknown) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code === "ENOENT") return null;
      throw error;
    }
  }

  async save(snapshot: HarnessSnapshot): Promise<void> {
    await this.ensureDir();
    const final = this.filePath(snapshot.sessionId);
    const tmp = `${final}.tmp.${process.pid}.${Date.now()}`;
    await fs.writeFile(tmp, JSON.stringify(snapshot, null, 2), "utf-8");
    await fs.rename(tmp, final);
  }

  async list(): Promise<HarnessSnapshot[]> {
    try {
      const entries = await fs.readdir(this.dir);
      const snapshots: HarnessSnapshot[] = [];
      for (const name of entries) {
        if (!name.endsWith(".json")) continue;
        try {
          const raw = await fs.readFile(join(this.dir, name), "utf-8");
          snapshots.push(JSON.parse(raw) as HarnessSnapshot);
        } catch {
          // skip corrupt entries; the maintenance runner will eventually prune them
        }
      }
      return snapshots;
    } catch (error: unknown) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code === "ENOENT") return [];
      throw error;
    }
  }

  async delete(sessionId: SessionId): Promise<void> {
    try {
      await fs.unlink(this.filePath(sessionId));
    } catch (error: unknown) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code !== "ENOENT") throw error;
    }
  }

  async prune(opts: { olderThanMs?: number; max?: number }): Promise<number> {
    const all = await this.list();
    const now = Date.now();
    let removed = 0;
    const candidates: HarnessSnapshot[] = [];

    if (opts.olderThanMs !== undefined) {
      for (const snap of all) {
        if (now - Date.parse(snap.updatedAt) > opts.olderThanMs) {
          await this.delete(snap.sessionId);
          removed += 1;
        } else {
          candidates.push(snap);
        }
      }
    } else {
      candidates.push(...all);
    }

    if (opts.max !== undefined && candidates.length > opts.max) {
      const sorted = candidates.sort(
        (a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt),
      );
      const toRemove = sorted.length - opts.max;
      for (let i = 0; i < toRemove; i += 1) {
        await this.delete(sorted[i].sessionId);
        removed += 1;
      }
    }

    return removed;
  }
}

/**
 * Helper to construct a fresh snapshot from current driver state. Drivers
 * call this after each state-changing event and pass the result to
 * SnapshotStore.save().
 */
export function buildSnapshot(input: {
  sessionId: SessionId;
  harnessId: HarnessId;
  threadId?: ThreadId;
  sessionState: SessionState;
  currentTurnId?: TurnId;
  currentTurnState?: TurnState;
  model?: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalReasoningTokens: number;
  estimatedCostUsd: number;
  lastError?: string;
  lastEventSeq: number;
  createdAt: string;
}): HarnessSnapshot {
  const now = new Date().toISOString();
  return {
    ...input,
    lastEventAt: now,
    updatedAt: now,
  };
}
