/**
 * Turn state machine. Models the lifecycle of a single agent turn within a session.
 *
 * Sibling of `session-machine.ts`. Keeping them separate (rather than nesting
 * turn state inside session state) matches t3code's split.
 */

import type { TurnState } from "../contracts/provider-runtime.js";

export type TurnEvent =
  | { type: "begin" }
  | { type: "complete" }
  | { type: "fail"; reason: string }
  | { type: "cancel" };

export interface TurnTransition {
  readonly from: TurnState;
  readonly to: TurnState;
  readonly event: TurnEvent;
  readonly at: string;
}

const ALLOWED: ReadonlyMap<TurnState, ReadonlyArray<TurnEvent["type"]>> = new Map([
  ["pending", ["begin", "cancel", "fail"]],
  ["running", ["complete", "fail", "cancel"]],
  ["done", []],
  ["failed", []],
]);

export function nextTurnState(current: TurnState, event: TurnEvent): TurnState {
  const allowed = ALLOWED.get(current) ?? [];
  if (!allowed.includes(event.type)) {
    throw new Error(
      `turn-machine: invalid transition from "${current}" via "${event.type}"`,
    );
  }
  switch (event.type) {
    case "begin":
      return "running";
    case "complete":
      return "done";
    case "fail":
      return "failed";
    case "cancel":
      return "failed";
  }
}

export function canTransition(current: TurnState, event: TurnEvent): boolean {
  const allowed = ALLOWED.get(current) ?? [];
  return allowed.includes(event.type);
}

export function isTerminal(state: TurnState): boolean {
  return state === "done" || state === "failed";
}

export class TurnMachine {
  private state: TurnState;
  private readonly history: TurnTransition[] = [];

  constructor(initial: TurnState = "pending") {
    this.state = initial;
  }

  current(): TurnState {
    return this.state;
  }

  send(event: TurnEvent): TurnTransition {
    const from = this.state;
    const to = nextTurnState(from, event);
    const transition: TurnTransition = {
      from,
      to,
      event,
      at: new Date().toISOString(),
    };
    this.state = to;
    this.history.push(transition);
    return transition;
  }

  log(): readonly TurnTransition[] {
    return this.history;
  }
}
