import { describe, expect, it } from "vitest";
import {
  ManualScheduler,
  MaintenanceRunner,
  type MaintenanceRunnerConfig,
} from "../../maintenance/runner.js";
import { MemorySnapshotStore, buildSnapshot } from "../../snapshots/snapshot-store.js";
import { MemoryEventJournal } from "../../journal/event-journal.js";
import { asId, makeId } from "../../contracts/ids.js";

function freshConfig(overrides: Partial<MaintenanceRunnerConfig> = {}): MaintenanceRunnerConfig {
  return {
    snapshotStore: new MemorySnapshotStore(),
    eventJournal: new MemoryEventJournal(),
    scheduler: new ManualScheduler(),
    ...overrides,
  };
}

describe("maintenance/runner", () => {
  it("isRunning is false until start()", () => {
    const runner = new MaintenanceRunner(freshConfig());
    expect(runner.isRunning()).toBe(false);
    runner.start();
    expect(runner.isRunning()).toBe(true);
    runner.stop();
    expect(runner.isRunning()).toBe(false);
  });

  it("start is idempotent", () => {
    const runner = new MaintenanceRunner(freshConfig());
    runner.start();
    runner.start();
    expect(runner.isRunning()).toBe(true);
    runner.stop();
  });

  it("tick prunes old snapshots", async () => {
    const store = new MemorySnapshotStore();
    const old = buildSnapshot({
      sessionId: asId("SessionId", makeId("SessionId")),
      harnessId: asId("HarnessId", "hns_codex"),
      sessionState: "ready",
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalReasoningTokens: 0,
      estimatedCostUsd: 0,
      lastEventSeq: 0,
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    });
    await store.save({ ...old, updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() });
    const fresh = buildSnapshot({
      sessionId: asId("SessionId", makeId("SessionId")),
      harnessId: asId("HarnessId", "hns_codex"),
      sessionState: "ready",
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalReasoningTokens: 0,
      estimatedCostUsd: 0,
      lastEventSeq: 0,
      createdAt: new Date().toISOString(),
    });
    await store.save(fresh);

    const runner = new MaintenanceRunner({
      snapshotStore: store,
      policy: { snapshotMaxAgeMs: 7 * 24 * 60 * 60 * 1000 },
      scheduler: new ManualScheduler(),
    });
    const result = await runner.tick();
    expect(result.snapshotsPruned).toBe(1);
    expect((await store.list()).length).toBe(1);
  });

  it("tick prunes old journals", async () => {
    const journal = new MemoryEventJournal();
    // Memory journal uses Date.now() as the mtime. We can't backdate it
    // directly, so emulate "old" by appending and immediately pruning
    // with a 0ms olderThan.
    const sessionId = asId("SessionId", makeId("SessionId"));
    await journal.append(sessionId, {
      eventId: asId("EventId", makeId("EventId")),
      seq: 1,
      harnessId: asId("HarnessId", "hns_codex"),
      providerInstanceId: asId("ProviderInstanceId", "prv_x"),
      sessionId,
      createdAt: new Date().toISOString(),
      type: "stream.heartbeat",
    });
    await new Promise((r) => setTimeout(r, 5));

    const runner = new MaintenanceRunner({
      eventJournal: journal,
      policy: { journalMaxAgeMs: 1 },
      scheduler: new ManualScheduler(),
    });
    const result = await runner.tick();
    expect(result.journalsPruned).toBe(1);
    expect((await journal.list()).length).toBe(0);
  });

  it("ManualScheduler fire() runs one tick on demand", async () => {
    const scheduler = new ManualScheduler();
    let ticks = 0;
    const runner = new MaintenanceRunner({
      onTick: () => {
        ticks += 1;
      },
      scheduler,
      policy: { tickIntervalMs: 999_999 },
    });
    runner.start();
    await scheduler.fire();
    await scheduler.fire();
    expect(ticks).toBe(2);
    runner.stop();
  });

  it("onError is called when prune throws; runner keeps running", async () => {
    const errors: unknown[] = [];
    const broken = {
      load: async () => null,
      save: async () => {},
      list: async () => [],
      delete: async () => {},
      prune: async () => {
        throw new Error("disk full");
      },
    };
    const runner = new MaintenanceRunner({
      snapshotStore: broken,
      onError: (err) => errors.push(err),
      scheduler: new ManualScheduler(),
    });
    const result = await runner.tick();
    expect(errors.length).toBe(1);
    expect((errors[0] as Error).message).toBe("disk full");
    expect(result.snapshotsPruned).toBe(0); // didn't crash, just zero work done
  });

  it("tick reports elapsedMs and tickAt", async () => {
    const runner = new MaintenanceRunner(freshConfig());
    const result = await runner.tick();
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(Date.parse(result.tickAt)).toBeGreaterThan(0);
  });

  it("onTick fires with the result on every pass", async () => {
    const seen: number[] = [];
    const scheduler = new ManualScheduler();
    const runner = new MaintenanceRunner({
      ...freshConfig({ scheduler }),
      onTick: (r) => seen.push(r.elapsedMs),
    });
    runner.start();
    await scheduler.fire();
    await scheduler.fire();
    await scheduler.fire();
    expect(seen.length).toBe(3);
  });

  it("works with no stores configured (no-op tick)", async () => {
    const runner = new MaintenanceRunner({ scheduler: new ManualScheduler() });
    const result = await runner.tick();
    expect(result.snapshotsPruned).toBe(0);
    expect(result.journalsPruned).toBe(0);
  });
});
