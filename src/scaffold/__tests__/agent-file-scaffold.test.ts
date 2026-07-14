import { describe, expect, it } from "vitest";
import { buildAgentFileScaffoldPlan } from "../agent-file-scaffold.js";

describe("agent file scaffold plan", () => {
  it("plans a spec-first component file scaffold without writing by default", () => {
    const plan = buildAgentFileScaffoldPlan({
      projectRoot: "/repo",
      kind: "component",
      name: "RevenueCard",
      level: "organism",
      purpose: "Show revenue, delta, and confidence evidence before an agent edits dashboard UI.",
      intent: "Create a dashboard proof card from design-system evidence.",
      shadcnBase: ["Card", "Badge"],
      composesSpecs: ["MetricValue"],
    });

    expect(plan).toMatchObject({
      action: "scaffold_agent_design_files",
      schemaVersion: 1,
      status: "planned",
      dryRun: true,
      approved: false,
      kind: "component",
      name: "RevenueCard",
      atomicLevel: "organism",
      specPath: "specs/components/RevenueCard.json",
      generationCommand: "memi generate RevenueCard --preview --json",
      writeCommand: "memi scaffold component RevenueCard --write --json",
    });
    expect(plan.spec).toMatchObject({
      type: "component",
      level: "organism",
      shadcnBase: ["Card", "Badge"],
      composesSpecs: ["MetricValue"],
      accessibility: {
        keyboardNav: true,
        focusStyle: "ring",
        focusWidth: "2px",
      },
    });
    expect(plan.guardrails).toEqual(expect.arrayContaining([
      expect.stringContaining("Atomic Design"),
      expect.stringContaining("Tailwind tokens"),
      expect.stringContaining("dry-run"),
    ]));
  });

  it("plans a page scaffold with explicit sections and metadata", () => {
    const plan = buildAgentFileScaffoldPlan({
      projectRoot: "/repo",
      kind: "page",
      name: "DesignCiPage",
      purpose: "Explain Memi design CI to coding agents.",
      layout: "dashboard",
      sections: [
        { name: "Hero", component: "AgentCiHero", layout: "full-width" },
        { name: "Proof", component: "ProofRail", layout: "grid-2" },
      ],
    });

    expect(plan.atomicLevel).toBe("page");
    expect(plan.specPath).toBe("specs/pages/DesignCiPage.json");
    expect(plan.spec).toMatchObject({
      type: "page",
      layout: "dashboard",
      sections: [
        { name: "Hero", component: "AgentCiHero", layout: "full-width" },
        { name: "Proof", component: "ProofRail", layout: "grid-2" },
      ],
      meta: {
        title: "DesignCiPage",
        description: "Explain Memi design CI to coding agents.",
      },
    });
  });

  it("rejects atom scaffolds that try to compose other specs", () => {
    expect(() => buildAgentFileScaffoldPlan({
      projectRoot: "/repo",
      kind: "component",
      name: "ButtonAtom",
      level: "atom",
      composesSpecs: ["Icon"],
    })).toThrow(/Atoms cannot compose/);
  });
});
