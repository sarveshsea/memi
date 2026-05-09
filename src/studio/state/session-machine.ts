/**
 * Session state machine. Models the lifecycle of a single harness session.
 *
 * Pattern adapted from t3code's `OrchestrationSession`. We use a tiny
 * discriminated-union reducer rather than XState — fewer than 100 lines,
 * zero deps, fully type-checked transitions.
 */

import type { SessionState } from "../contracts/provider-runtime.js";

export type SessionEvent =
  | { type: "start" }
  | { type: "ready" }
  | { type: "turn.begin" }
  | { type: "turn.end" }
  | { type: "interrupt" }
  | { type: "resume" }
  | { type: "shutdown" }
  | { type: "fail"; reason: string };

export interface SessionTransition {
  readonly from: SessionState;
  readonly to: SessionState;
  readonly event: SessionEvent;
  readonly at: string;
}

const ALLOWED: ReadonlyMap<SessionState, ReadonlyArray<SessionEvent["type"]>> = new Map([
  ["idle", ["start", "shutdown", "fail"]],
  ["starting", ["ready", "fail", "shutdown"]],
  ["ready", ["turn.begin", "interrupt", "shutdown", "fail"]],
  ["running", ["turn.end", "interrupt", "fail", "shutdown"]],
  ["interrupted", ["resume", "shutdown", "fail"]],
  ["stopped", []],
  ["error", ["shutdown"]],
]);

export function nextSessionState(
  current: SessionState,
  event: SessionEvent,
): SessionState {
  const allowed = ALLOWED.get(current) ?? [];
  if (!allowed.includes(event.type)) {
    throw new Error(
      `session-machine: invalid transition from "${current}" via "${event.type}"`,
    );
  }

  switch (event.type) {
    case "start":
      return "starting";
    case "ready":
      return "ready";
    case "turn.begin":
      return "running";
    case "turn.end":
      return "ready";
    case "interrupt":
      return "interrupted";
    case "resume":
      return "ready";
    case "shutdown":
      return "stopped";
    case "fail":
      return "error";
  }
}

export function canTransition(current: SessionState, event: SessionEvent): boolean {
  const allowed = ALLOWED.get(current) ?? [];
  return allowed.includes(event.type);
}

export function isTerminal(state: SessionState): boolean {
  return state === "stopped";
}

export class SessionMachine {
  private state: SessionState;
  private readonly history: SessionTransition[] = [];

  constructor(initial: SessionState = "idle") {
    this.state = initial;
  }

  current(): SessionState {
    return this.state;
  }

  send(event: SessionEvent): SessionTransition {
    const from = this.state;
    const to = nextSessionState(from, event);
    const transition: SessionTransition = {
      from,
      to,
      event,
      at: new Date().toISOString(),
    };
    this.state = to;
    this.history.push(transition);
    return transition;
  }

  log(): readonly SessionTransition[] {
    return this.history;
  }
}
