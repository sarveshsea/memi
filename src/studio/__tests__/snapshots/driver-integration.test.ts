/**
 * Integration test: BaseHarnessDriver auto-snapshots state-changing events
 * when a SnapshotStore is provided, and a fresh driver constructed for the
 * same sessionId can resume from that snapshot.
 *
 * This is the crash-recovery story end-to-end. Today, killing the runtime
 * mid-turn drops the live conversation. With snapshots, the next driver
 * instance picks up from where the previous one left off.
 */

import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { CodexDriver, CODEX_HARNESS_ID, type CodexTransport } from "../../drivers/codex.js";
import { asId, makeId } from "../../contracts/ids.js";
import { MemorySnapshotStore } from "../../snapshots/snapshot-store.js";

function fakeTransport() {
  const written: string[] = [];
  const lineSubs = new Set<(line: string, stream: "stdout" | "stderr") => void>();
  const exitSubs = new Set<(code: number | null, signal: NodeJS.Signals | null) => void>();
  const transport: CodexTransport = {
    write: async (line) => {
      written.push(line);
    },
    close: async () => {
      for (const cb of exitSubs) cb(0, null);
    },
    kill: async (signal) => {
      for (const cb of exitSubs) cb(null, signal ?? "SIGTERM");
    },
    onLine: (cb) => {
      lineSubs.add(cb);
      return () => lineSubs.delete(cb);
    },
    onExit: (cb) => {
      exitSubs.add(cb);
      return () => exitSubs.delete(cb);
    },
  };
  return {
    transport,
    written,
    pushLine: (line: string) => {
      for (const cb of lineSubs) cb(line, "stdout");
    },
  };
}

describe("snapshots/driver integration", () => {
  it("driver writes a snapshot after state-changing events", async () => {
    const store = new MemorySnapshotStore();
    const sessionId = asId("SessionId", makeId("SessionId"));
    const fake = fakeTransport();
    const driver = new CodexDriver({
      harnessId: CODEX_HARNESS_ID,
      providerInstanceId: asId("ProviderInstanceId", makeId("ProviderInstanceId")),
      sessionId,
      options: { spawnTransport: async () => fake.transport },
      snapshotStore: store,
    });

    await Effect.runPromise(driver.start());
    // Allow async snapshot writes to flush.
    await new Promise((r) => setTimeout(r, 30));

    const snap = await store.load(sessionId);
    expect(snap).not.toBeNull();
    expect(snap!.sessionId).toBe(sessionId);
    expect(snap!.harnessId).toBe(CODEX_HARNESS_ID);
    expect(["starting", "ready"]).toContain(snap!.sessionState);

    await Effect.runPromise(driver.shutdown());
  });

  it("usage events accumulate into snapshot totals", async () => {
    const store = new MemorySnapshotStore();
    const sessionId = asId("SessionId", makeId("SessionId"));
    const fake = fakeTransport();
    const driver = new CodexDriver({
      harnessId: CODEX_HARNESS_ID,
      providerInstanceId: asId("ProviderInstanceId", makeId("ProviderInstanceId")),
      sessionId,
      options: { spawnTransport: async () => fake.transport },
      snapshotStore: store,
    });

    await Effect.runPromise(driver.start());
    fake.pushLine(JSON.stringify({ kind: "usage", inputTokens: 100, outputTokens: 200, estimatedCostUsd: 0.05 }));
    fake.pushLine(JSON.stringify({ kind: "usage", inputTokens: 50, outputTokens: 75, estimatedCostUsd: 0.02 }));
    await new Promise((r) => setTimeout(r, 60));

    const snap = await store.load(sessionId);
    expect(snap?.totalInputTokens).toBe(150);
    expect(snap?.totalOutputTokens).toBe(275);
    expect(snap?.estimatedCostUsd).toBeCloseTo(0.07, 5);

    await Effect.runPromise(driver.shutdown());
  });

  it("a fresh driver can restoreFromSnapshot the prior session state", async () => {
    const store = new MemorySnapshotStore();
    const sessionId = asId("SessionId", makeId("SessionId"));
    const fake = fakeTransport();

    // First lifetime: drive a session to "ready" + accumulate usage.
    const first = new CodexDriver({
      harnessId: CODEX_HARNESS_ID,
      providerInstanceId: asId("ProviderInstanceId", makeId("ProviderInstanceId")),
      sessionId,
      options: { spawnTransport: async () => fake.transport },
      snapshotStore: store,
    });
    await Effect.runPromise(first.start());
    fake.pushLine(JSON.stringify({ kind: "usage", inputTokens: 42, outputTokens: 24 }));
    await new Promise((r) => setTimeout(r, 60));

    // Don't shutdown — simulate a runtime crash. The snapshot should be on disk.
    const snap = await store.load(sessionId);
    expect(snap).not.toBeNull();
    expect(snap!.totalInputTokens).toBe(42);

    // Second lifetime: a fresh driver instance for the same sessionId can
    // restore from the snapshot.
    const second = new CodexDriver({
      harnessId: CODEX_HARNESS_ID,
      providerInstanceId: asId("ProviderInstanceId", makeId("ProviderInstanceId")),
      sessionId,
      options: { spawnTransport: async () => fake.transport },
      snapshotStore: store,
    });
    const loaded = await second["loadSnapshot"]();
    expect(loaded?.totalInputTokens).toBe(42);

    second["restoreFromSnapshot"](loaded!);
    expect(second["snapshotStats"]().totalInputTokens).toBe(42);
    // Session state restored to "ready" (non-terminal at snapshot time).
    expect(second.sessionState()).toBe("ready");
  });

  it("driver without a snapshotStore behaves identically (no writes)", async () => {
    const fake = fakeTransport();
    const driver = new CodexDriver({
      harnessId: CODEX_HARNESS_ID,
      providerInstanceId: asId("ProviderInstanceId", makeId("ProviderInstanceId")),
      sessionId: asId("SessionId", makeId("SessionId")),
      options: { spawnTransport: async () => fake.transport },
    });
    await Effect.runPromise(driver.start());
    expect(driver.sessionState()).toBe("ready");
    // No store → no snapshot writes; the existence of any disk file is
    // out-of-scope here. The pre-snapshot tests still pass.
    await Effect.runPromise(driver.shutdown());
  });
});
