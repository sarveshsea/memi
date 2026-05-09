/**
 * MaintenanceRunner — periodic background task that keeps the engine's
 * persistent state from rotting.
 *
 * Today, snapshots and event journals never get cleaned up. A long-lived
 * runtime accumulates files indefinitely. The maintenance runner is the
 * only mechanism that prunes them.
 *
 * Default schedule (configurable):
 *   - Tick every 30 seconds
 *   - Snapshots: prune entries older than 7 days
 *   - Journals: prune entries older than 30 days
 *   - Snapshots: cap at 5,000 sessions (FIFO eviction by updatedAt)
 *   - Journals: cap at 5,000 sessions (FIFO eviction by mtime)
 *
 * The runner is intentionally simple: a plain setInterval, not Effect
 * yet. The Effect-based scheduling lands in commit 12 alongside the new
 * RPC surface; for now this just needs to work and be testable.
 *
 * Errors during a tick are caught and surfaced via the optional onError
 * callback. They never crash the runner — a failed prune in one tick
 * just gets retried on the next.
 */

import type { SnapshotStore } from "../snapshots/snapshot-store.js";
import type { EventJournal } from "../journal/event-journal.js";

export interface MaintenancePolicy {
  /** Tick interval in ms. Default 30,000 (30s). */
  tickIntervalMs?: number;
  /** Drop snapshots older than this many ms. Default 7 days. */
  snapshotMaxAgeMs?: number;
  /** Cap snapshot count. Default 5,000. */
  snapshotMaxCount?: number;
  /** Drop event journals older than this many ms. Default 30 days. */
  journalMaxAgeMs?: number;
  /** Cap journal count. Default 5,000. */
  journalMaxCount?: number;
}

export interface MaintenanceTaskResult {
  readonly snapshotsPruned: number;
  readonly journalsPruned: number;
  readonly tickAt: string;
  readonly elapsedMs: number;
}

export interface MaintenanceRunnerConfig {
  readonly snapshotStore?: SnapshotStore;
  readonly eventJournal?: EventJournal;
  readonly policy?: MaintenancePolicy;
  readonly onError?: (error: unknown, context: { task: string }) => void;
  readonly onTick?: (result: MaintenanceTaskResult) => void;
  /** Injectable scheduler — defaults to setInterval. Tests pass a manual ticker. */
  readonly scheduler?: MaintenanceScheduler;
}

export interface MaintenanceScheduler {
  start(intervalMs: number, run: () => Promise<void>): void;
  stop(): void;
}

const DEFAULT_POLICY: Required<MaintenancePolicy> = {
  tickIntervalMs: 30_000,
  snapshotMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
  snapshotMaxCount: 5_000,
  journalMaxAgeMs: 30 * 24 * 60 * 60 * 1000,
  journalMaxCount: 5_000,
};

class IntervalScheduler implements MaintenanceScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;

  start(intervalMs: number, run: () => Promise<void>): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => {
      void run().catch(() => undefined);
    }, intervalMs);
    // unref so the runner doesn't keep Node alive on its own
    if (typeof (this.timer as unknown as { unref?: () => void }).unref === "function") {
      (this.timer as unknown as { unref: () => void }).unref();
    }
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export class MaintenanceRunner {
  private readonly policy: Required<MaintenancePolicy>;
  private readonly scheduler: MaintenanceScheduler;
  private running = false;

  constructor(private readonly config: MaintenanceRunnerConfig) {
    this.policy = { ...DEFAULT_POLICY, ...(config.policy ?? {}) };
    this.scheduler = config.scheduler ?? new IntervalScheduler();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduler.start(this.policy.tickIntervalMs, async () => {
      await this.tick();
    });
  }

  stop(): void {
    if (!this.running) return;
    this.scheduler.stop();
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * Run one maintenance pass synchronously. Useful for tests and for the
   * runtime's startup path (run-on-boot before the interval kicks in).
   */
  async tick(): Promise<MaintenanceTaskResult> {
    const start = Date.now();
    let snapshotsPruned = 0;
    let journalsPruned = 0;

    if (this.config.snapshotStore) {
      try {
        snapshotsPruned = await this.config.snapshotStore.prune({
          olderThanMs: this.policy.snapshotMaxAgeMs,
          max: this.policy.snapshotMaxCount,
        });
      } catch (error) {
        this.config.onError?.(error, { task: "prune-snapshots" });
      }
    }

    if (this.config.eventJournal) {
      try {
        journalsPruned = await this.config.eventJournal.prune({
          olderThanMs: this.policy.journalMaxAgeMs,
          max: this.policy.journalMaxCount,
        });
      } catch (error) {
        this.config.onError?.(error, { task: "prune-journals" });
      }
    }

    const result: MaintenanceTaskResult = {
      snapshotsPruned,
      journalsPruned,
      tickAt: new Date().toISOString(),
      elapsedMs: Date.now() - start,
    };
    this.config.onTick?.(result);
    return result;
  }
}

/**
 * Test scheduler: lets you call .fire() manually instead of waiting on
 * setInterval. The runner uses whatever scheduler you pass.
 */
export class ManualScheduler implements MaintenanceScheduler {
  private active: (() => Promise<void>) | null = null;

  start(_intervalMs: number, run: () => Promise<void>): void {
    this.active = run;
  }

  stop(): void {
    this.active = null;
  }

  async fire(): Promise<void> {
    if (this.active) await this.active();
  }
}
