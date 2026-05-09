/**
 * Feature flags for the new engine layer.
 *
 * The Effect.js + ProviderRuntime + driver rewrite ships as a parallel
 * implementation alongside the legacy harness dispatch. Cut-over to
 * the new layer is gated by env vars so the rollout can be staged.
 *
 * Today (this PR), the new layer is fully built and tested but not
 * mounted on the live HTTP server. The flag is read by the future
 * mount code; the existing harness path is unaffected.
 *
 * Flags:
 *   STUDIO_USE_NEW_HARNESS_LAYER=1   — route harness lifecycle through
 *     the new HarnessDriver registry instead of the legacy switch in
 *     harnesses.ts. Default off until commit-15-follow-up wires the
 *     mount on src/studio/server.ts.
 *   STUDIO_USE_NEW_RPC=1             — expose the new typed RPC surface
 *     on the WebSocket upgrade path. Default off; same rationale.
 *   STUDIO_USE_EVENT_BUS=1           — publish driver events to the
 *     shared EventBus so cluster A–E primitives can subscribe instead
 *     of being polled. Default off until the cluster A–E source files
 *     are committed on main and migrated to subscribe-and-act.
 */

export interface StudioFeatureFlags {
  readonly useNewHarnessLayer: boolean;
  readonly useNewRpc: boolean;
  readonly useEventBus: boolean;
}

function flag(name: string, defaultValue: boolean = false): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  const lower = raw.toLowerCase();
  return lower === "1" || lower === "true" || lower === "yes" || lower === "on";
}

export function loadFeatureFlags(env: NodeJS.ProcessEnv = process.env): StudioFeatureFlags {
  return {
    useNewHarnessLayer: flag("STUDIO_USE_NEW_HARNESS_LAYER", false) || envOf(env, "STUDIO_USE_NEW_HARNESS_LAYER"),
    useNewRpc: flag("STUDIO_USE_NEW_RPC", false) || envOf(env, "STUDIO_USE_NEW_RPC"),
    useEventBus: flag("STUDIO_USE_EVENT_BUS", false) || envOf(env, "STUDIO_USE_EVENT_BUS"),
  };
}

function envOf(env: NodeJS.ProcessEnv, name: string): boolean {
  const raw = env[name];
  if (raw === undefined || raw === "") return false;
  const lower = raw.toLowerCase();
  return lower === "1" || lower === "true" || lower === "yes" || lower === "on";
}
