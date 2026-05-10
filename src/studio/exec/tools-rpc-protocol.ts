/**
 * Tools-RPC wire format — newline-delimited JSON between the agent host
 * (parent) and a Bun child process running an `execute_code` script.
 *
 * Pattern adapted from Hermes Agent's hermes_tools RPC. The script
 * imports a generated `memi_tools.ts` stub that translates each tool
 * call into a JSON request over a Unix domain socket; the parent runs
 * the actual tool against the engine's broker and sends back the
 * result. The script's perspective is "I'm calling local async
 * functions"; in reality every call round-trips to the parent.
 *
 * Why this matters: a multi-step pipeline that today costs N LLM turns
 * (one per tool call) collapses to ONE LLM turn. The model emits one
 * `execute_code` invocation; the script then runs as many tool calls
 * as it needs, all driven by deterministic code, all out of band of
 * the model's reasoning budget.
 *
 * Wire format:
 *   request:  { id: number, op: "tool", tool: string, args: unknown }
 *   request:  { id: number, op: "log", level: "info"|"warn"|"error", message: string }
 *   request:  { id: number, op: "exit", ok: boolean, result?: unknown, error?: string }
 *   response: { id: number, ok: boolean, result?: unknown, error?: string }
 *
 * Each message is a single JSON object on its own line (newline-
 * terminated). The parent multiplexes responses to the correct script-
 * side promise via `id`.
 */

import { z } from "zod";

// ────────────────────────────────────────────────────────────────────────────
// Request shapes (script → parent)
// ────────────────────────────────────────────────────────────────────────────

export interface ToolRequest {
  readonly id: number;
  readonly op: "tool";
  readonly tool: string;
  readonly args: unknown;
}

export interface LogRequest {
  readonly id: number;
  readonly op: "log";
  readonly level: "info" | "warn" | "error";
  readonly message: string;
  readonly data?: unknown;
}

export interface ExitRequest {
  readonly id: number;
  readonly op: "exit";
  readonly ok: boolean;
  readonly result?: unknown;
  readonly error?: string;
}

export type ToolsRpcRequest = ToolRequest | LogRequest | ExitRequest;

// ────────────────────────────────────────────────────────────────────────────
// Response shape (parent → script)
// ────────────────────────────────────────────────────────────────────────────

export interface ToolsRpcResponse {
  readonly id: number;
  readonly ok: boolean;
  readonly result?: unknown;
  readonly error?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Zod schemas for validation
// ────────────────────────────────────────────────────────────────────────────

const baseRequest = z.object({
  id: z.number().int().nonnegative(),
});

export const toolRequestSchema = baseRequest.extend({
  op: z.literal("tool"),
  tool: z.string().min(1),
  args: z.unknown(),
});

export const logRequestSchema = baseRequest.extend({
  op: z.literal("log"),
  level: z.enum(["info", "warn", "error"]),
  message: z.string(),
  data: z.unknown().optional(),
});

export const exitRequestSchema = baseRequest.extend({
  op: z.literal("exit"),
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: z.string().optional(),
});

export const toolsRpcRequestSchema = z.discriminatedUnion("op", [
  toolRequestSchema,
  logRequestSchema,
  exitRequestSchema,
]);

export const toolsRpcResponseSchema = baseRequest.extend({
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: z.string().optional(),
});

export function parseRequest(raw: unknown): ToolsRpcRequest {
  return toolsRpcRequestSchema.parse(raw) as ToolsRpcRequest;
}

export function safeParseRequest(
  raw: unknown,
):
  | { ok: true; req: ToolsRpcRequest }
  | { ok: false; error: string } {
  const result = toolsRpcRequestSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, req: result.data as ToolsRpcRequest };
  }
  return { ok: false, error: result.error.message };
}

/**
 * Encode a single message for the wire. Always ends with `\n` so the
 * receiver's line-buffered reader can split cleanly.
 */
export function encodeMessage(msg: ToolsRpcRequest | ToolsRpcResponse): string {
  return JSON.stringify(msg) + "\n";
}

/**
 * Decode a chunk of wire data into messages. Buffers partial lines via
 * the `state` argument; pass the same state object across chunks.
 */
export interface DecoderState {
  buffer: string;
}

export function createDecoderState(): DecoderState {
  return { buffer: "" };
}

export function decodeChunk(state: DecoderState, chunk: string): unknown[] {
  state.buffer += chunk;
  const messages: unknown[] = [];
  let newlineIdx: number;
  while ((newlineIdx = state.buffer.indexOf("\n")) !== -1) {
    const line = state.buffer.slice(0, newlineIdx);
    state.buffer = state.buffer.slice(newlineIdx + 1);
    if (!line.trim()) continue;
    try {
      messages.push(JSON.parse(line));
    } catch {
      // skip malformed lines; the receiver should log them as diagnostic
    }
  }
  return messages;
}
