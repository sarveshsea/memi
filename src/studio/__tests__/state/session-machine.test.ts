import { describe, expect, it } from "vitest";
import {
  canTransition,
  isTerminal,
  nextSessionState,
  SessionMachine,
} from "../../state/session-machine.js";

describe("state/session-machine", () => {
  it("starts in idle by default", () => {
    expect(new SessionMachine().current()).toBe("idle");
  });

  it("walks the happy-path lifecycle", () => {
    const m = new SessionMachine();
    expect(m.send({ type: "start" }).to).toBe("starting");
    expect(m.send({ type: "ready" }).to).toBe("ready");
    expect(m.send({ type: "turn.begin" }).to).toBe("running");
    expect(m.send({ type: "turn.end" }).to).toBe("ready");
    expect(m.send({ type: "shutdown" }).to).toBe("stopped");
    expect(isTerminal(m.current())).toBe(true);
  });

  it("supports interrupt + resume", () => {
    const m = new SessionMachine("ready");
    m.send({ type: "interrupt" });
    expect(m.current()).toBe("interrupted");
    m.send({ type: "resume" });
    expect(m.current()).toBe("ready");
  });

  it("transitions to error on fail", () => {
    const m = new SessionMachine("ready");
    m.send({ type: "fail", reason: "boom" });
    expect(m.current()).toBe("error");
  });

  it("rejects illegal transitions", () => {
    expect(() => new SessionMachine("stopped").send({ type: "start" })).toThrow(/invalid transition/);
    expect(() => new SessionMachine("idle").send({ type: "turn.begin" })).toThrow(/invalid transition/);
    expect(canTransition("stopped", { type: "start" })).toBe(false);
    expect(canTransition("ready", { type: "turn.begin" })).toBe(true);
  });

  it("records the transition history", () => {
    const m = new SessionMachine();
    m.send({ type: "start" });
    m.send({ type: "ready" });
    expect(m.log()).toHaveLength(2);
    expect(m.log()[0].to).toBe("starting");
    expect(m.log()[1].to).toBe("ready");
  });

  it("nextSessionState is pure", () => {
    expect(nextSessionState("idle", { type: "start" })).toBe("starting");
    expect(nextSessionState("running", { type: "turn.end" })).toBe("ready");
  });
});
