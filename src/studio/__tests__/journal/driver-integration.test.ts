/**
 * Integration test: BaseHarnessDriver appends every emitted event to its
 * configured EventJournal, and a UI client can replay the session from
 * any seq cursor.
 */

import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { CodexDriver, CODEX_HARNESS_ID, type CodexTransport } from "../../drivers/codex.js";
import { asId, makeId } from "../../contracts/ids.js";
import { MemoryEventJournal, collectReplay } from "../../journal/event-journal.js";

function fakeTransport() {
  const lineSubs = new Set<(line: string, stream: "stdout" | "stderr") => void>();
  const exitSubs = new Set<(code: number | null, signal: NodeJS.Signals | null) => void>();
  const transport: CodexTransport = {
    write: async () => {},
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
    pushLine: (line: string) => {
      for (const cb of lineSubs) cb(line, "stdout");
    },
  };
}

describe("journal/driver integration", () => {
  it("driver appends every emitted event to the configured journal", async () => {
    const journal = new MemoryEventJournal();
    const sessionId = asId("SessionId", makeId("SessionId"));
    const fake = fakeTransport();
    const driver = new CodexDriver({
      harnessId: CODEX_HARNESS_ID,
      providerInstanceId: asId("ProviderInstanceId", makeId("ProviderInstanceId")),
      sessionId,
      options: { spawnTransport: async () => fake.transport },
      eventJournal: journal,
    });

    await Effect.runPromise(driver.start());
    await new Promise((r) => setTimeout(r, 30));

    const replayed = await collectReplay(journal, sessionId);
    // start() emits at least: session.created + session.state.changed (starting)
    // + session.state.changed (ready). Let the test tolerate exact count.
    expect(replayed.length).toBeGreaterThanOrEqual(2);
    expect(replayed.some((e) => e.type === "session.created")).toBe(true);

    await Effect.runPromise(driver.shutdown());
  });

  it("UI client can replay from a cursor", async () => {
    const journal = new MemoryEventJournal();
    const sessionId = asId("SessionId", makeId("SessionId"));
    const fake = fakeTransport();
    const driver = new CodexDriver({
      harnessId: CODEX_HARNESS_ID,
      providerInstanceId: asId("ProviderInstanceId", makeId("ProviderInstanceId")),
      sessionId,
      options: { spawnTransport: async () => fake.transport },
      eventJournal: journal,
    });

    await Effect.runPromise(driver.start());
    fake.pushLine(JSON.stringify({ kind: "assistant_delta", delta: "first" }));
    fake.pushLine(JSON.stringify({ kind: "assistant_delta", delta: "second" }));
    fake.pushLine(JSON.stringify({ kind: "assistant_delta", delta: "third" }));
    await new Promise((r) => setTimeout(r, 60));

    const all = await collectReplay(journal, sessionId);
    const cursorSeq = all[Math.floor(all.length / 2)].seq;
    const tail = await collectReplay(journal, sessionId, cursorSeq);
    expect(tail.length).toBeLessThan(all.length);
    expect(tail[0].seq).toBeGreaterThanOrEqual(cursorSeq);

    await Effect.runPromise(driver.shutdown());
  });

  it("driver without a journal still works (no writes)", async () => {
    const fake = fakeTransport();
    const driver = new CodexDriver({
      harnessId: CODEX_HARNESS_ID,
      providerInstanceId: asId("ProviderInstanceId", makeId("ProviderInstanceId")),
      sessionId: asId("SessionId", makeId("SessionId")),
      options: { spawnTransport: async () => fake.transport },
    });
    await Effect.runPromise(driver.start());
    expect(driver.sessionState()).toBe("ready");
    await Effect.runPromise(driver.shutdown());
  });
});
