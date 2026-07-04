import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { heuristicComposeLayout, applyComposition, composeLayout } from "../layout-composer.js";
import type { PageSpec } from "../../specs/types.js";
import type { CodegenContext } from "../generator.js";

function makePageSpec(overrides: Partial<PageSpec> = {}): PageSpec {
  return {
    name: "SomePage",
    type: "page",
    purpose: "A generic page",
    researchBacking: [],
    layout: "full-width",
    // Neutral names — no keyword in "intro"/"details" collides with any
    // heuristicComposeLayout matcher, so purpose-only tests aren't polluted
    // by section-name keyword matches.
    sections: [
      { name: "intro", component: "Intro", layout: "full-width", repeat: 1, props: {} },
      { name: "details", component: "DetailCard", layout: "full-width", repeat: 1, props: {} },
    ],
    shadcnLayout: [],
    responsive: { mobile: "stack", tablet: "grid-2", desktop: "grid-4" },
    meta: {},
    accessibility: {
      landmarks: true, skipLink: true, headingHierarchy: true,
      language: "en", consistentNav: true, consistentHelp: true,
    },
    tags: [],
    layoutLocked: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeCtx(): CodegenContext {
  return {
    project: {
      name: "test-project", root: "/tmp/test", framework: "next",
      hasTypescript: true, hasTailwind: true, hasShadcn: true,
      packageManager: "npm", detectedAt: new Date().toISOString(),
    },
    designSystem: { tokens: [], components: [], styles: [], lastSync: "" },
  } as CodegenContext;
}

describe("heuristicComposeLayout", () => {
  it("matches dashboard keywords in the purpose", () => {
    const spec = makePageSpec({ purpose: "Main analytics dashboard with KPIs" });
    const result = heuristicComposeLayout(spec);
    expect(result.layout).toBe("dashboard");
    expect(result.source).toBe("heuristic");
  });

  it("matches centered layout for auth-flow purposes", () => {
    const spec = makePageSpec({ purpose: "User sign-in page" });
    expect(heuristicComposeLayout(spec).layout).toBe("centered");
  });

  it("matches marketing layout for landing-page purposes", () => {
    const spec = makePageSpec({ purpose: "Product landing page with pricing" });
    expect(heuristicComposeLayout(spec).layout).toBe("marketing");
  });

  it("falls back to the spec's own layout when nothing matches", () => {
    const spec = makePageSpec({ purpose: "A miscellaneous internal tool", layout: "split" });
    expect(heuristicComposeLayout(spec).layout).toBe("split");
  });

  it("never reorders sections — no reliable signal without AI judgment", () => {
    const spec = makePageSpec();
    const result = heuristicComposeLayout(spec);
    expect(result.sectionOrder).toEqual(["intro", "details"]);
  });

  it("assigns grid-4 layout to a section repeated 4 times", () => {
    const spec = makePageSpec({
      sections: [{ name: "cards", component: "MetricCard", layout: "full-width", repeat: 4, props: {} }],
    });
    const result = heuristicComposeLayout(spec);
    expect(result.sectionLayouts["cards"]).toBe("grid-4");
  });

  it("is pure — never throws and never performs I/O", () => {
    const spec = makePageSpec({ sections: [] });
    expect(() => heuristicComposeLayout(spec)).not.toThrow();
  });
});

describe("composeLayout", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  const originalDisable = process.env.MEMOIRE_DISABLE_LAYOUT_AI;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.MEMOIRE_DISABLE_LAYOUT_AI;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = originalKey;
    if (originalDisable === undefined) delete process.env.MEMOIRE_DISABLE_LAYOUT_AI; else process.env.MEMOIRE_DISABLE_LAYOUT_AI = originalDisable;
  });

  it("falls back to the heuristic when no API key is configured", async () => {
    const spec = makePageSpec({ purpose: "Main analytics dashboard" });
    const result = await composeLayout(spec, makeCtx());
    expect(result.source).toBe("heuristic");
    expect(result.layout).toBe("dashboard");
  });

  it("honors layoutLocked and returns the spec verbatim, skipping composition entirely", async () => {
    const spec = makePageSpec({ purpose: "dashboard analytics", layout: "centered", layoutLocked: true });
    const result = await composeLayout(spec, makeCtx());
    expect(result.layout).toBe("centered");
    expect(result.rationale).toContain("layoutLocked");
  });

  it("falls back to the heuristic when MEMOIRE_DISABLE_LAYOUT_AI=1 even with a key present", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-key";
    process.env.MEMOIRE_DISABLE_LAYOUT_AI = "1";
    const spec = makePageSpec({ purpose: "sign-in page" });
    const result = await composeLayout(spec, makeCtx());
    expect(result.source).toBe("heuristic");
    expect(result.layout).toBe("centered");
  });
});

describe("applyComposition", () => {
  it("overwrites spec.layout only when it still equals the schema default", () => {
    const spec = makePageSpec({ layout: "full-width" });
    const composition = {
      layout: "dashboard" as const,
      sectionOrder: ["intro", "details"],
      sectionLayouts: { intro: "full-width" as const, details: "grid-4" as const },
      rationale: "test",
      source: "heuristic" as const,
    };
    const composed = applyComposition(spec, composition);
    expect(composed.layout).toBe("dashboard");
  });

  it("preserves an explicitly-set spec.layout — never overrides deliberate author intent", () => {
    const spec = makePageSpec({ layout: "split" });
    const composition = {
      layout: "dashboard" as const,
      sectionOrder: ["intro", "details"],
      sectionLayouts: {},
      rationale: "test",
      source: "heuristic" as const,
    };
    const composed = applyComposition(spec, composition);
    expect(composed.layout).toBe("split");
  });

  it("reorders sections per the composition's sectionOrder", () => {
    const spec = makePageSpec();
    const composition = {
      layout: "full-width" as const,
      sectionOrder: ["details", "intro"],
      sectionLayouts: {},
      rationale: "test",
      source: "ai" as const,
    };
    const composed = applyComposition(spec, composition);
    expect(composed.sections.map((s) => s.name)).toEqual(["details", "intro"]);
  });

  it("ignores a sectionOrder that doesn't match the spec's actual sections", () => {
    const spec = makePageSpec();
    const composition = {
      layout: "full-width" as const,
      sectionOrder: ["hallucinated-section"],
      sectionLayouts: {},
      rationale: "test",
      source: "ai" as const,
    };
    const composed = applyComposition(spec, composition);
    expect(composed.sections.map((s) => s.name)).toEqual(["intro", "details"]);
  });

  it("never mutates the original spec object", () => {
    const spec = makePageSpec({ layout: "full-width" });
    const composition = {
      layout: "dashboard" as const,
      sectionOrder: ["intro", "details"],
      sectionLayouts: {},
      rationale: "test",
      source: "heuristic" as const,
    };
    applyComposition(spec, composition);
    expect(spec.layout).toBe("full-width");
  });
});
