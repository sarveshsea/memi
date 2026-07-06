import { describe, expect, it } from "vitest";
import { buildInterfaceCraftReport } from "../interface-craft.js";
import type { AppQualityIssue } from "../../app-quality/engine.js";

describe("interface craft report", () => {
  it("maps app-quality evidence into first-class craft dimensions and opportunities", () => {
    const issues: AppQualityIssue[] = [
      makeIssue("color.raw-hex", "color", "medium", "Raw color literals", "src/app/page.tsx"),
      makeIssue("spacing.arbitrary", "spacing", "medium", "Arbitrary spacing", "src/app/page.tsx"),
      makeIssue("typography.scale", "typography", "low", "Type scale drift", "src/app/page.tsx"),
      makeIssue("components.duplicate", "components", "high", "Duplicate controls", "src/components/Button.tsx"),
      makeIssue("responsive.missing", "responsive", "high", "Missing responsive states", "src/app/page.tsx"),
    ];

    const report = buildInterfaceCraftReport({
      target: ".",
      appQualityScore: 72,
      issues,
      generatedAt: "2026-07-04T00:00:00.000Z",
    });

    expect(report).toMatchObject({
      schemaVersion: 2,
      target: ".",
      score: expect.any(Number),
    });
    expect(report.score).toBeLessThan(90);
    expect(report.dimensions.map((dimension) => dimension.dimensionId)).toEqual(expect.arrayContaining([
      "color-intentionality",
      "spacing-rhythm",
      "typographic-hierarchy",
      "component-cohesion",
      "responsive-resilience",
      "focusing-mechanism",
      "user-context-care",
    ]));
    expect(report.findings.map((finding) => finding.dimensionIds).flat()).toEqual(expect.arrayContaining([
      "color-intentionality",
      "spacing-rhythm",
      "component-cohesion",
      "responsive-resilience",
    ]));
    expect(report.critique.visualDesign).toContain("color");
    expect(report.critique.interfaceDesign).toContain("focusing mechanism");
    expect(report.topOpportunities[0]).toContain("Resolve");
  });

  it("records screenshots without fabricating findings, and marks unassessable dimensions as not-assessed", () => {
    const report = buildInterfaceCraftReport({
      target: "screenshot",
      artifactPath: "/tmp/screen.png",
      generatedAt: "2026-07-04T00:00:00.000Z",
    });

    // No vision pass exists — a screenshot's mere existence must not become a finding.
    expect(report.findings).toHaveLength(0);
    expect(report.artifactNote).toMatch(/not analyzed/i);

    // icon-consistency and motion-restraint have no static-scan evidence path —
    // they must read not-assessed with no score, never "strong 100/100".
    const iconDim = report.dimensions.find((d) => d.dimensionId === "icon-consistency");
    expect(iconDim).toMatchObject({ status: "not-assessed", score: null });
    const motionDim = report.dimensions.find((d) => d.dimensionId === "motion-restraint");
    expect(motionDim).toMatchObject({ status: "not-assessed", score: null });
  });

  it("stamps static-scan provenance on every mapped finding", () => {
    const report = buildInterfaceCraftReport({
      target: ".",
      issues: [makeIssue("color.raw-hex", "color", "medium", "Raw color literals", "src/app/page.tsx")],
      generatedAt: "2026-07-04T00:00:00.000Z",
    });
    expect(report.findings.every((finding) => finding.provenance === "static-scan")).toBe(true);
  });
});

function makeIssue(
  id: string,
  category: AppQualityIssue["category"],
  severity: AppQualityIssue["severity"],
  title: string,
  file: string,
): AppQualityIssue {
  return {
    id,
    category,
    severity,
    title,
    detail: `${title} detail`,
    evidence: [`Evidence in ${file}`],
    recommendation: `Resolve ${title}`,
    affectedFiles: [file],
    confidence: 0.9,
  };
}
