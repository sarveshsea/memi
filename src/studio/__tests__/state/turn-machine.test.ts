import { describe, expect, it } from "vitest";
import {
  canTransition,
  isTerminal,
  nextTurnState,
  TurnMachine,
} from "../../state/turn-machine.js";

describe("state/turn-machine", () => {
  it("starts pending by default", () => {
    expect(new TurnMachine().current()).toBe("pending");
  });

  it("walks happy path", () => {
    const m = new TurnMachine();
    expect(m.send({ type: "begin" }).to).toBe("running");
    expect(m.send({ type: "complete" }).to).toBe("done");
    expect(isTerminal(m.current())).toBe(true);
  });

  it("walks failure path", () => {
    const m = new TurnMachine();
    m.send({ type: "begin" });
    m.send({ type: "fail", reason: "boom" });
    expect(m.current()).toBe("failed");
    expect(isTerminal(m.current())).toBe(true);
  });

  it("cancel from running goes to failed", () => {
    const m = new TurnMachine();
    m.send({ type: "begin" });
    m.send({ type: "cancel" });
    expect(m.current()).toBe("failed");
  });

  it("rejects transitions out of terminal states", () => {
    expect(() => new TurnMachine("done").send({ type: "begin" })).toThrow(/invalid transition/);
    expect(() => new TurnMachine("failed").send({ type: "complete" })).toThrow(/invalid transition/);
    expect(canTransition("done", { type: "complete" })).toBe(false);
  });

  it("nextTurnState is pure", () => {
    expect(nextTurnState("pending", { type: "begin" })).toBe("running");
    expect(nextTurnState("running", { type: "complete" })).toBe("done");
  });
});
