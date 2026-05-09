/**
 * EventBus — central pub/sub for ProviderRuntimeEvents.
 *
 * Today the engine's primitives (checkpoint-store, hook-runner,
 * walkthrough-writer, artifact-store, monitor-manager, etc.) each have
 * their own ad-hoc trigger surface — checkpointing is called explicitly
 * from the tool broker, hook-runner is dispatched from tool-broker too,
 * walkthrough-writer fires from a session-end callback chain, and so on.
 * Every consumer of the agent stream wires itself in differently.
 *
 * The EventBus consolidates that. Drivers publish every emitted event to
 * a single bus; primitives subscribe to the events they care about. Adding
 * a new primitive becomes "register a subscriber"; adding a new event
 * type doesn't require touching any subscriber wiring.
 *
 * Pattern adapted from t3code's event subscription model. Stream-shaped
 * (Stream.Stream<ProviderRuntimeEvent>) is the right type long-term, but
 * we ship the Set-based pub/sub today so existing primitives can subscribe
 * without taking a dependency on Effect throughout.
 *
 * This commit builds the bus + a worked integration example
 * (CheckpointStore subscribing to tool.call.started for write tools).
 * The full A–E migration is mechanical from here and lands incrementally;
 * each primitive's subscribe-and-act file is a 30-line follow-up.
 */

import type { ProviderRuntimeEvent, ProviderRuntimeEventType } from "./contracts/provider-runtime.js";

export type EventBusSubscriber = (event: ProviderRuntimeEvent) => void | Promise<void>;

export interface EventBusFilter {
  /** Match only events of these types. Empty/missing = match all. */
  types?: readonly ProviderRuntimeEventType[];
  /** Match only events for this session id. Missing = match all. */
  sessionId?: string;
  /** Match only events from this harness id. Missing = match all. */
  harnessId?: string;
  /** Custom predicate. Runs after the type/session/harness filters. */
  predicate?: (event: ProviderRuntimeEvent) => boolean;
}

export interface EventBusSubscription {
  unsubscribe(): void;
}

export interface EventBusStats {
  subscriberCount: number;
  publishedCount: number;
  droppedDueToErrorCount: number;
}

/**
 * Single in-process EventBus. Subscribe with subscribe()/subscribeFiltered();
 * publish with publish(). Unsubscribe via the returned handle.
 */
export class EventBus {
  private readonly subscribers = new Set<{
    cb: EventBusSubscriber;
    filter?: EventBusFilter;
  }>();
  private published = 0;
  private droppedDueToError = 0;

  subscribe(subscriber: EventBusSubscriber): EventBusSubscription {
    return this.subscribeFiltered(subscriber, undefined);
  }

  subscribeFiltered(
    subscriber: EventBusSubscriber,
    filter: EventBusFilter | undefined,
  ): EventBusSubscription {
    const entry = { cb: subscriber, filter };
    this.subscribers.add(entry);
    return {
      unsubscribe: () => {
        this.subscribers.delete(entry);
      },
    };
  }

  publish(event: ProviderRuntimeEvent): void {
    this.published += 1;
    for (const entry of this.subscribers) {
      if (!matchesFilter(event, entry.filter)) continue;
      try {
        const result = entry.cb(event);
        if (result instanceof Promise) {
          result.catch(() => {
            this.droppedDueToError += 1;
          });
        }
      } catch {
        this.droppedDueToError += 1;
      }
    }
  }

  stats(): EventBusStats {
    return {
      subscriberCount: this.subscribers.size,
      publishedCount: this.published,
      droppedDueToErrorCount: this.droppedDueToError,
    };
  }

  clear(): void {
    this.subscribers.clear();
  }
}

function matchesFilter(event: ProviderRuntimeEvent, filter: EventBusFilter | undefined): boolean {
  if (!filter) return true;
  if (filter.types && filter.types.length > 0 && !filter.types.includes(event.type)) return false;
  if (filter.sessionId !== undefined && filter.sessionId !== (event.sessionId as unknown as string)) return false;
  if (filter.harnessId !== undefined && filter.harnessId !== (event.harnessId as unknown as string)) return false;
  if (filter.predicate && !filter.predicate(event)) return false;
  return true;
}
