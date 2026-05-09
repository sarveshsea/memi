import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { EventBus } from "../event-bus.js";
import { CodexDriver, CODEX_HARNESS_ID, type CodexTransport } from "../drivers/codex.js";
import { asId, makeId } from "../contracts/ids.js";
import type { ProviderRuntimeEvent } from "../contracts/provider-runtime.js";

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

function makeBaseEvent(overrides: Partial<ProviderRuntimeEvent> = {}): ProviderRuntimeEvent {
  return {
    eventId: asId("EventId", makeId("EventId")),
    seq: 1,
    harnessId: asId("HarnessId", "hns_codex"),
    providerInstanceId: asId("ProviderInstanceId", "prv_x"),
    sessionId: asId("SessionId", "ses_x"),
    createdAt: new Date().toISOString(),
    type: "stream.heartbeat",
    ...overrides,
  } as ProviderRuntimeEvent;
}

describe("event-bus", () => {
  it("subscribers receive published events", () => {
    const bus = new EventBus();
    const seen: ProviderRuntimeEvent[] = [];
    bus.subscribe((event) => seen.push(event));
    bus.publish(makeBaseEvent());
    expect(seen.length).toBe(1);
  });

  it("unsubscribe stops further deliveries", () => {
    const bus = new EventBus();
    const seen: ProviderRuntimeEvent[] = [];
    const sub = bus.subscribe((event) => seen.push(event));
    bus.publish(makeBaseEvent());
    sub.unsubscribe();
    bus.publish(makeBaseEvent());
    expect(seen.length).toBe(1);
  });

  it("multiple subscribers each receive every event", () => {
    const bus = new EventBus();
    const a: ProviderRuntimeEvent[] = [];
    const b: ProviderRuntimeEvent[] = [];
    bus.subscribe((e) => a.push(e));
    bus.subscribe((e) => b.push(e));
    bus.publish(makeBaseEvent());
    expect(a.length).toBe(1);
    expect(b.length).toBe(1);
  });

  it("filter by event type drops non-matching events", () => {
    const bus = new EventBus();
    const seen: ProviderRuntimeEvent[] = [];
    bus.subscribeFiltered((e) => seen.push(e), { types: ["tool.call.started"] });
    bus.publish(makeBaseEvent({ type: "stream.heartbeat" }));
    bus.publish(
      makeBaseEvent({
        type: "tool.call.started",
        toolCallId: asId("ToolCallId", "tcl_x"),
        tool: "Bash",
        args: {},
      } as Partial<ProviderRuntimeEvent>),
    );
    expect(seen.length).toBe(1);
    expect(seen[0].type).toBe("tool.call.started");
  });

  it("filter by sessionId scopes a subscriber", () => {
    const bus = new EventBus();
    const seen: ProviderRuntimeEvent[] = [];
    bus.subscribeFiltered((e) => seen.push(e), { sessionId: "ses_target" });
    bus.publish(makeBaseEvent({ sessionId: asId("SessionId", "ses_other") }));
    bus.publish(makeBaseEvent({ sessionId: asId("SessionId", "ses_target") }));
    expect(seen.length).toBe(1);
  });

  it("filter by harnessId scopes a subscriber", () => {
    const bus = new EventBus();
    const seen: ProviderRuntimeEvent[] = [];
    bus.subscribeFiltered((e) => seen.push(e), { harnessId: "hns_codex" });
    bus.publish(makeBaseEvent({ harnessId: asId("HarnessId", "hns_claude-code") }));
    bus.publish(makeBaseEvent({ harnessId: asId("HarnessId", "hns_codex") }));
    expect(seen.length).toBe(1);
  });

  it("custom predicate filter runs after type/session/harness filters", () => {
    const bus = new EventBus();
    const seen: ProviderRuntimeEvent[] = [];
    bus.subscribeFiltered((e) => seen.push(e), {
      types: ["tool.call.started"],
      predicate: (e) => (e as { tool?: string }).tool === "Write",
    });
    bus.publish(
      makeBaseEvent({
        type: "tool.call.started",
        toolCallId: asId("ToolCallId", "tcl_x"),
        tool: "Read",
        args: {},
      } as Partial<ProviderRuntimeEvent>),
    );
    bus.publish(
      makeBaseEvent({
        type: "tool.call.started",
        toolCallId: asId("ToolCallId", "tcl_y"),
        tool: "Write",
        args: {},
      } as Partial<ProviderRuntimeEvent>),
    );
    expect(seen.length).toBe(1);
    expect((seen[0] as { tool: string }).tool).toBe("Write");
  });

  it("subscriber error does not affect other subscribers", () => {
    const bus = new EventBus();
    const seen: ProviderRuntimeEvent[] = [];
    bus.subscribe(() => {
      throw new Error("boom");
    });
    bus.subscribe((e) => seen.push(e));
    bus.publish(makeBaseEvent());
    expect(seen.length).toBe(1);
    expect(bus.stats().droppedDueToErrorCount).toBe(1);
  });

  it("stats track subscriber + published counts", () => {
    const bus = new EventBus();
    const sub1 = bus.subscribe(() => {});
    const sub2 = bus.subscribe(() => {});
    bus.publish(makeBaseEvent());
    bus.publish(makeBaseEvent());
    expect(bus.stats().subscriberCount).toBe(2);
    expect(bus.stats().publishedCount).toBe(2);
    sub1.unsubscribe();
    sub2.unsubscribe();
  });

  it("clear removes all subscribers", () => {
    const bus = new EventBus();
    bus.subscribe(() => {});
    bus.subscribe(() => {});
    bus.clear();
    expect(bus.stats().subscriberCount).toBe(0);
  });
});

describe("event-bus / driver integration", () => {
  it("driver publishes every emitted event to the configured bus", async () => {
    const bus = new EventBus();
    const seen: ProviderRuntimeEvent[] = [];
    bus.subscribe((e) => seen.push(e));

    const fake = fakeTransport();
    const driver = new CodexDriver({
      harnessId: CODEX_HARNESS_ID,
      providerInstanceId: asId("ProviderInstanceId", makeId("ProviderInstanceId")),
      sessionId: asId("SessionId", makeId("SessionId")),
      options: { spawnTransport: async () => fake.transport },
      eventBus: bus,
    });

    await Effect.runPromise(driver.start());
    await Effect.runPromise(driver.shutdown());

    // start() emits at least session.created + state changes; shutdown adds more.
    expect(seen.length).toBeGreaterThan(2);
    expect(seen.some((e) => e.type === "session.created")).toBe(true);
  });

  it("worked example: a 'pre-write checkpointer' subscriber fires only on tool.call.started for Write", async () => {
    // Demonstrates the pattern that future commits will use to wire
    // checkpoint-store, hook-runner, walkthrough-writer, etc. to the bus
    // instead of being called explicitly from the tool broker.
    const bus = new EventBus();
    const checkpointed: string[] = [];
    bus.subscribeFiltered(
      (e) => {
        const tool = (e as { tool?: string }).tool;
        if (tool) checkpointed.push(tool);
      },
      {
        types: ["tool.call.started"],
        predicate: (e) => {
          const tool = (e as { tool?: string }).tool;
          return tool === "Write" || tool === "Edit" || tool === "NotebookEdit";
        },
      },
    );

    const fake = fakeTransport();
    const driver = new CodexDriver({
      harnessId: CODEX_HARNESS_ID,
      providerInstanceId: asId("ProviderInstanceId", makeId("ProviderInstanceId")),
      sessionId: asId("SessionId", makeId("SessionId")),
      options: { spawnTransport: async () => fake.transport },
      eventBus: bus,
    });
    await Effect.runPromise(driver.start());

    fake.pushLine(JSON.stringify({ kind: "tool_started", toolCallId: "tcl_1", tool: "Read", args: {} }));
    fake.pushLine(JSON.stringify({ kind: "tool_started", toolCallId: "tcl_2", tool: "Write", args: {} }));
    fake.pushLine(JSON.stringify({ kind: "tool_started", toolCallId: "tcl_3", tool: "Edit", args: {} }));
    fake.pushLine(JSON.stringify({ kind: "tool_started", toolCallId: "tcl_4", tool: "Bash", args: {} }));
    await new Promise((r) => setTimeout(r, 30));

    expect(checkpointed).toEqual(["Write", "Edit"]);
    await Effect.runPromise(driver.shutdown());
  });
});
