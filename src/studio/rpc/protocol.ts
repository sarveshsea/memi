/**
 * RPC protocol — typed operation envelope for the new WebSocket surface.
 *
 * Pattern adapted from t3code's orchestration RPC. Replaces the engine's
 * current ~50 hand-coded `if (req.method === ... && req.url === ...)`
 * branches in src/studio/server.ts with a typed operation discriminator
 * + per-operation request/response shapes.
 *
 * This commit ships the protocol + an in-memory handler so consumers can
 * use the new surface today via the in-process API. Mounting on the
 * WebSocket server.ts upgrade path is a separate follow-up commit
 * (the existing HTTP router has many entanglements with workspace state
 * that aren't worth breaking on the same diff). The protocol is locked
 * here so the mount is mechanical when it lands.
 */

import { z } from "zod";
import type { SessionId, ThreadId, TurnId } from "../contracts/ids.js";
import type { ProviderRuntimeEvent } from "../contracts/provider-runtime.js";

// ────────────────────────────────────────────────────────────────────────────
// Operation discriminator
// ────────────────────────────────────────────────────────────────────────────

export type RpcOperation =
  | "dispatchCommand"
  | "subscribeThread"
  | "replayEvents"
  | "subscribeShell"
  | "getTurnDiff";

// ────────────────────────────────────────────────────────────────────────────
// Request shapes
// ────────────────────────────────────────────────────────────────────────────

export interface DispatchCommandRequest {
  readonly op: "dispatchCommand";
  readonly requestId: string;
  readonly sessionId: SessionId;
  readonly threadId?: ThreadId;
  readonly command: "start" | "sendTurn" | "interrupt" | "shutdown";
  /** Per-command payload. For sendTurn: { turnId, prompt, attachments? }. */
  readonly payload?: Record<string, unknown>;
}

export interface SubscribeThreadRequest {
  readonly op: "subscribeThread";
  readonly requestId: string;
  readonly sessionId: SessionId;
  readonly threadId?: ThreadId;
  /** Optional cursor — start from this seq onward. Default: live tail only. */
  readonly fromSeq?: number;
}

export interface ReplayEventsRequest {
  readonly op: "replayEvents";
  readonly requestId: string;
  readonly sessionId: SessionId;
  readonly fromSeq?: number;
}

export interface SubscribeShellRequest {
  readonly op: "subscribeShell";
  readonly requestId: string;
  readonly sessionId: SessionId;
  readonly turnId?: TurnId;
}

export interface GetTurnDiffRequest {
  readonly op: "getTurnDiff";
  readonly requestId: string;
  readonly sessionId: SessionId;
  readonly turnId: TurnId;
}

export type RpcRequest =
  | DispatchCommandRequest
  | SubscribeThreadRequest
  | ReplayEventsRequest
  | SubscribeShellRequest
  | GetTurnDiffRequest;

// ────────────────────────────────────────────────────────────────────────────
// Response shapes
// ────────────────────────────────────────────────────────────────────────────

export interface RpcAck {
  readonly kind: "ack";
  readonly requestId: string;
}

export interface RpcEvent {
  readonly kind: "event";
  readonly requestId: string;
  readonly event: ProviderRuntimeEvent;
}

export interface RpcEnd {
  readonly kind: "end";
  readonly requestId: string;
  readonly reason?: string;
}

export interface RpcError {
  readonly kind: "error";
  readonly requestId: string;
  readonly error: string;
  readonly errorTag?: string;
}

export interface RpcResult {
  readonly kind: "result";
  readonly requestId: string;
  readonly result: unknown;
}

export type RpcResponse = RpcAck | RpcEvent | RpcEnd | RpcError | RpcResult;

// ────────────────────────────────────────────────────────────────────────────
// Wire format Zod schemas — used by the WebSocket handler to validate
// incoming JSON messages before dispatch.
// ────────────────────────────────────────────────────────────────────────────

const baseRequest = z.object({
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
});

export const dispatchCommandSchema = baseRequest.extend({
  op: z.literal("dispatchCommand"),
  threadId: z.string().min(1).optional(),
  command: z.enum(["start", "sendTurn", "interrupt", "shutdown"]),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const subscribeThreadSchema = baseRequest.extend({
  op: z.literal("subscribeThread"),
  threadId: z.string().min(1).optional(),
  fromSeq: z.number().int().nonnegative().optional(),
});

export const replayEventsSchema = baseRequest.extend({
  op: z.literal("replayEvents"),
  fromSeq: z.number().int().nonnegative().optional(),
});

export const subscribeShellSchema = baseRequest.extend({
  op: z.literal("subscribeShell"),
  turnId: z.string().min(1).optional(),
});

export const getTurnDiffSchema = baseRequest.extend({
  op: z.literal("getTurnDiff"),
  turnId: z.string().min(1),
});

export const rpcRequestSchema = z.discriminatedUnion("op", [
  dispatchCommandSchema,
  subscribeThreadSchema,
  replayEventsSchema,
  subscribeShellSchema,
  getTurnDiffSchema,
]);

export function parseRpcRequest(raw: unknown): RpcRequest {
  return rpcRequestSchema.parse(raw) as unknown as RpcRequest;
}

export function safeParseRpcRequest(
  raw: unknown,
):
  | { ok: true; req: RpcRequest }
  | { ok: false; error: string } {
  const result = rpcRequestSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, req: result.data as unknown as RpcRequest };
  }
  return { ok: false, error: result.error.message };
}
