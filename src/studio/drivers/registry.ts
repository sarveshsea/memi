/**
 * HarnessDriver registry — lookup and instantiation by HarnessId.
 *
 * Replaces the ad-hoc switch in `harnesses.ts`. Each driver registers itself
 * here; the runtime asks the registry for a driver factory by id.
 */

import { asId, type HarnessId } from "../contracts/ids.js";
import type { HarnessDriver, HarnessDriverConfig } from "./base.js";

export type HarnessDriverFactory = (config: HarnessDriverConfig) => HarnessDriver;

const registry = new Map<HarnessId, HarnessDriverFactory>();

export function registerDriver(harnessId: HarnessId, factory: HarnessDriverFactory): void {
  registry.set(harnessId, factory);
}

export function getDriverFactory(harnessId: HarnessId): HarnessDriverFactory | null {
  return registry.get(harnessId) ?? null;
}

export function instantiateDriver(config: HarnessDriverConfig): HarnessDriver {
  const factory = getDriverFactory(config.harnessId);
  if (!factory) {
    throw new Error(`no driver registered for harness id "${config.harnessId}"`);
  }
  return factory(config);
}

export function listRegisteredDrivers(): HarnessId[] {
  return Array.from(registry.keys());
}

/** Test/setup helper: register many drivers at once and return an "unregister all" disposer. */
export function registerMany(
  entries: ReadonlyArray<readonly [string, HarnessDriverFactory]>,
): () => void {
  const ids: HarnessId[] = [];
  for (const [rawId, factory] of entries) {
    const id = asId("HarnessId", rawId);
    registerDriver(id, factory);
    ids.push(id);
  }
  return () => {
    for (const id of ids) registry.delete(id);
  };
}

/** Test helper: clear the registry between cases. */
export function _resetDriverRegistryForTests(): void {
  registry.clear();
}
