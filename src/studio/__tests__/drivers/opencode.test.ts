import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { OpenCodeDriver, OPENCODE_HARNESS_ID, type OpenCodeTransport } from "../../drivers/opencode.js";
import { asId, makeId } from "../../contracts/ids.js";
import type { ProviderRuntimeEvent } from "../../contracts/provider-runtime.js";

function fakeTransport() {
  const written: string[] = [];
  const lineSubs = new Set<(line: string, stream: "stdout" | "stderr") => void>();
  const exitSubs = new Set<(code: number | null, signal: NodeJS.Signals | null) => void>();

  const transport: OpenCodeTransport = {
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
    pushLine: (line: string, stream: "stdout" | "stderr" = "stdout") => {
      for (const cb of lineSubs) cb(line, stream);
    },
    pushExit: (code: number | null, signal: NodeJS.Signals | null = null) => {
      for (const cb of exitSubs) cb(code, signal);
    },
  };
}

function makeDriver(spawnTransport: () => Promise<OpenCodeTransport>) {
  return new OpenCodeDriver({
    harnessId: OPENCODE_HARNESS_ID,
    providerInstanceId: asId("ProviderInstanceId", makeId("ProviderInstanceId")),
    sessionId: asId("SessionId", makeId("SessionId")),
    options: { model: "gpt-5.5", spawnTransport },
  });
}

describe("drivers/opencode", () => {
  it("start emits session.created and reaches ready", async () => {
    const fake = fakeTransport();
    const driver = makeDriver(async () => fake.transport);
    await Effect.runPromise(driver.start());
    expect(driver.sessionState()).toBe("ready");
    await Effect.runPromise(driver.shutdown());
  });

  it("sendTurn writes user_turn and transitions to running", async () => {
    const fake = fakeTransport();
    const driver = makeDriver(async () => fake.transport);
    await Effect.runPromise(driver.start());
    await Effect.runPromise(driver.sendTurn({ turnId: asId("TurnId", makeId("TurnId")), prompt: "fix it" }));
    expect(driver.sessionState()).toBe("running");
    expect(JSON.parse(fake.written[0]).kind).toBe("user_turn");
    await Effect.runPromise(driver.shutdown());
  });

  it("turn_completed returns to ready", async () => {
    const fake = fakeTransport();
    const driver = makeDriver(async () => fake.transport);
    await Effect.runPromise(driver.start());
    await Effect.runPromise(driver.sendTurn({ turnId: asId("TurnId", makeId("TurnId")), prompt: "hi" }));
    fake.pushLine(JSON.stringify({ kind: "turn_completed", ok: true }));
    await new Promise((r) => setTimeout(r, 5));
    expect(driver.sessionState()).toBe("ready");
    await Effect.runPromise(driver.shutdown());
  });

  it("non-zero exit moves session to error", async () => {
    const fake = fakeTransport();
    const driver = makeDriver(async () => fake.transport);
    await Effect.runPromise(driver.start());
    fake.pushExit(2, null);
    await new Promise((r) => setTimeout(r, 5));
    expect(driver.sessionState()).toBe("error");
  });

  it("rejects start without spawnTransport", async () => {
    const driver = new OpenCodeDriver({
      harnessId: OPENCODE_HARNESS_ID,
      providerInstanceId: asId("ProviderInstanceId", makeId("ProviderInstanceId")),
      sessionId: asId("SessionId", makeId("SessionId")),
      options: {},
    });
    await expect(Effect.runPromise(driver.start())).rejects.toThrow(/spawnTransport/);
  });
});
