import { describe, expect, it } from "vitest";
import {
  buildProductSimulationScenarioFromResearch,
  LocalSimulationAdapter,
  exportProductSpecFromRun,
  type ProductSimulationScenario,
} from "../index.js";
import type { ResearchStore } from "../../research/engine.js";

describe("local product simulation", () => {
  it("maps research into a deterministic product scenario graph", async () => {
    const scenario = buildProductSimulationScenarioFromResearch(makeResearchStore(), {
      name: "Checkout research sandbox",
      hypothesis: "Product managers need a faster checkout instrumentation plan.",
      variables: [
        { id: "variable-pricing", name: "Pricing disclosure", value: "early", description: "Show fees before account creation." },
      ],
    });

    expect(scenario).toMatchObject({
      adapter: "local",
      name: "Checkout research sandbox",
      hypothesis: "Product managers need a faster checkout instrumentation plan.",
    });
    expect(scenario.agents.map((agent) => agent.name)).toContain("Growth PM");
    expect(scenario.graph.nodes.map((node) => node.kind)).toEqual(expect.arrayContaining(["agent", "finding", "theme", "risk", "opportunity", "variable"]));
    expect(scenario.graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "represents" }),
      expect.objectContaining({ kind: "evidence" }),
      expect.objectContaining({ kind: "variable" }),
    ]));
  });

  it("runs locally, interviews agents, and exports a spec impact report", async () => {
    const scenario: ProductSimulationScenario = buildProductSimulationScenarioFromResearch(makeResearchStore(), {
      name: "Checkout instrumentation",
      hypothesis: "Earlier pricing disclosure will reduce checkout risk.",
    });
    const adapter = new LocalSimulationAdapter({ now: () => "2026-05-07T12:00:00.000Z" });

    const prepared = await adapter.prepare(scenario);
    const run = await adapter.start(prepared.scenario.id);
    const events = [];
    for await (const event of adapter.stream(run.id)) events.push(event);
    const interview = await adapter.interview(run.id, { agentId: scenario.agents[0]?.id ?? "", prompt: "What should the spec change?" });
    const report = await adapter.exportReport(run.id);
    const spec = exportProductSpecFromRun(report);

    expect(run.status).toBe("completed");
    expect(events.map((event) => event.kind)).toEqual(expect.arrayContaining(["agent-reaction", "outcome"]));
    expect(interview.answer).toContain("Growth PM");
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(spec.researchBacking).toEqual(expect.arrayContaining(["finding-checkout-friction"]));
    expect(spec.sections.map((section) => section.title)).toContain("Simulation Recommendations");
  });
});

function makeResearchStore(): ResearchStore {
  return {
    version: 2,
    sources: [
      { id: "source-interviews", name: "research/interviews.csv", type: "csv", processedAt: "2026-05-07T00:00:00.000Z", itemCount: 12, sourceKind: "mixed" },
    ],
    observations: [
      {
        id: "obs-1",
        sourceId: "source-interviews",
        kind: "survey-response",
        text: "Checkout fees appear too late and reduce trust.",
        actor: "Buyer",
        cohort: "Self-serve",
        tags: ["checkout"],
        entities: ["Checkout"],
        sentiment: "negative",
        createdAt: "2026-05-07T00:00:00.000Z",
      },
    ],
    highlights: [],
    codebook: [],
    findings: [
      {
        id: "finding-checkout-friction",
        statement: "Buyers abandon checkout when fees appear after account creation.",
        category: "conversion",
        confidence: "high",
        themeIds: ["theme-trust"],
        evidenceObservationIds: ["obs-1"],
        evidenceSourceIds: ["source-interviews"],
        sourceTypeCount: 1,
        method: "mixed",
        caveats: [],
        tags: ["checkout", "trust"],
        entities: ["Checkout"],
        sentiment: "negative",
        signalTags: ["checkout"],
        createdAt: "2026-05-07T00:00:00.000Z",
      },
    ],
    themes: [
      {
        id: "theme-trust",
        name: "Trust before checkout",
        description: "Users need fee clarity before committing.",
        findingIds: ["finding-checkout-friction"],
        frequency: 6,
        sourceCount: 1,
        sourceTypeCount: 1,
        confidence: "high",
        signalTags: ["trust"],
        positiveCount: 1,
        negativeCount: 5,
      },
    ],
    evidenceLinks: [],
    personas: [
      {
        name: "Growth PM",
        role: "Product manager",
        goals: ["Increase conversion"],
        painPoints: ["Cannot identify fee-friction cohorts quickly"],
        behaviors: ["Segments funnel events by buyer intent"],
        source: "research/interviews.csv",
        confidence: "high",
        evidenceFindingIds: ["finding-checkout-friction"],
      },
    ],
    quantitativeMetrics: [
      {
        id: "metric-nps",
        source: "research/interviews.csv",
        field: "nps",
        label: "NPS",
        sampleSize: 12,
        missingCount: 0,
        missingRate: 0,
        min: 0,
        max: 10,
        mean: 5.1,
        median: 5,
        stdDev: 2,
        p25: 4,
        p75: 7,
        scaleType: "nps-0-10",
        buckets: [],
        outlierCount: 0,
        cohortComparisons: [],
      },
    ],
    opportunities: [
      {
        title: "Expose pricing earlier",
        summary: "Move fees into the first checkout step.",
        theme: "Trust before checkout",
        priority: "high",
        confidence: "high",
        evidenceFindingIds: ["finding-checkout-friction"],
        sourceCount: 1,
      },
    ],
    risks: [
      {
        title: "Checkout trust loss",
        summary: "Late fee disclosure creates abandon risk.",
        theme: "Trust before checkout",
        severity: "high",
        evidenceFindingIds: ["finding-checkout-friction"],
        sourceCount: 1,
      },
    ],
    contradictions: [],
    reports: [],
    quality: {
      overallScore: 82,
      sampleSize: 12,
      completenessScore: 90,
      sourceDiversityScore: 65,
      triangulationScore: 74,
      structureScore: 88,
      notes: [],
      generatedAt: "2026-05-07T00:00:00.000Z",
    },
    methods: {
      analysisMode: "decision-grade",
      quantitativeApproach: "Survey metrics",
      qualitativeApproach: "Interview synthesis",
      limitations: [],
    },
  };
}
