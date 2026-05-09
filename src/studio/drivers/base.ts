/**
 * HarnessDriver — abstract base contract every harness implementation honors.
 *
 * Pattern adapted from t3code's `ProviderDriver`. Each driver wraps one CLI
 * (codex, claude-code, opencode, hermes, openclaw, ollama, gemini) and emits
 * canonical `ProviderRuntimeEvent`s into an Effect Stream.
 *
 * The base class owns:
 *   - the SessionMachine and per-turn TurnMachine
 *   - monotonic event sequencing
 *   - event emission helpers that stamp envelope fields automatically
 *   - typed error mapping
 *
 * Subclasses implement transport: subprocess management, stdout parsing,
 * stdin marshalling, cancellation. Subclasses do not handle event envelope
 * boilerplate.
 */

import { Effect, Stream } from "effect";
import {
  asId,
  makeId,
  type EventId,
  type HarnessId,
  type ProviderInstanceId,
  type SessionId,
  type ThreadId,
  type ToolCallId,
  type TurnId,
} from "../contracts/ids.js";
import {
  fromUnknown,
  type HarnessError,
} from "../contracts/errors.js";
import type {
  ProviderRuntimeEvent,
  ProviderRuntimeEventBase,
  SessionState,
} from "../contracts/provider-runtime.js";
import { SessionMachine } from "../state/session-machine.js";
import { TurnMachine } from "../state/turn-machine.js";

export interface HarnessDriverConfig {
  readonly harnessId: HarnessId;
  readonly providerInstanceId: ProviderInstanceId;
  readonly sessionId: SessionId;
  readonly threadId?: ThreadId;
  /** Implementation-specific knobs (model, effort, base URL, env). */
  readonly options?: Record<string, unknown>;
}

export interface HarnessTurnRequest {
  readonly turnId: TurnId;
  readonly prompt: string;
  readonly attachments?: ReadonlyArray<{ kind: string; ref: string }>;
}

export interface HarnessDriver {
  readonly config: HarnessDriverConfig;
  start(): Effect.Effect<void, HarnessError>;
  sendTurn(req: HarnessTurnRequest): Effect.Effect<void, HarnessError>;
  interrupt(reason?: string): Effect.Effect<void, HarnessError>;
  shutdown(): Effect.Effect<void, HarnessError>;
  events(): Stream.Stream<ProviderRuntimeEvent, HarnessError>;
  sessionState(): SessionState;
}

type EventEmitter = (event: ProviderRuntimeEvent) => void;

export abstract class BaseHarnessDriver implements HarnessDriver {
  readonly config: HarnessDriverConfig;
  protected readonly session: SessionMachine;
  protected currentTurn: TurnMachine | null = null;
  protected currentTurnId: TurnId | null = null;
  private seq = 0;
  private readonly subscribers = new Set<EventEmitter>();
  private finalized = false;

  constructor(config: HarnessDriverConfig) {
    this.config = config;
    this.session = new SessionMachine("idle");
  }

  abstract start(): Effect.Effect<void, HarnessError>;
  abstract sendTurn(req: HarnessTurnRequest): Effect.Effect<void, HarnessError>;
  abstract interrupt(reason?: string): Effect.Effect<void, HarnessError>;
  abstract shutdown(): Effect.Effect<void, HarnessError>;

  sessionState(): SessionState {
    return this.session.current();
  }

  events(): Stream.Stream<ProviderRuntimeEvent, HarnessError> {
    const subscribers = this.subscribers;
    const emitter = (cb: EventEmitter) => {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    };

    return Stream.async<ProviderRuntimeEvent, HarnessError>((emit) => {
      const cb: EventEmitter = (event) => {
        emit.single(event);
      };
      const unsubscribe = emitter(cb);
      return Effect.sync(() => unsubscribe());
    });
  }

  protected nextSeq(): number {
    this.seq += 1;
    return this.seq;
  }

  protected envelope(extra?: { turnId?: TurnId }): ProviderRuntimeEventBase {
    return {
      eventId: asId("EventId", makeId("EventId")),
      seq: this.nextSeq(),
      harnessId: this.config.harnessId,
      providerInstanceId: this.config.providerInstanceId,
      sessionId: this.config.sessionId,
      threadId: this.config.threadId,
      turnId: extra?.turnId ?? this.currentTurnId ?? undefined,
      createdAt: new Date().toISOString(),
    };
  }

  protected emit(event: ProviderRuntimeEvent): void {
    if (this.finalized) return;
    for (const sub of this.subscribers) {
      try {
        sub(event);
      } catch {
        // a misbehaving subscriber must never break the stream
      }
    }
  }

  protected emitToolStarted(toolCallId: ToolCallId, tool: string, args: unknown): void {
    this.emit({ ...this.envelope(), type: "tool.call.started", toolCallId, tool, args });
  }

  protected emitToolOutput(
    toolCallId: ToolCallId,
    chunk: string,
    stream: "stdout" | "stderr" = "stdout",
  ): void {
    this.emit({ ...this.envelope(), type: "tool.call.output", toolCallId, chunk, stream });
  }

  protected emitToolCompleted(
    toolCallId: ToolCallId,
    ok: boolean,
    elapsedMs: number,
    extras?: { result?: unknown; error?: string },
  ): void {
    this.emit({
      ...this.envelope(),
      type: "tool.call.completed",
      toolCallId,
      ok,
      elapsedMs,
      ...(extras ?? {}),
    });
  }

  protected emitMessageDelta(delta: string): void {
    this.emit({ ...this.envelope(), type: "message.assistant.delta", delta });
  }

  protected emitMessageComplete(text: string): void {
    this.emit({ ...this.envelope(), type: "message.assistant.complete", text });
  }

  protected emitUserMessage(text: string): void {
    this.emit({ ...this.envelope(), type: "message.user", text });
  }

  protected emitDiagnostic(level: "warn" | "error", message: string, data?: unknown): void {
    this.emit({
      ...this.envelope(),
      type: level === "warn" ? "diagnostic.warn" : "diagnostic.error",
      message,
      data,
    });
  }

  protected emitSessionStateChange(toState: SessionState, reason?: string): void {
    const fromState = this.session.current();
    this.emit({
      ...this.envelope(),
      type: "session.state.changed",
      from: fromState,
      to: toState,
      reason,
    });
  }

  protected emitTurnStateChange(
    fromState: "pending" | "running" | "done" | "failed",
    toState: "pending" | "running" | "done" | "failed",
    turnId?: TurnId,
  ): void {
    this.emit({
      ...this.envelope({ turnId }),
      type: "turn.state.changed",
      from: fromState,
      to: toState,
    });
  }

  protected wrapError(unknown: unknown, turnId?: TurnId): HarnessError {
    return fromUnknown(unknown, {
      harnessId: this.config.harnessId,
      sessionId: this.config.sessionId,
      turnId,
    });
  }

  protected finalize(): void {
    this.finalized = true;
    this.subscribers.clear();
  }
}
