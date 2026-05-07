import { describe, expect, it } from "vitest";
import {
  ModelSwarmSimulationAdapter,
  SimulationModelRouter,
  SimulationRunSchema,
  buildProductSimulationScenarioFromResearch,
  exportProductSpecFromRun,
} from "../index.js";
import type { ResearchStore } from "../../research/engine.js";

describe("model swarm simulation", () => {
  it("builds a clean-room model-swarm scenario with a 20-60 agent cohort", () => {
    const scenario = buildProductSimulationScenarioFromResearch(makeResearchStore(), {
      adapter: "model-swarm",
      agentCount: 24,
      name: "Roadmap model swarm",
      hypothesis: "A model-backed swarm should expose product-spec risk faster.",
    });

    expect(scenario).toMatchObject({
      adapter: "model-swarm",
      name: "Roadmap model swarm",
      metadata: { licenseBoundary: "clean-room" },
    });
    expect(scenario.agents).toHaveLength(24);
    expect(scenario.graph.nodes.filter((node) => node.kind === "agent")).toHaveLength(24);
    expect(scenario.graph.nodes.map((node) => node.kind)).toEqual(expect.arrayContaining(["contradiction", "metric", "risk", "variable"]));
  });

  it("lists Codex-first model profiles and falls back deterministically without live credentials", async () => {
    const router = new SimulationModelRouter({
      env: {},
      resolveCommand: () => null,
      now: () => "2026-05-07T13:00:00.000Z",
    });

    const profiles = router.listProfiles();
    expect(profiles.map((profile) => profile.provider)).toEqual(expect.arrayContaining([
      "codex",
      "claude-code",
      "ollama",
      "openai-compatible",
      "anthropic-compatible",
      "deterministic",
    ]));

    const result = await router.execute(profiles[0], {
      prompt: "Pressure-test a product requirement.",
      system: "You are a product simulation agent.",
      evidenceFindingIds: ["finding-1"],
      budget: { maxAgents: 24, maxRounds: 2, maxTokens: 4000, maxWallTimeMs: 60_000, maxEstimatedCostUsd: 0, allowLiveModels: false },
    });

    expect(result.providerRun).toMatchObject({
      profileId: profiles[0].id,
      executionMode: "deterministic-fallback",
      status: "completed",
    });
    expect(result.transcript.response).toContain("deterministic fallback");
    expect(result.transcript.evidenceFindingIds).toEqual(["finding-1"]);
  });

  it("runs resumable model-swarm rounds with transcripts, provider runs, costs, and scorecards", async () => {
    const scenario = buildProductSimulationScenarioFromResearch(makeResearchStore(), {
      adapter: "model-swarm",
      agentCount: 20,
      name: "Spec impact swarm",
      hypothesis: "Earlier assumption testing will reduce roadmap churn.",
    });
    const adapter = new ModelSwarmSimulationAdapter({
      now: () => "2026-05-07T13:00:00.000Z",
      router: new SimulationModelRouter({
        env: {},
        resolveCommand: () => null,
        now: () => "2026-05-07T13:00:00.000Z",
      }),
      defaultBudget: { maxAgents: 20, maxRounds: 2, maxTokens: 6000, maxWallTimeMs: 60_000, maxEstimatedCostUsd: 0, allowLiveModels: false },
    });

    const prepared = await adapter.prepare(scenario);
    const run = await adapter.start(prepared.scenario.id);
    const streamed = [];
    for await (const event of adapter.stream(run.id)) streamed.push(event);
    const interview = await adapter.interview(run.id, { agentId: prepared.scenario.agents[0].id, prompt: "What changed in the spec?" });
    const report = await adapter.exportReport(run.id);
    const spec = exportProductSpecFromRun(report);

    expect(run).toMatchObject({
      adapter: "model-swarm",
      status: "completed",
      budget: { maxAgents: 20, maxRounds: 2, allowLiveModels: false },
      scorecard: expect.objectContaining({ adoption: expect.any(Number), confidence: expect.any(Number) }),
      costs: expect.objectContaining({ estimatedCostUsd: 0 }),
    });
    expect(run.rounds).toHaveLength(2);
    expect(run.transcripts.length).toBeGreaterThanOrEqual(40);
    expect(run.providerRuns.length).toBe(run.transcripts.length);
    expect(run.events.map((event) => event.kind)).toEqual(expect.arrayContaining(["model-response", "round-summary", "scorecard"]));
    expect(streamed).toHaveLength(run.eventCount);
    expect(interview.answer).toContain("transcript memory");
    expect(report).toMatchObject({
      scorecard: expect.objectContaining({ risk: expect.any(Number) }),
      modelProfiles: expect.arrayContaining([expect.objectContaining({ provider: "codex" })]),
      providerRuns: expect.arrayContaining([expect.objectContaining({ executionMode: "deterministic-fallback" })]),
    });
    expect(spec.sections.map((section) => section.title)).toEqual(expect.arrayContaining([
      "Model Swarm Scorecard",
      "Model Disagreements",
      "Product Spec Diff",
    ]));
  });

  it("normalizes legacy local run JSON with V2 defaults", () => {
    const parsed = SimulationRunSchema.parse({
      id: "run-legacy",
      scenarioId: "scenario-legacy",
      adapter: "local",
      status: "completed",
      startedAt: "2026-05-07T13:00:00.000Z",
      completedAt: "2026-05-07T13:00:00.000Z",
      eventCount: 0,
      events: [],
    });

    expect(parsed.rounds).toEqual([]);
    expect(parsed.transcripts).toEqual([]);
    expect(parsed.providerRuns).toEqual([]);
    expect(parsed.modelProfiles).toEqual([]);
    expect(parsed.budget.allowLiveModels).toBe(false);
  });
});

function makeResearchStore(): ResearchStore {
  return {
    version: 2,
    sources: [{ id: "source-1", name: "research/interviews.csv", type: "csv", processedAt: "2026-05-07T00:00:00.000Z", sourceKind: "mixed", itemCount: 12 }],
    observations: [],
    highlights: [],
    codebook: [],
    findings: [
      {
        id: "finding-1",
        statement: "Product teams miss launch risks when assumptions are not rehearsed.",
        category: "planning",
        confidence: "high",
        themeIds: ["theme-1"],
        evidenceObservationIds: [],
        evidenceSourceIds: ["source-1"],
        sourceTypeCount: 1,
        method: "qualitative",
        caveats: [],
        tags: ["planning"],
        entities: ["Roadmap"],
        signalTags: ["planning"],
        createdAt: "2026-05-07T00:00:00.000Z",
      },
      {
        id: "finding-2",
        statement: "Design partners want evidence links embedded in every requirement.",
        category: "handoff",
        confidence: "medium",
        themeIds: ["theme-1"],
        evidenceObservationIds: [],
        evidenceSourceIds: ["source-1"],
        sourceTypeCount: 1,
        method: "qualitative",
        caveats: [],
        tags: ["handoff"],
        entities: ["Spec"],
        signalTags: ["handoff"],
        createdAt: "2026-05-07T00:00:00.000Z",
      },
    ],
    themes: [{ id: "theme-1", name: "Spec rehearsal", description: "Teams need to rehearse spec assumptions.", findingIds: ["finding-1", "finding-2"], frequency: 8, sourceCount: 1, sourceTypeCount: 1, confidence: "high", signalTags: ["spec"], positiveCount: 2, negativeCount: 6 }],
    evidenceLinks: [],
    personas: [
      { name: "Product Lead", role: "Product manager", goals: ["Reduce roadmap churn"], painPoints: ["Assumptions surface too late"], behaviors: ["Reviews launch risk weekly"], source: "research/interviews.csv", confidence: "high", evidenceFindingIds: ["finding-1"] },
      { name: "Design Partner", role: "Designer", goals: ["Ship coherent handoffs"], painPoints: ["Requirements lack evidence"], behaviors: ["Checks each spec section"], source: "research/interviews.csv", confidence: "medium", evidenceFindingIds: ["finding-2"] },
    ],
    quantitativeMetrics: [{ id: "metric-1", source: "research/interviews.csv", field: "risk_score", label: "Risk score", sampleSize: 12, missingCount: 0, missingRate: 0, min: 1, max: 5, mean: 3.8, median: 4, stdDev: 0.8, p25: 3, p75: 5, scaleType: "likert-1-5", buckets: [], outlierCount: 0, cohortComparisons: [] }],
    opportunities: [{ title: "Run spec rehearsal before build", summary: "Use agent simulation before roadmap handoff.", theme: "Spec rehearsal", priority: "high", confidence: "high", evidenceFindingIds: ["finding-1", "finding-2"], sourceCount: 1 }],
    risks: [{ title: "False certainty", summary: "Teams may overtrust simulation output without evidence.", theme: "Spec rehearsal", severity: "high", evidenceFindingIds: ["finding-1"], sourceCount: 1 }],
    contradictions: [{ topic: "Speed versus evidence", summary: "PMs want faster specs while designers want stricter evidence.", positiveFindingIds: ["finding-1"], negativeFindingIds: ["finding-2"] }],
    reports: [],
    quality: { overallScore: 82, sampleSize: 12, completenessScore: 82, sourceDiversityScore: 65, triangulationScore: 70, structureScore: 90, notes: [], generatedAt: "2026-05-07T00:00:00.000Z" },
    methods: { analysisMode: "decision-grade", quantitativeApproach: "Risk scoring", qualitativeApproach: "Thematic coding", limitations: [] },
  };
}
