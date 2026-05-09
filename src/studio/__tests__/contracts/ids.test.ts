import { describe, expect, it } from "vitest";
import {
  asId,
  entityKindOf,
  isId,
  makeId,
  type SessionId,
  type TurnId,
} from "../../contracts/ids.js";

describe("contracts/ids", () => {
  it("makeId stamps the right prefix", () => {
    expect(makeId("SessionId")).toMatch(/^ses_[a-f0-9]{32}$/);
    expect(makeId("TurnId")).toMatch(/^trn_[a-f0-9]{32}$/);
    expect(makeId("EventId")).toMatch(/^evt_[a-f0-9]{32}$/);
  });

  it("asId rejects mismatched prefixes", () => {
    expect(() => asId("SessionId", "trn_deadbeef")).toThrow(/id-mismatch/);
    expect(() => asId("TurnId", "ses_deadbeef")).toThrow(/id-mismatch/);
  });

  it("asId accepts properly-prefixed ids", () => {
    const id: SessionId = asId("SessionId", makeId("SessionId"));
    expect(id).toMatch(/^ses_/);
  });

  it("isId discriminates correctly", () => {
    expect(isId("TurnId", makeId("TurnId"))).toBe(true);
    expect(isId("TurnId", makeId("SessionId"))).toBe(false);
    expect(isId("TurnId", 42)).toBe(false);
    expect(isId("TurnId", null)).toBe(false);
  });

  it("entityKindOf round-trips for every prefix", () => {
    expect(entityKindOf(makeId("HarnessId"))).toBe("HarnessId");
    expect(entityKindOf(makeId("SessionId"))).toBe("SessionId");
    expect(entityKindOf(makeId("TurnId"))).toBe("TurnId");
    expect(entityKindOf(makeId("WorkspaceId"))).toBe("WorkspaceId");
    expect(entityKindOf("xxx_anything")).toBeNull();
  });

  it("branded types prevent accidental cross-use at compile time (smoke)", () => {
    const session: SessionId = asId("SessionId", makeId("SessionId"));
    const turn: TurnId = asId("TurnId", makeId("TurnId"));
    // The next line would fail typecheck if uncommented:
    // const _bad: SessionId = turn;
    expect(session).not.toBe(turn);
  });
});
