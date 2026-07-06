import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultPolicy, loadPolicy, applyPolicyToIssues, POLICY_FILE_NAME } from "../policy.js";
import { buildBaseline, filterWithBaseline, fingerprintIssue } from "../baseline.js";
import { diagnoseAppQuality, type AppQualityIssue } from "../engine.js";

function makeIssue(overrides: Partial<AppQualityIssue> = {}): AppQualityIssue {
  return {
    id: "color.raw-hex",
    category: "color",
    severity: "medium",
    title: "Raw colors",
    detail: "detail",
    evidence: ["3 unique hex colors"],
    recommendation: "tokenize",
    ...overrides,
  };
}

describe("policy", () => {
  it("default policy is stable — same inputs, same hash", () => {
    expect(defaultPolicy().policyHash).toBe(defaultPolicy().policyHash);
    expect(defaultPolicy().preset).toBe("memi-recommended");
    expect(defaultPolicy().gates.failOn).toBe("high");
  });

  it("loads and resolves a committed policy file, and the hash tracks content", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-policy-"));
    try {
      await writeFile(join(root, POLICY_FILE_NAME), JSON.stringify({
        schemaVersion: 1,
        preset: "strict",
        thresholds: { maxTextSizes: 5 },
        rules: { "type.scale-wide": { severity: "high" } },
      }), "utf-8");

      const policy = await loadPolicy(root);
      expect(policy.source).toBe("file");
      expect(policy.preset).toBe("strict");
      expect(policy.thresholds.maxTextSizes).toBe(5);
      // strict preset values survive where not overridden
      expect(policy.thresholds.maxColorUtilities).toBe(20);
      expect(policy.gates.failOn).toBe("medium");
      expect(policy.skillComplianceSeverity).toBe("critical");
      expect(policy.policyHash).not.toBe(defaultPolicy().policyHash);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a malformed policy loudly instead of silently ungating", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-policy-"));
    try {
      await writeFile(join(root, POLICY_FILE_NAME), JSON.stringify({
        schemaVersion: 1,
        rules: { "not.a.rule": { enabled: false } },
      }), "utf-8");
      await expect(loadPolicy(root)).rejects.toThrow(/unknown rule/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("applies rule disablement and severity overrides", () => {
    const policy = defaultPolicy();
    policy.rules = {
      "color.raw-hex": { severity: "critical" },
      "type.scale-wide": { enabled: false },
    };
    const issues = [
      makeIssue(),
      makeIssue({ id: "type.scale-wide", category: "typography" }),
    ];
    const adjusted = applyPolicyToIssues(issues, policy);
    expect(adjusted).toHaveLength(1);
    expect(adjusted[0]).toMatchObject({ id: "color.raw-hex", severity: "critical" });
  });

  it("policy thresholds actually change what the engine emits", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-policy-engine-"));
    try {
      await mkdir(join(root, "src"), { recursive: true });
      // 3 unique hexes: default policy (rawHexHighThreshold 4) → medium;
      // threshold 0 → high.
      await writeFile(join(root, "src", "page.tsx"), `
export default function Page() {
  return <div className="bg-[#111111] text-[#eeeeee] border-[#889900] p-2">x</div>;
}
`, "utf-8");
      await writeFile(join(root, POLICY_FILE_NAME), JSON.stringify({
        schemaVersion: 1,
        thresholds: { rawHexHighThreshold: 0 },
      }), "utf-8");

      const policy = await loadPolicy(root);
      const diagnosis = await diagnoseAppQuality({ projectRoot: root, maxFiles: 50, write: false, policy });
      const rawHex = diagnosis.issues.find((issue) => issue.id === "color.raw-hex");
      expect(rawHex?.severity).toBe("high");
      expect(diagnosis.policy?.hash).toBe(policy.policyHash);
      expect(diagnosis.policy?.source).toBe("file");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("baseline", () => {
  it("fingerprints are line-number-independent and occurrence-indexed", () => {
    const issue = makeIssue({
      evidenceLocations: [
        { file: "src/a.tsx", line: 10, excerpt: "bg-[#111]  text-x" },
        { file: "src/a.tsx", line: 99, excerpt: "bg-[#111] text-x" },
        { file: "src/b.tsx", line: 5, excerpt: "bg-[#222]" },
      ],
    });
    const prints = fingerprintIssue(issue);
    expect(prints).toHaveLength(3);
    // same file + same normalized excerpt at different lines → distinct via occurrence index
    expect(prints[0].fingerprint).not.toBe(prints[1].fingerprint);
    expect(new Set(prints.map((p) => p.fingerprint)).size).toBe(3);
  });

  it("suppresses fully-accepted issues and resurfaces on any new evidence", () => {
    const original = makeIssue({
      evidenceLocations: [{ file: "src/a.tsx", line: 10, excerpt: "bg-[#111]" }],
    });
    const baseline = buildBaseline([original], { acceptedAt: "2026-01-01T00:00:00.000Z" });

    // unchanged → suppressed
    const unchanged = filterWithBaseline([original], baseline);
    expect(unchanged.active).toHaveLength(0);
    expect(unchanged.suppressed).toHaveLength(1);

    // new evidence location appears → active again
    const grown = makeIssue({
      evidenceLocations: [
        { file: "src/a.tsx", line: 10, excerpt: "bg-[#111]" },
        { file: "src/c.tsx", line: 3, excerpt: "bg-[#333]" },
      ],
    });
    const regrown = filterWithBaseline([grown], baseline);
    expect(regrown.active).toHaveLength(1);
  });

  it("reports stale fingerprints for findings that no longer occur", () => {
    const issue = makeIssue({ evidenceLocations: [{ file: "src/a.tsx", line: 1, excerpt: "bg-[#111]" }] });
    const baseline = buildBaseline([issue], { acceptedAt: "2026-01-01T00:00:00.000Z" });
    const result = filterWithBaseline([], baseline);
    expect(result.staleFingerprints).toHaveLength(1);
  });

  it("aggregate issues (no evidence locations) fingerprint at rule level", () => {
    const aggregate = makeIssue({ id: "type.scale-wide", evidenceLocations: undefined });
    const prints = fingerprintIssue(aggregate);
    expect(prints).toHaveLength(1);
    const baseline = buildBaseline([aggregate], { acceptedAt: "2026-01-01T00:00:00.000Z" });
    // same rule still firing (even with different counts) stays suppressed —
    // worsening aggregate debt is a score-regression concern, not per-file blame
    const worse = makeIssue({ id: "type.scale-wide", evidence: ["12 text size utilities"], evidenceLocations: undefined });
    expect(filterWithBaseline([worse], baseline).suppressed).toHaveLength(1);
  });
});
