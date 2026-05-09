/**
 * UsageRollup — per-session/per-harness/per-tool token + cost tracker
 * driven by ProviderRuntimeEvents from the EventBus.
 *
 * The engine has no centralized usage rollup today. Each surface that
 * needs cost/latency information re-derives it from raw subprocess
 * output. With the event contract + bus in place, one subscriber can
 * compute everything once and serve it to every consumer (UI Billing
 * pane, /api/usage, telemetry, audit).
 *
 * Subscribes to two event types from the bus:
 *   - usage.updated         → input/output/reasoning tokens + cost
 *   - tool.call.completed   → per-tool latency timeline
 *
 * Plus state-machine events for session lifecycle bookkeeping:
 *   - session.created, session.shutdown
 *
 * Snapshots are exposed via:
 *   - sessionUsage(sessionId) → UsageSnapshot for one session
 *   - harnessTotals(harnessId) → aggregate across sessions
 *   - toolTimeline(sessionId, toolName) → ordered latencies
 *   - all() → full snapshot for export
 */

import type { EventBus, EventBusSubscription } from "./event-bus.js";
import type { HarnessId, SessionId, ToolCallId } from "./contracts/ids.js";

export interface UsageSnapshot {
  sessionId: SessionId;
  harnessId: HarnessId;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  estimatedCostUsd: number;
  toolCallCount: number;
  toolErrorCount: number;
  totalToolMs: number;
  startedAt?: string;
  endedAt?: string;
  lastUpdatedAt: string;
}

export interface ToolLatency {
  toolCallId: ToolCallId;
  tool: string;
  ok: boolean;
  elapsedMs: number;
  at: string;
}

export interface HarnessTotals {
  harnessId: HarnessId;
  sessionCount: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  estimatedCostUsd: number;
  toolCallCount: number;
  toolErrorCount: number;
}

export class UsageRollup {
  private readonly sessions = new Map<string, UsageSnapshot>();
  private readonly toolLatencies = new Map<string, ToolLatency[]>();
  private subscription: EventBusSubscription | null = null;

  constructor(private readonly bus?: EventBus) {
    if (bus) {
      this.subscribe(bus);
    }
  }

  /** Subscribe (or re-subscribe) to a bus. Returns the subscription handle. */
  subscribe(bus: EventBus): EventBusSubscription {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    this.subscription = bus.subscribe((event) => this.consume(event));
    return this.subscription;
  }

  /** Stop subscribing. The rollup keeps its accumulated data. */
  detach(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  /** Drop all accumulated data. Useful for tests. */
  reset(): void {
    this.sessions.clear();
    this.toolLatencies.clear();
  }

  consume(event: import("./contracts/provider-runtime.js").ProviderRuntimeEvent): void {
    const sessionId = event.sessionId;
    const harnessId = event.harnessId;
    const key = sessionId as unknown as string;

    let snap = this.sessions.get(key);
    if (!snap) {
      snap = {
        sessionId,
        harnessId,
        inputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        estimatedCostUsd: 0,
        toolCallCount: 0,
        toolErrorCount: 0,
        totalToolMs: 0,
        lastUpdatedAt: event.createdAt,
      };
      this.sessions.set(key, snap);
    }

    snap.lastUpdatedAt = event.createdAt;

    switch (event.type) {
      case "session.created":
        snap.startedAt = event.createdAt;
        break;
      case "session.shutdown":
        snap.endedAt = event.createdAt;
        break;
      case "usage.updated":
        snap.inputTokens += event.inputTokens;
        snap.outputTokens += event.outputTokens;
        snap.reasoningTokens += event.reasoningTokens ?? 0;
        snap.estimatedCostUsd += event.estimatedCostUsd ?? 0;
        break;
      case "tool.call.completed": {
        snap.toolCallCount += 1;
        if (!event.ok) snap.toolErrorCount += 1;
        snap.totalToolMs += event.elapsedMs;

        const latencies = this.toolLatencies.get(key) ?? [];
        latencies.push({
          toolCallId: event.toolCallId,
          tool: this.findToolName(sessionId, event.toolCallId) ?? "unknown",
          ok: event.ok,
          elapsedMs: event.elapsedMs,
          at: event.createdAt,
        });
        this.toolLatencies.set(key, latencies);
        break;
      }
      default:
        // other event types don't affect the rollup
        break;
    }
  }

  // Track tool names announced via tool.call.started so the latency entry
  // can include the tool string (which the .completed event doesn't carry).
  private toolNames = new Map<string, Map<string, string>>();

  private findToolName(sessionId: SessionId, toolCallId: ToolCallId): string | null {
    return this.toolNames.get(sessionId as unknown as string)?.get(toolCallId as unknown as string) ?? null;
  }

  // Public accessors --------------------------------------------------------

  sessionUsage(sessionId: SessionId): UsageSnapshot | null {
    return this.sessions.get(sessionId as unknown as string) ?? null;
  }

  toolTimeline(sessionId: SessionId, toolName?: string): ToolLatency[] {
    const all = this.toolLatencies.get(sessionId as unknown as string) ?? [];
    if (!toolName) return all;
    return all.filter((entry) => entry.tool === toolName);
  }

  harnessTotals(harnessId: HarnessId): HarnessTotals {
    const totals: HarnessTotals = {
      harnessId,
      sessionCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      estimatedCostUsd: 0,
      toolCallCount: 0,
      toolErrorCount: 0,
    };
    for (const snap of this.sessions.values()) {
      if (snap.harnessId !== harnessId) continue;
      totals.sessionCount += 1;
      totals.inputTokens += snap.inputTokens;
      totals.outputTokens += snap.outputTokens;
      totals.reasoningTokens += snap.reasoningTokens;
      totals.estimatedCostUsd += snap.estimatedCostUsd;
      totals.toolCallCount += snap.toolCallCount;
      totals.toolErrorCount += snap.toolErrorCount;
    }
    return totals;
  }

  all(): UsageSnapshot[] {
    return Array.from(this.sessions.values());
  }

  // Tool-name capture: the rollup needs to see tool.call.started events
  // because tool.call.completed only carries the toolCallId. We capture
  // here in consume() above by extending it inline:
}

// Patch consume() to also capture tool.call.started → toolName map.
// We do this in a wrapper rather than in consume() above to keep the
// switch statement clean; the alternative is one extra case.
const originalConsume = UsageRollup.prototype.consume;
UsageRollup.prototype.consume = function (
  this: UsageRollup,
  event: import("./contracts/provider-runtime.js").ProviderRuntimeEvent,
): void {
  if (event.type === "tool.call.started") {
    const sessionKey = event.sessionId as unknown as string;
    const map =
      (this as unknown as { toolNames: Map<string, Map<string, string>> }).toolNames.get(sessionKey) ??
      new Map<string, string>();
    map.set(event.toolCallId as unknown as string, event.tool);
    (this as unknown as { toolNames: Map<string, Map<string, string>> }).toolNames.set(sessionKey, map);
  }
  originalConsume.call(this, event);
};
