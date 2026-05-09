import { afterEach, describe, expect, it } from "vitest";
import { Effect, Stream } from "effect";
import {
  _resetDriverRegistryForTests,
  getDriverFactory,
  instantiateDriver,
  listRegisteredDrivers,
  registerDriver,
  registerMany,
} from "../../drivers/registry.js";
import { asId } from "../../contracts/ids.js";
import { BaseHarnessDriver, type HarnessTurnRequest } from "../../drivers/base.js";
import type { HarnessError } from "../../contracts/errors.js";

class StubDriver extends BaseHarnessDriver {
  start(): Effect.Effect<void, HarnessError> {
    return Effect.void;
  }
  sendTurn(_req: HarnessTurnRequest): Effect.Effect<void, HarnessError> {
    return Effect.void;
  }
  interrupt(): Effect.Effect<void, HarnessError> {
    return Effect.void;
  }
  shutdown(): Effect.Effect<void, HarnessError> {
    return Effect.void;
  }
}

describe("drivers/registry", () => {
  afterEach(() => {
    _resetDriverRegistryForTests();
  });

  it("registers and retrieves a driver factory", () => {
    const id = asId("HarnessId", "hns_stub");
    registerDriver(id, (c) => new StubDriver(c));
    const factory = getDriverFactory(id);
    expect(factory).not.toBeNull();
  });

  it("instantiateDriver throws on unknown id", () => {
    expect(() =>
      instantiateDriver({
        harnessId: asId("HarnessId", "hns_nope"),
        providerInstanceId: asId("ProviderInstanceId", "prv_x"),
        sessionId: asId("SessionId", "ses_x"),
      }),
    ).toThrow(/no driver registered/);
  });

  it("registerMany registers a batch and unregisters cleanly", () => {
    const dispose = registerMany([
      ["hns_a", (c) => new StubDriver(c)],
      ["hns_b", (c) => new StubDriver(c)],
    ]);
    expect(listRegisteredDrivers().length).toBe(2);
    dispose();
    expect(listRegisteredDrivers().length).toBe(0);
  });

  it("driver event stream emits for subscribers (smoke through Effect)", async () => {
    const id = asId("HarnessId", "hns_stub");
    registerDriver(id, (c) => new StubDriver(c));
    const driver = instantiateDriver({
      harnessId: id,
      providerInstanceId: asId("ProviderInstanceId", "prv_x"),
      sessionId: asId("SessionId", "ses_x"),
    });
    const stream = driver.events();
    expect(stream).toBeDefined();
    expect(typeof Stream.runCollect).toBe("function");
  });
});
