import { describe, expect, it } from "vitest";
import {
  UX_TENETS,
  UX_TRAPS,
  buildUxAuditReport,
  mapAppQualityIssueToUxFinding,
} from "../tenets-traps.js";

describe("UX tenets and traps", () => {
  it("ships the v1 canon with stable unique identifiers", () => {
    expect(UX_TENETS.map((tenet) => tenet.id)).toEqual([
      "clarity",
      "feedback",
      "control",
      "consistency",
      "accessibility",
      "error-recovery",
      "progressive-disclosure",
      "workflow-fit",
      "trust",
      "state-continuity",
    ]);

    expect(new Set(UX_TENETS.map((tenet) => tenet.id)).size).toBe(UX_TENETS.length);
    expect(new Set(UX_TRAPS.map((trap) => trap.id)).size).toBe(UX_TRAPS.length);
    expect(UX_TRAPS.length).toBeGreaterThanOrEqual(10);
  });

  it("maps app-quality issues into trap findings and recommendations", () => {
    const finding = mapAppQualityIssueToUxFinding({
      id: "color.raw-hex",
      category: "color",
      severity: "high",
      title: "Raw colors are leaking into UI code",
      detail: "Hardcoded hex values make redesigns brittle.",
      evidence: ["2 raw colors"],
      recommendation: "Move recurring colors into tokens.",
      confidence: 0.91,
      affectedFiles: ["src/app/page.tsx"],
    });

    expect(finding).toMatchObject({
      id: "ux.color.raw-hex",
      severity: "high",
      tenetIds: expect.arrayContaining(["consistency", "trust"]),
      trapIds: expect.arrayContaining(["token-drift"]),
      recommendation: expect.stringMatching(/tokens/i),
    });
    expect(finding.evidence.join("\n")).toContain("2 raw colors");
  });

  it("scores trap risk and records screenshots without fabricating findings", () => {
    const report = buildUxAuditReport({
      target: "current-screen",
      artifactPath: "/tmp/memoire-screen.png",
      issues: [{
        id: "a11y.focus-missing",
        category: "accessibility",
        severity: "high",
        title: "Focus states are not visible in code",
        detail: "Interactive UI was found, but no focus-visible styling was detected.",
        evidence: ["3 interactive controls"],
        recommendation: "Add visible focus states.",
      }],
    });

    expect(report.schemaVersion).toBe(2);
    expect(report.score).toBeLessThan(100);
    expect(report.artifactPath).toBe("/tmp/memoire-screen.png");
    expect(report.artifactNote).toMatch(/not analyzed/i);
    expect(report.tenetCoverage.find((tenet) => tenet.tenetId === "accessibility")).toMatchObject({
      status: "at-risk",
    });
    expect(report.trapRisks.find((trap) => trap.trapId === "inaccessible-interaction")).toMatchObject({
      status: "present",
    });
    expect(report.findings.map((finding) => finding.id)).toContain("ux.a11y.focus-missing");
    expect(report.findings.every((finding) => finding.provenance === "static-scan")).toBe(true);
    expect(report.recommendedTweaks[0]).toMatch(/focus/i);
  });

  it("never fabricates a finding from a screenshot alone", () => {
    const report = buildUxAuditReport({
      target: "screenshot",
      artifactPath: "/tmp/memoire-screen.png",
      issues: [],
    });

    expect(report.findings).toHaveLength(0);
    expect(report.artifactNote).toMatch(/not analyzed/i);
  });

  it("reports unreachable tenets and traps as not-assessed, never protected/clear", () => {
    const report = buildUxAuditReport({
      target: "workspace",
      issues: [{
        id: "color.raw-hex",
        category: "color",
        severity: "high",
        title: "Raw colors are leaking into UI code",
        detail: "Hardcoded hex values make redesigns brittle.",
        evidence: ["2 raw colors"],
        recommendation: "Move recurring colors into tokens.",
      }],
    });

    // context-leak and destructive-default have no static-scan evidence path.
    expect(report.trapRisks.find((trap) => trap.trapId === "context-leak")).toMatchObject({
      status: "not-assessed",
    });
    expect(report.trapRisks.find((trap) => trap.trapId === "destructive-default")).toMatchObject({
      status: "not-assessed",
    });
    // feedback/error-recovery/progressive-disclosure are unreachable tenets.
    expect(report.tenetCoverage.find((tenet) => tenet.tenetId === "feedback")).toMatchObject({
      status: "not-assessed",
    });
    // A tenet the scan CAN violate and found clean may read protected.
    expect(report.tenetCoverage.find((tenet) => tenet.tenetId === "accessibility")).toMatchObject({
      status: "protected",
    });
  });
});
