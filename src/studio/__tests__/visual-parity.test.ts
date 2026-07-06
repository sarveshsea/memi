import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  VISUAL_PARITY_CHALLENGE,
  createVisualParityProof,
  createVisualParityRunRequest,
  gradeVisualParityEvidence,
} from "../visual-parity.js";

describe("studio visual parity challenge", () => {
  it("defines the canonical Claude Design parity prompt and Codex-first run shape", () => {
    const request = createVisualParityRunRequest({ cwd: "/tmp/product-app" });

    expect(VISUAL_PARITY_CHALLENGE.prompt).toBe("Create a polished, editable product dashboard screen from a blank brief, with visual hierarchy, components, design-system tokens, and handoff artifacts.");
    expect(request).toMatchObject({
      harnessId: "codex",
      action: "app-build",
      cwd: "/tmp/product-app",
      permissionMode: "guarded",
      chatMode: "build",
    });
    expect(request.prompt).toContain("polished, editable product dashboard");
    expect(request.prompt).toContain("Save or report: screenshot, preview URL, component/spec files, token evidence, handoff artifact, and continuation note");
  });

  it("does not pass visual parity without inspectable first-pass artifacts", () => {
    const result = gradeVisualParityEvidence({
      artifacts: [
        { kind: "preview", url: "http://127.0.0.1:4173/dashboard" },
        { kind: "code", path: "src/app/dashboard/page.tsx", editable: true },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.score).toBeLessThan(95);
    expect(result.missingCriteria).toEqual(expect.arrayContaining([
      "first-pass screenshot",
      "design-system token evidence",
      "handoff artifact",
      "continuation proof",
    ]));
  });

  it("passes only when the dashboard challenge has complete editable evidence", () => {
    const result = gradeVisualParityEvidence({
      artifacts: [
        { kind: "screenshot", path: "artifacts/dashboard.png" },
        { kind: "preview", url: "http://127.0.0.1:4173/dashboard" },
        { kind: "spec", path: "specs/pages/dashboard.json", editable: true },
        { kind: "code", path: "src/app/dashboard/page.tsx", editable: true },
        { kind: "tokens", path: "tokens/dashboard.css" },
        { kind: "handoff", path: "artifacts/dashboard-handoff.md" },
        { kind: "continuation", path: "artifacts/dashboard-continuation.md" },
      ],
      visualQualityScore: 95,
    });

    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(95);
    expect(result.missingCriteria).toEqual([]);
  });

  it("writes a deterministic no-install dashboard proof with all editable parity artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-visual-parity-"));
    try {
      const proof = await createVisualParityProof({
        projectRoot: root,
        generatedAt: "2026-06-30T00:00:00.000Z",
      });

      expect(proof.mode).toBe("demo-fixture");
      expect(proof.demoDisclaimer).toMatch(/asserted, not measured/i);
      expect(proof.liveHarness).toBe(false);
      expect(proof.grade).toMatchObject({ passed: true, score: 100, missingCriteria: [] });
      expect(proof.previewUrl).toMatch(/^file:\/\//);
      expect(proof.artifacts.map((artifact) => artifact.kind)).toEqual([
        "screenshot",
        "preview",
        "spec",
        "code",
        "tokens",
        "handoff",
        "continuation",
      ]);

      const spec = JSON.parse(await readFile(join(root, ".memoire", "studio", "visual-parity", "dashboard.page-spec.json"), "utf-8"));
      expect(spec.atomicDesign.organisms).toContain("KpiOverview");
      await expect(readFile(join(root, ".memoire", "studio", "visual-parity", "dashboard-preview.html"), "utf-8")).resolves.toContain("Growth operating room");
      await expect(readFile(join(root, ".memoire", "studio", "visual-parity", "DashboardPage.tsx"), "utf-8")).resolves.toContain("export function DashboardPage");
      await expect(readFile(join(root, ".memoire", "studio", "visual-parity", "dashboard.tokens.css"), "utf-8")).resolves.toContain("--dashboard-accent");
      await expect(readFile(join(root, ".memoire", "studio", "visual-parity", "dashboard-screenshot.svg"), "utf-8")).resolves.toContain("<svg");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
