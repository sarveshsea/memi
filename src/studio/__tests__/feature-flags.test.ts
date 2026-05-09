import { describe, expect, it } from "vitest";
import { loadFeatureFlags } from "../feature-flags.js";

describe("feature-flags", () => {
  it("all flags default to false when env is empty", () => {
    const flags = loadFeatureFlags({});
    expect(flags.useNewHarnessLayer).toBe(false);
    expect(flags.useNewRpc).toBe(false);
    expect(flags.useEventBus).toBe(false);
  });

  it("STUDIO_USE_NEW_HARNESS_LAYER=1 enables the harness flag", () => {
    const flags = loadFeatureFlags({ STUDIO_USE_NEW_HARNESS_LAYER: "1" });
    expect(flags.useNewHarnessLayer).toBe(true);
  });

  it.each(["1", "true", "TRUE", "yes", "on"])("'%s' counts as truthy", (value) => {
    const flags = loadFeatureFlags({ STUDIO_USE_NEW_HARNESS_LAYER: value });
    expect(flags.useNewHarnessLayer).toBe(true);
  });

  it.each(["0", "false", "no", "off", ""])("'%s' counts as falsy", (value) => {
    const flags = loadFeatureFlags({ STUDIO_USE_NEW_HARNESS_LAYER: value });
    expect(flags.useNewHarnessLayer).toBe(false);
  });

  it("flags are independent", () => {
    const flags = loadFeatureFlags({
      STUDIO_USE_NEW_RPC: "1",
      STUDIO_USE_EVENT_BUS: "1",
    });
    expect(flags.useNewHarnessLayer).toBe(false);
    expect(flags.useNewRpc).toBe(true);
    expect(flags.useEventBus).toBe(true);
  });
});
