/**
 * Branded entity IDs for the harness/runtime contract.
 *
 * Pattern adapted from pingdotgg/t3code (`packages/contracts/src/baseSchemas.ts`).
 * Branded string types prevent accidentally passing a SessionId where a TurnId
 * is expected — caught at compile time, zero runtime cost.
 */

import { randomUUID } from "node:crypto";

declare const brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type HarnessId = Brand<string, "HarnessId">;
export type ProviderInstanceId = Brand<string, "ProviderInstanceId">;
export type SessionId = Brand<string, "SessionId">;
export type ThreadId = Brand<string, "ThreadId">;
export type TurnId = Brand<string, "TurnId">;
export type ToolCallId = Brand<string, "ToolCallId">;
export type EventId = Brand<string, "EventId">;
export type WorkspaceId = Brand<string, "WorkspaceId">;

export type AnyEntityId =
  | HarnessId
  | ProviderInstanceId
  | SessionId
  | ThreadId
  | TurnId
  | ToolCallId
  | EventId
  | WorkspaceId;

const PREFIXES = {
  HarnessId: "hns",
  ProviderInstanceId: "prv",
  SessionId: "ses",
  ThreadId: "thr",
  TurnId: "trn",
  ToolCallId: "tcl",
  EventId: "evt",
  WorkspaceId: "wsp",
} as const;

type EntityKind = keyof typeof PREFIXES;

export function makeId<K extends EntityKind>(kind: K): Brand<string, K> {
  const prefix = PREFIXES[kind];
  return `${prefix}_${randomUUID().replace(/-/g, "")}` as Brand<string, K>;
}

export function asId<K extends EntityKind>(kind: K, raw: string): Brand<string, K> {
  const expected = PREFIXES[kind];
  if (!raw.startsWith(`${expected}_`)) {
    throw new Error(
      `id-mismatch: expected ${kind} prefix "${expected}_", got "${raw.slice(0, 8)}…"`,
    );
  }
  return raw as Brand<string, K>;
}

export function isId<K extends EntityKind>(kind: K, raw: unknown): raw is Brand<string, K> {
  return typeof raw === "string" && raw.startsWith(`${PREFIXES[kind]}_`);
}

export function entityKindOf(raw: string): EntityKind | null {
  const prefix = raw.split("_", 1)[0];
  for (const [kind, p] of Object.entries(PREFIXES) as Array<[EntityKind, string]>) {
    if (p === prefix) return kind;
  }
  return null;
}
