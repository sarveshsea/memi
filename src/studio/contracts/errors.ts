/**
 * Typed error union for the harness layer.
 *
 * Adapted from t3code's typed error pattern. Drivers return `Effect<R, HarnessError, A>`
 * so callers get exhaustive error matching at the type level instead of `try { } catch (e: unknown)`.
 */

import type { HarnessId, SessionId, TurnId } from "./ids.js";

export type HarnessErrorTag =
  | "HarnessAuthError"
  | "HarnessRateLimitError"
  | "HarnessTimeoutError"
  | "HarnessCancelledError"
  | "HarnessSubprocessError"
  | "HarnessProtocolError"
  | "HarnessConfigError"
  | "HarnessUnknownError";

export interface HarnessErrorBase {
  readonly _tag: HarnessErrorTag;
  readonly harnessId: HarnessId;
  readonly sessionId?: SessionId;
  readonly turnId?: TurnId;
  readonly message: string;
  readonly cause?: unknown;
}

export interface HarnessAuthError extends HarnessErrorBase {
  readonly _tag: "HarnessAuthError";
  readonly authStatus: "missing" | "expired" | "needs_login" | "forbidden";
}

export interface HarnessRateLimitError extends HarnessErrorBase {
  readonly _tag: "HarnessRateLimitError";
  readonly retryAfterMs?: number;
  readonly remainingTokens?: number;
}

export interface HarnessTimeoutError extends HarnessErrorBase {
  readonly _tag: "HarnessTimeoutError";
  readonly timeoutMs: number;
}

export interface HarnessCancelledError extends HarnessErrorBase {
  readonly _tag: "HarnessCancelledError";
  readonly reason: "user" | "parent-cancelled" | "system-shutdown";
}

export interface HarnessSubprocessError extends HarnessErrorBase {
  readonly _tag: "HarnessSubprocessError";
  readonly exitCode: number | null;
  readonly signal?: NodeJS.Signals | null;
  readonly stderrTail?: string;
}

export interface HarnessProtocolError extends HarnessErrorBase {
  readonly _tag: "HarnessProtocolError";
  readonly receivedShape?: string;
}

export interface HarnessConfigError extends HarnessErrorBase {
  readonly _tag: "HarnessConfigError";
  readonly configKey?: string;
}

export interface HarnessUnknownError extends HarnessErrorBase {
  readonly _tag: "HarnessUnknownError";
}

export type HarnessError =
  | HarnessAuthError
  | HarnessRateLimitError
  | HarnessTimeoutError
  | HarnessCancelledError
  | HarnessSubprocessError
  | HarnessProtocolError
  | HarnessConfigError
  | HarnessUnknownError;

export function isHarnessError(value: unknown): value is HarnessError {
  if (typeof value !== "object" || value === null) return false;
  const tag = (value as { _tag?: unknown })._tag;
  if (typeof tag !== "string") return false;
  return (
    tag === "HarnessAuthError" ||
    tag === "HarnessRateLimitError" ||
    tag === "HarnessTimeoutError" ||
    tag === "HarnessCancelledError" ||
    tag === "HarnessSubprocessError" ||
    tag === "HarnessProtocolError" ||
    tag === "HarnessConfigError" ||
    tag === "HarnessUnknownError"
  );
}

export function harnessAuthError(
  args: Omit<HarnessAuthError, "_tag">,
): HarnessAuthError {
  return { _tag: "HarnessAuthError", ...args };
}

export function harnessRateLimitError(
  args: Omit<HarnessRateLimitError, "_tag">,
): HarnessRateLimitError {
  return { _tag: "HarnessRateLimitError", ...args };
}

export function harnessTimeoutError(
  args: Omit<HarnessTimeoutError, "_tag">,
): HarnessTimeoutError {
  return { _tag: "HarnessTimeoutError", ...args };
}

export function harnessCancelledError(
  args: Omit<HarnessCancelledError, "_tag">,
): HarnessCancelledError {
  return { _tag: "HarnessCancelledError", ...args };
}

export function harnessSubprocessError(
  args: Omit<HarnessSubprocessError, "_tag">,
): HarnessSubprocessError {
  return { _tag: "HarnessSubprocessError", ...args };
}

export function harnessProtocolError(
  args: Omit<HarnessProtocolError, "_tag">,
): HarnessProtocolError {
  return { _tag: "HarnessProtocolError", ...args };
}

export function harnessConfigError(
  args: Omit<HarnessConfigError, "_tag">,
): HarnessConfigError {
  return { _tag: "HarnessConfigError", ...args };
}

export function harnessUnknownError(
  args: Omit<HarnessUnknownError, "_tag">,
): HarnessUnknownError {
  return { _tag: "HarnessUnknownError", ...args };
}

export function fromUnknown(
  unknown: unknown,
  ctx: { harnessId: HarnessId; sessionId?: SessionId; turnId?: TurnId },
): HarnessError {
  if (isHarnessError(unknown)) return unknown;
  const message = unknown instanceof Error ? unknown.message : String(unknown);
  return harnessUnknownError({ ...ctx, message, cause: unknown });
}
