import { describe, expect, it } from "vitest";
import {
  CORE_WORKBENCH_E2E_SURFACES,
  REAL_HARNESS_E2E_MATRIX,
  buildWorkbenchE2EPlan,
} from "../workbench-e2e.js";

describe("studio workbench E2E contract", () => {
  it("covers industry-standard workbench surfaces with safe and mutating click paths", () => {
    const plan = buildWorkbenchE2EPlan();

    expect(plan.surfaces.map((surface) => surface.id)).toEqual(CORE_WORKBENCH_E2E_SURFACES.map((surface) => surface.id));
    expect(plan.surfaces.map((surface) => surface.id)).toEqual(expect.arrayContaining([
      "topbar",
      "sidebar",
      "composer",
      "activity",
      "artifact",
      "details",
      "settings",
    ]));
    expect(plan.requiredAssertions).toEqual(expect.arrayContaining([
      "every enabled button has data-action-id or an explicit disabled reason",
      "no visible control overlaps another visible control at desktop, narrow desktop, or mobile-width pane",
      "terminal output is collapsed by default and expandable inside the activity row",
      "real harness sessions produce reference_trace, activity, terminal/process, and session_result evidence",
    ]));
  });

  it("defines real harness smoke behavior with explicit skip states", () => {
    const plan = buildWorkbenchE2EPlan();

    expect(plan.harnesses).toEqual(REAL_HARNESS_E2E_MATRIX);
    expect(plan.harnesses).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "codex", mode: "real", permissionMode: "full_access", workspace: "disposable-fixture" }),
      expect.objectContaining({ id: "claude-code", mode: "real-or-skip", skipReason: "missing-or-unauthenticated" }),
      expect.objectContaining({ id: "hermes", mode: "real-or-skip" }),
      expect.objectContaining({ id: "memoire", mode: "real-or-skip" }),
    ]));
  });
});
