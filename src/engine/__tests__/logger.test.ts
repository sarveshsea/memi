import { afterEach, describe, expect, it } from "vitest";
import { shouldUsePrettyTransport } from "../logger.js";

const originalEnv = {
  MEMOIRE_STUDIO_MANAGED_BY: process.env.MEMOIRE_STUDIO_MANAGED_BY,
  NODE_ENV: process.env.NODE_ENV,
  VITEST: process.env.VITEST,
};

describe("engine logger", () => {
  afterEach(() => {
    restoreEnv("MEMOIRE_STUDIO_MANAGED_BY", originalEnv.MEMOIRE_STUDIO_MANAGED_BY);
    restoreEnv("NODE_ENV", originalEnv.NODE_ENV);
    restoreEnv("VITEST", originalEnv.VITEST);
  });

  it("disables pretty worker transports for the bundled Studio runtime", () => {
    process.env.MEMOIRE_STUDIO_MANAGED_BY = "tauri";
    process.env.NODE_ENV = "development";
    delete process.env.VITEST;

    expect(shouldUsePrettyTransport()).toBe(false);
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
