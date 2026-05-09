/**
 * Contract-conformance test — runs every JsonLineDriver subclass through the
 * same scripted fixture and asserts each emits the canonical
 * ProviderRuntimeEvent sequence.
 *
 * If a future harness driver passes this test, the rest of the system needs
 * no per-harness branching to consume its events. That is the whole point
 * of the contract: any driver in, same downstream code out.
 *
 * Drivers tested today (commit 7):
 *   - HermesDriver
 *   - OllamaDriver
 *   - GeminiDriver
 *
 * Codex, Claude Code, and OpenCode have their own dedicated tests (they
 * don't extend JsonLineDriver yet) but their event-shape conformance is
 * verified there.
 */

import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { asId, makeId } from "../../contracts/ids.js";
import type { ProviderRuntimeEvent } from "../../contracts/provider-runtime.js";
import type { LineTransport } from "../../drivers/json-line-driver.js";
import { HermesDriver, HERMES_HARNESS_ID } from "../../drivers/hermes.js";
import { OllamaDriver, OLLAMA_HARNESS_ID } from "../../drivers/ollama.js";
import { GeminiDriver, GEMINI_HARNESS_ID } from "../../drivers/gemini.js";
import { AbstractJsonLineDriver } from "../../drivers/json-line-driver.js";
import type { HarnessId } from "../../contracts/ids.js";

function fakeTransport() {
  const written: string[] = [];
  const lineSubs = new Set<(line: string, stream: "stdout" | "stderr") => void>();
  const exitSubs = new Set<(code: number | null, signal: NodeJS.Signals | null) => void>();
  const transport: LineTransport = {
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
    pushExit: () => {
      for (const cb of exitSubs) cb(0, null);
    },
  };
}

interface DriverCase {
  name: string;
  harnessId: HarnessId;
  build: (spawnTransport: () => Promise<LineTransport>) => AbstractJsonLineDriver;
}

const CASES: DriverCase[] = [
  {
    name: "hermes",
    harnessId: HERMES_HARNESS_ID,
    build: (spawnTransport) =>
      new HermesDriver({
        harnessId: HERMES_HARNESS_ID,
        providerInstanceId: asId("ProviderInstanceId", makeId("ProviderInstanceId")),
        sessionId: asId("SessionId", makeId("SessionId")),
        options: { spawnTransport },
      }),
  },
  {
    name: "ollama",
    harnessId: OLLAMA_HARNESS_ID,
    build: (spawnTransport) =>
      new OllamaDriver({
        harnessId: OLLAMA_HARNESS_ID,
        providerInstanceId: asId("ProviderInstanceId", makeId("ProviderInstanceId")),
        sessionId: asId("SessionId", makeId("SessionId")),
        options: { spawnTransport },
      }),
  },
  {
    name: "gemini",
    harnessId: GEMINI_HARNESS_ID,
    build: (spawnTransport) =>
      new GeminiDriver({
        harnessId: GEMINI_HARNESS_ID,
        providerInstanceId: asId("ProviderInstanceId", makeId("ProviderInstanceId")),
        sessionId: asId("SessionId", makeId("SessionId")),
        options: { spawnTransport },
      }),
  },
];

function collectEvents(driver: AbstractJsonLineDriver): { events: ProviderRuntimeEvent[]; cb: (e: ProviderRuntimeEvent) => void } {
  const events: ProviderRuntimeEvent[] = [];
  const cb = (e: ProviderRuntimeEvent) => {
    events.push(e);
  };
  const handle = (driver as unknown as { ["subscribers"]: Set<(e: ProviderRuntimeEvent) => void> }).subscribers;
  handle.add(cb);
  return { events, cb };
}

describe.each(CASES)("contract conformance: $name driver", ({ build }) => {
  it("emits the canonical event sequence for a typical turn", async () => {
    const fake = fakeTransport();
    const driver = build(async () => fake.transport);
    const { events } = collectEvents(driver);

    await Effect.runPromise(driver.start());
    expect(driver.sessionState()).toBe("ready");

    const turnId = asId("TurnId", makeId("TurnId"));
    await Effect.runPromise(driver.sendTurn({ turnId, prompt: "hello" }));
    expect(driver.sessionState()).toBe("running");

    fake.pushLine(JSON.stringify({ kind: "assistant_delta", delta: "hi" }));
    fake.pushLine(JSON.stringify({ kind: "assistant_message", text: "hi there" }));
    fake.pushLine(JSON.stringify({ kind: "tool_started", toolCallId: "tcl_1", tool: "Read", args: {} }));
    fake.pushLine(JSON.stringify({ kind: "tool_completed", toolCallId: "tcl_1", ok: true, elapsedMs: 5 }));
    fake.pushLine(JSON.stringify({ kind: "usage", inputTokens: 10, outputTokens: 20 }));
    fake.pushLine(JSON.stringify({ kind: "turn_completed", ok: true }));

    await new Promise((r) => setTimeout(r, 30));

    const types = events.map((e) => e.type);
    // Every driver in the contract MUST surface these canonical types.
    expect(types).toContain("session.created");
    expect(types).toContain("session.state.changed");
    expect(types).toContain("turn.created");
    expect(types).toContain("message.user");
    expect(types).toContain("message.assistant.delta");
    expect(types).toContain("message.assistant.complete");
    expect(types).toContain("tool.call.started");
    expect(types).toContain("tool.call.completed");
    expect(types).toContain("usage.updated");
    expect(types).toContain("turn.completed");

    expect(driver.sessionState()).toBe("ready");
    await Effect.runPromise(driver.shutdown());
  });

  it("clean shutdown moves session to stopped", async () => {
    const fake = fakeTransport();
    const driver = build(async () => fake.transport);
    await Effect.runPromise(driver.start());
    await Effect.runPromise(driver.shutdown());
    expect(driver.sessionState()).toBe("stopped");
  });

  it("non-JSON stdout becomes a diagnostic warning", async () => {
    const fake = fakeTransport();
    const driver = build(async () => fake.transport);
    const { events } = collectEvents(driver);

    await Effect.runPromise(driver.start());
    fake.pushLine("not json at all");
    await new Promise((r) => setTimeout(r, 20));

    expect(events.some((e) => e.type === "diagnostic.warn" || e.type === "diagnostic.error")).toBe(true);
    await Effect.runPromise(driver.shutdown());
  });
});
