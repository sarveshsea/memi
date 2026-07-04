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
      schemaVersion: 1,
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

  it("creates a screenshot review finding when visual evidence is attached without code issues", () => {
    const report = buildInterfaceCraftReport({
      target: "screenshot",
      artifactPath: "/tmp/screen.png",
      generatedAt: "2026-07-04T00:00:00.000Z",
    });

    expect(report.findings).toEqual([
      expect.objectContaining({
        id: "craft.screenshot.review-required",
        dimensionIds: expect.arrayContaining(["focusing-mechanism", "visual-weight", "user-context-care"]),
        artifactPath: "/tmp/screen.png",
      }),
    ]);
    expect(report.topOpportunities).toContain("Review the screenshot through visual design, interface design, conventions, and user-context lenses before patching UI.");
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
