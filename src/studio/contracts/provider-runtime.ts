/**
 * ProviderRuntime event union — the canonical contract every harness driver
 * emits into.
 *
 * Pattern adapted from pingdotgg/t3code (`packages/contracts/src/providerRuntime.ts`).
 * Every event carries the same base envelope so consumers (UI, telemetry,
 * snapshot store, journal, RPC subscribers) can treat the stream uniformly.
 */

import { z } from "zod";
import type {
  EventId,
  HarnessId,
  ProviderInstanceId,
  SessionId,
  ThreadId,
  ToolCallId,
  TurnId,
} from "./ids.js";

export type SessionState =
  | "idle"
  | "starting"
  | "running"
  | "ready"
  | "interrupted"
  | "stopped"
  | "error";

export type TurnState = "pending" | "running" | "done" | "failed";

export type AuthStatus =
  | "missing"
  | "needs_login"
  | "signed_in"
  | "ready"
  | "not_required";

export interface ProviderRuntimeEventBase {
  readonly eventId: EventId;
  readonly seq: number;
  readonly harnessId: HarnessId;
  readonly providerInstanceId: ProviderInstanceId;
  readonly sessionId: SessionId;
  readonly threadId?: ThreadId;
  readonly turnId?: TurnId;
  readonly createdAt: string;
}

export type ProviderRuntimeEvent =
  | SessionLifecycleEvent
  | TurnLifecycleEvent
  | MessageEvent
  | ReasoningEvent
  | ToolEvent
  | ApprovalEvent
  | AuthEvent
  | RateLimitEvent
  | UsageEvent
  | McpEvent
  | DiagnosticEvent
  | StreamEvent;

export type SessionLifecycleEvent = ProviderRuntimeEventBase &
  (
    | { type: "session.created"; harnessConfigSummary: { harness: HarnessId; model?: string; effort?: string } }
    | { type: "session.state.changed"; from: SessionState; to: SessionState; reason?: string }
    | { type: "session.shutdown"; reason: "user" | "error" | "system" }
  );

export type TurnLifecycleEvent = ProviderRuntimeEventBase &
  (
    | { type: "turn.created"; promptPreview: string }
    | { type: "turn.state.changed"; from: TurnState; to: TurnState }
    | { type: "turn.completed"; outcome: "success" | "cancelled" | "error"; error?: string }
  );

export type MessageEvent = ProviderRuntimeEventBase &
  (
    | { type: "message.user"; text: string }
    | { type: "message.assistant.delta"; delta: string }
    | { type: "message.assistant.complete"; text: string }
  );

export type ReasoningEvent = ProviderRuntimeEventBase &
  (
    | { type: "reasoning.delta"; delta: string; effort?: string }
    | { type: "reasoning.complete"; text: string }
  );

export type ToolEvent = ProviderRuntimeEventBase &
  (
    | { type: "tool.call.started"; toolCallId: ToolCallId; tool: string; args: unknown }
    | { type: "tool.call.output"; toolCallId: ToolCallId; chunk: string; stream: "stdout" | "stderr" }
    | { type: "tool.call.completed"; toolCallId: ToolCallId; ok: boolean; result?: unknown; error?: string; elapsedMs: number }
  );

export type ApprovalEvent = ProviderRuntimeEventBase &
  (
    | { type: "approval.requested"; approvalId: string; tool: string; args: unknown; reason: string }
    | { type: "approval.resolved"; approvalId: string; decision: "approved" | "denied"; reason?: string }
  );

export type AuthEvent = ProviderRuntimeEventBase &
  (
    | { type: "auth.status.updated"; status: AuthStatus; message?: string }
  );

export type RateLimitEvent = ProviderRuntimeEventBase &
  (
    | { type: "rate_limit.updated"; state: "ok" | "warning" | "limited" | "unknown"; retryAfterMs?: number; remainingTokens?: number }
  );

export type UsageEvent = ProviderRuntimeEventBase &
  (
    | { type: "usage.updated"; inputTokens: number; outputTokens: number; reasoningTokens?: number; estimatedCostUsd?: number }
  );

export type McpEvent = ProviderRuntimeEventBase &
  (
    | { type: "mcp.status.updated"; serverName: string; status: "connecting" | "ready" | "error" | "disconnected"; message?: string }
    | { type: "mcp.tool.registered"; serverName: string; toolName: string; description?: string }
  );

export type DiagnosticEvent = ProviderRuntimeEventBase &
  (
    | { type: "diagnostic.warn"; message: string; data?: unknown }
    | { type: "diagnostic.error"; message: string; data?: unknown }
  );

export type StreamEvent = ProviderRuntimeEventBase &
  (
    | { type: "stream.heartbeat" }
  );

export type ProviderRuntimeEventType = ProviderRuntimeEvent["type"];

export const PROVIDER_RUNTIME_EVENT_TYPES: readonly ProviderRuntimeEventType[] = [
  "session.created",
  "session.state.changed",
  "session.shutdown",
  "turn.created",
  "turn.state.changed",
  "turn.completed",
  "message.user",
  "message.assistant.delta",
  "message.assistant.complete",
  "reasoning.delta",
  "reasoning.complete",
  "tool.call.started",
  "tool.call.output",
  "tool.call.completed",
  "approval.requested",
  "approval.resolved",
  "auth.status.updated",
  "rate_limit.updated",
  "usage.updated",
  "mcp.status.updated",
  "mcp.tool.registered",
  "diagnostic.warn",
  "diagnostic.error",
  "stream.heartbeat",
] as const;

const idString = z.string().min(1);
const isoTimestamp = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "must be an ISO-8601 timestamp",
});

const baseSchema = z.object({
  eventId: idString,
  seq: z.number().int().nonnegative(),
  harnessId: idString,
  providerInstanceId: idString,
  sessionId: idString,
  threadId: idString.optional(),
  turnId: idString.optional(),
  createdAt: isoTimestamp,
});

export const providerRuntimeEventSchema = z
  .object({
    type: z.enum(PROVIDER_RUNTIME_EVENT_TYPES as [string, ...string[]]),
  })
  .and(baseSchema)
  .and(z.record(z.string(), z.unknown()))
  .superRefine((value, ctx) => {
    const { type } = value as { type: string };
    if (!PROVIDER_RUNTIME_EVENT_TYPES.includes(type as ProviderRuntimeEventType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `unknown ProviderRuntimeEvent type: ${type}`,
      });
    }
  });

export function parseProviderRuntimeEvent(raw: unknown): ProviderRuntimeEvent {
  const parsed = providerRuntimeEventSchema.parse(raw);
  return parsed as unknown as ProviderRuntimeEvent;
}

export function safeParseProviderRuntimeEvent(
  raw: unknown,
):
  | { ok: true; event: ProviderRuntimeEvent }
  | { ok: false; error: string } {
  const result = providerRuntimeEventSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, event: result.data as unknown as ProviderRuntimeEvent };
  }
  return { ok: false, error: result.error.message };
}
