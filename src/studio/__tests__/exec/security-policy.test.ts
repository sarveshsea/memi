import { describe, expect, it } from "vitest";
import {
  customPolicy,
  getSecurityPolicy,
  listProfiles,
} from "../../exec/security-policy.js";

describe("exec/security-policy", () => {
  it("listProfiles returns all 4 profile names", () => {
    expect(listProfiles()).toEqual(["tight", "read-only", "standard", "broad"]);
  });

  it("tight profile has zero tools", () => {
    expect(getSecurityPolicy("tight").allowedTools).toEqual([]);
  });

  it("read-only profile includes Read but not Write or Bash", () => {
    const tools = getSecurityPolicy("read-only").allowedTools.map((t) => t.name);
    expect(tools).toContain("Read");
    expect(tools).not.toContain("Write");
    expect(tools).not.toContain("Bash");
  });

  it("standard profile adds Write + Bash on top of read-only", () => {
    const tools = getSecurityPolicy("standard").allowedTools.map((t) => t.name);
    expect(tools).toContain("Read");
    expect(tools).toContain("Write");
    expect(tools).toContain("Bash");
  });

  it("broad profile adds Browser + Computer on top of standard", () => {
    const tools = getSecurityPolicy("broad").allowedTools.map((t) => t.name);
    expect(tools).toContain("Browser");
    expect(tools).toContain("Computer");
  });

  it("only broad requires approval", () => {
    expect(getSecurityPolicy("tight").requiresApproval).toBe(false);
    expect(getSecurityPolicy("read-only").requiresApproval).toBe(false);
    expect(getSecurityPolicy("standard").requiresApproval).toBe(false);
    expect(getSecurityPolicy("broad").requiresApproval).toBe(true);
  });

  it("timeouts grow monotonically with the profile name", () => {
    const profiles = ["tight", "read-only", "standard", "broad"] as const;
    let prev = 0;
    for (const p of profiles) {
      const t = getSecurityPolicy(p).timeoutMs;
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });

  it("env allowlist never includes secret-pattern keys", () => {
    for (const p of listProfiles()) {
      const env = getSecurityPolicy(p).envAllowlist;
      for (const k of env) {
        expect(k).not.toMatch(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i);
      }
    }
  });

  it("customPolicy merges overrides on top of a base profile", () => {
    const policy = customPolicy("read-only", { timeoutMs: 1_000, memoryMb: 64 });
    expect(policy.timeoutMs).toBe(1_000);
    expect(policy.memoryMb).toBe(64);
    expect(policy.allowedTools.length).toBe(getSecurityPolicy("read-only").allowedTools.length);
  });

  it("customPolicy preserves the base profile name", () => {
    const policy = customPolicy("standard", { timeoutMs: 1 });
    expect(policy.profile).toBe("standard");
  });
});
