import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { ClaudeCodeDriver, CLAUDE_CODE_HARNESS_ID, type ClaudeCodeTransport } from "../../drivers/claude-code.js";
import { asId, makeId } from "../../contracts/ids.js";
import type { ProviderRuntimeEvent } from "../../contracts/provider-runtime.js";

function fakeTransport() {
  const written: string[] = [];
  const lineSubs = new Set<(line: string, stream: "stdout" | "stderr") => void>();
  const exitSubs = new Set<(code: number | null, signal: NodeJS.Signals | null) => void>();

  const transport: ClaudeCodeTransport = {
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

function makeDriver(spawnTransport: () => Promise<ClaudeCodeTransport>) {
  return new ClaudeCodeDriver({
    harnessId: CLAUDE_CODE_HARNESS_ID,
    providerInstanceId: asId("ProviderInstanceId", makeId("ProviderInstanceId")),
    sessionId: asId("SessionId", makeId("SessionId")),
    options: { model: "claude-sonnet-4-6", spawnTransport },
  });
}

function collectEvents(driver: ClaudeCodeDriver, ms = 50): Promise<ProviderRuntimeEvent[]> {
  const events: ProviderRuntimeEvent[] = [];
  const handle = (driver as unknown as { ["subscribers"]: Set<(e: ProviderRuntimeEvent) => void> }).subscribers;
  const cb = (e: ProviderRuntimeEvent) => {
    events.push(e);
  };
  handle.add(cb);
  return new Promise((resolve) => setTimeout(() => resolve(events), ms));
}

describe("drivers/claude-code", () => {
  it("start emits session.created and reaches ready", async () => {
    const fake = fakeTransport();
    const driver = makeDriver(async () => fake.transport);
    await Effect.runPromise(driver.start());
    expect(driver.sessionState()).toBe("ready");
    await Effect.runPromise(driver.shutdown());
  });

  it("sendTurn writes user_turn to transport", async () => {
    const fake = fakeTransport();
    const driver = makeDriver(async () => fake.transport);
    await Effect.runPromise(driver.start());
    const turnId = asId("TurnId", makeId("TurnId"));
    await Effect.runPromise(driver.sendTurn({ turnId, prompt: "explain this code" }));

    expect(driver.sessionState()).toBe("running");
    const sent = JSON.parse(fake.written[0]);
    expect(sent.type).toBe("user_turn");
    expect(sent.prompt).toBe("explain this code");
    await Effect.runPromise(driver.shutdown());
  });

  it("turn_complete returns session to ready", async () => {
    const fake = fakeTransport();
    const driver = makeDriver(async () => fake.transport);
    await Effect.runPromise(driver.start());
    await Effect.runPromise(driver.sendTurn({ turnId: asId("TurnId", makeId("TurnId")), prompt: "hi" }));
    fake.pushLine(JSON.stringify({ type: "turn_complete", ok: true }));
    await new Promise((r) => setTimeout(r, 5));
    expect(driver.sessionState()).toBe("ready");
    await Effect.runPromise(driver.shutdown());
  });

  it("emits canonical tool lifecycle from claude-code event names", async () => {
    const fake = fakeTransport();
    const driver = makeDriver(async () => fake.transport);
    const eventsPromise = collectEvents(driver, 0);
    await Effect.runPromise(driver.start());

    const toolId = makeId("ToolCallId");
    fake.pushLine(JSON.stringify({ type: "tool_use_start", toolCallId: toolId, tool: "Read", input: { path: "x.ts" } }));
    fake.pushLine(JSON.stringify({ type: "tool_use_output", toolCallId: toolId, chunk: "contents", stream: "stdout" }));
    fake.pushLine(JSON.stringify({ type: "tool_use_complete", toolCallId: toolId, ok: true, elapsedMs: 7 }));

    await new Promise((r) => setTimeout(r, 30));
    const collected = await eventsPromise;
    const types = collected.map((e) => e.type);
    expect(types).toContain("tool.call.started");
    expect(types).toContain("tool.call.output");
    expect(types).toContain("tool.call.completed");
    await Effect.runPromise(driver.shutdown());
  });

  it("emits mcp.status.updated for mcp_status events", async () => {
    const fake = fakeTransport();
    const driver = makeDriver(async () => fake.transport);
    const eventsPromise = collectEvents(driver, 0);
    await Effect.runPromise(driver.start());

    fake.pushLine(JSON.stringify({ type: "mcp_status", serverName: "memoire", status: "ready" }));
    await new Promise((r) => setTimeout(r, 20));
    const collected = await eventsPromise;
    expect(collected.some((e) => e.type === "mcp.status.updated")).toBe(true);
    await Effect.runPromise(driver.shutdown());
  });

  it("emits approval.requested for approval_request events", async () => {
    const fake = fakeTransport();
    const driver = makeDriver(async () => fake.transport);
    const eventsPromise = collectEvents(driver, 0);
    await Effect.runPromise(driver.start());

    fake.pushLine(JSON.stringify({ type: "approval_request", approvalId: "ap_1", tool: "Bash", args: { command: "rm" }, reason: "destructive" }));
    await new Promise((r) => setTimeout(r, 20));
    const collected = await eventsPromise;
    expect(collected.some((e) => e.type === "approval.requested")).toBe(true);
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

  it("rejects start without spawnTransport in options", async () => {
    const driver = new ClaudeCodeDriver({
      harnessId: CLAUDE_CODE_HARNESS_ID,
      providerInstanceId: asId("ProviderInstanceId", makeId("ProviderInstanceId")),
      sessionId: asId("SessionId", makeId("SessionId")),
      options: {},
    });
    await expect(Effect.runPromise(driver.start())).rejects.toThrow(/spawnTransport/);
  });
});
