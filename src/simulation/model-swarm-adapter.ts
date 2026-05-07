import {
  ProductSimulationScenarioSchema,
  SimulationBudgetSchema,
  SimulationComparisonSchema,
  SimulationEventSchema,
  SimulationInterviewResultSchema,
  SimulationReportSchema,
  SimulationRunSchema,
  SimulationRoundSchema,
  SimulationScorecardSchema,
  type ProductSimulationScenario,
  type SimulationAdapter,
  type SimulationBudget,
  type SimulationComparison,
  type SimulationEvent,
  type SimulationInterviewRequest,
  type SimulationInterviewResult,
  type SimulationModelProfile,
  type SimulationPrepareResult,
  type SimulationProviderRun,
  type SimulationReport,
  type SimulationRound,
  type SimulationRun,
  type SimulationScorecard,
  type SimulationTranscript,
} from "./types.js";
import { stableId } from "./research-scenario.js";
import { FileSimulationStore } from "./store.js";
import { SimulationModelRouter } from "./model-router.js";

export interface ModelSwarmSimulationAdapterOptions {
  store?: FileSimulationStore;
  router?: SimulationModelRouter;
  defaultBudget?: Partial<SimulationBudget>;
  now?: () => string;
}

export class ModelSwarmSimulationAdapter implements SimulationAdapter {
  private scenarios = new Map<string, ProductSimulationScenario>();
  private runs = new Map<string, SimulationRun>();
  private readonly store?: FileSimulationStore;
  private readonly router: SimulationModelRouter;
  private readonly defaultBudget: SimulationBudget;
  private readonly budgetOverrides: Partial<SimulationBudget>;
  private readonly now: () => string;

  constructor(options: ModelSwarmSimulationAdapterOptions = {}) {
    this.store = options.store;
    this.router = options.router ?? new SimulationModelRouter({ now: options.now });
    this.now = options.now ?? (() => new Date().toISOString());
    this.budgetOverrides = options.defaultBudget ?? {};
    this.defaultBudget = SimulationBudgetSchema.parse({
      ...SimulationBudgetSchema.parse({}),
      ...this.budgetOverrides,
    });
  }

  async prepare(scenario: ProductSimulationScenario): Promise<SimulationPrepareResult> {
    const modelProfiles = this.router.listProfiles();
    const parsed = ProductSimulationScenarioSchema.parse({
      ...scenario,
      adapter: "model-swarm",
      metadata: {
        ...scenario.metadata,
        modelProfiles,
        budget: this.resolveBudget(scenario.metadata?.budget),
      },
    });
    this.scenarios.set(parsed.id, parsed);
    await this.store?.saveScenario(parsed);
    return {
      adapter: "model-swarm",
      scenario: parsed,
      warnings: parsed.metadata.licenseBoundary === "clean-room" ? [] : ["Scenario is not marked clean-room."],
    };
  }

  async start(scenarioId: string): Promise<SimulationRun> {
    const scenario = await this.requireScenario(scenarioId);
    const budget = this.resolveBudget(scenario.metadata.budget);
    const runId = stableId("run", `${scenario.id}:${this.now()}:model-swarm`);
    const startedAt = this.now();
    const modelProfiles = ensureModelDiversity(scenario.metadata.modelProfiles.length ? scenario.metadata.modelProfiles : this.router.listProfiles());
    const activeAgents = scenario.agents.slice(0, budget.maxAgents);
    const events: SimulationEvent[] = [];
    const rounds: SimulationRound[] = [];
    const transcripts: SimulationTranscript[] = [];
    const providerRuns: SimulationProviderRun[] = [];

    for (let roundIndex = 1; roundIndex <= budget.maxRounds; roundIndex += 1) {
      const roundId = stableId("round", `${runId}:${roundIndex}`);
      const phase = phaseForRound(roundIndex, budget.maxRounds);
      const roundStartedAt = this.now();
      const roundEvent = SimulationEventSchema.parse({
        id: stableId("event", `${roundId}:start`),
        runId,
        scenarioId: scenario.id,
        kind: "round-start",
        timestamp: roundStartedAt,
        title: `Round ${roundIndex}: ${phase}`,
        summary: `${activeAgents.length} agents evaluate "${scenario.hypothesis}" using ${modelProfiles.length} model profile${modelProfiles.length === 1 ? "" : "s"}.`,
        impact: "neutral",
        evidenceFindingIds: scenario.metadata.evidenceFindingIds.slice(0, 8),
        data: { phase, modelProfileIds: modelProfiles.map((profile) => profile.id) },
      });
      events.push(roundEvent);
      const roundEventIds = [roundEvent.id];
      const roundTranscriptIds: string[] = [];

      for (let agentIndex = 0; agentIndex < activeAgents.length; agentIndex += 1) {
        const agent = activeAgents[agentIndex];
        const profile = modelProfiles[agentIndex % modelProfiles.length];
        const result = await this.router.execute(profile, {
          system: "You are a clean-room product simulation agent inside Memoire. Use only supplied scenario context and cite evidence ids.",
          prompt: buildRoundPrompt(scenario, agent, phase, roundIndex),
          runId,
          scenarioId: scenario.id,
          roundId,
          agentId: agent.id,
          evidenceFindingIds: agent.evidenceFindingIds.length ? agent.evidenceFindingIds : scenario.metadata.evidenceFindingIds.slice(0, 3),
          budget,
        });
        transcripts.push(result.transcript);
        providerRuns.push(result.providerRun);
        roundTranscriptIds.push(result.transcript.id);
        const event = SimulationEventSchema.parse({
          id: stableId("event", `${result.transcript.id}:model-response`),
          runId,
          scenarioId: scenario.id,
          kind: "model-response",
          timestamp: result.transcript.completedAt,
          title: `${agent.name} responds via ${profile.label}`,
          summary: result.transcript.response,
          impact: impactForAgent(agent),
          agentId: agent.id,
          evidenceFindingIds: result.transcript.evidenceFindingIds,
          data: {
            modelProfileId: profile.id,
            transcriptId: result.transcript.id,
            providerRunId: result.providerRun.id,
            fallback: result.transcript.fallback,
          },
        });
        events.push(event);
        roundEventIds.push(event.id);
      }

      const roundScorecard = buildScorecard(scenario, providerRuns, transcripts, modelProfiles, activeAgents);
      const summary = SimulationEventSchema.parse({
        id: stableId("event", `${roundId}:summary`),
        runId,
        scenarioId: scenario.id,
        kind: "round-summary",
        timestamp: this.now(),
        title: `Round ${roundIndex} synthesis`,
        summary: `Adoption ${percent(roundScorecard.adoption)}, resistance ${percent(roundScorecard.resistance)}, risk ${percent(roundScorecard.risk)}.`,
        impact: roundScorecard.risk > 0.65 ? "mixed" : "positive",
        evidenceFindingIds: scenario.metadata.evidenceFindingIds.slice(0, 8),
        data: { scorecard: roundScorecard, transcriptIds: roundTranscriptIds },
      });
      events.push(summary);
      roundEventIds.push(summary.id);
      rounds.push(SimulationRoundSchema.parse({
        id: roundId,
        runId,
        scenarioId: scenario.id,
        index: roundIndex,
        phase,
        status: "completed",
        startedAt: roundStartedAt,
        completedAt: this.now(),
        agentIds: activeAgents.map((agent) => agent.id),
        eventIds: roundEventIds,
        transcriptIds: roundTranscriptIds,
        scorecard: roundScorecard,
      }));
    }

    const scorecard = buildScorecard(scenario, providerRuns, transcripts, modelProfiles, activeAgents);
    const scoreEvent = SimulationEventSchema.parse({
      id: stableId("event", `${runId}:scorecard`),
      runId,
      scenarioId: scenario.id,
      kind: "scorecard",
      timestamp: this.now(),
      title: "Model swarm scorecard",
      summary: `Model swarm confidence ${percent(scorecard.confidence)} with ${percent(scorecard.evidenceCoverage)} evidence coverage.`,
      impact: scorecard.risk > 0.7 ? "mixed" : "positive",
      evidenceFindingIds: scenario.metadata.evidenceFindingIds,
      data: { scorecard },
    });
    const outcome = SimulationEventSchema.parse({
      id: stableId("event", `${runId}:outcome`),
      runId,
      scenarioId: scenario.id,
      kind: "outcome",
      timestamp: this.now(),
      title: "Spec impact outcome",
      summary: scorecard.recommendations[0] ?? "Convert model disagreements into measurable spec acceptance criteria.",
      impact: scorecard.adoption >= scorecard.resistance ? "positive" : "mixed",
      evidenceFindingIds: scenario.metadata.evidenceFindingIds.slice(0, 12),
      data: { scorecard },
    });
    events.push(scoreEvent, outcome);

    const run = SimulationRunSchema.parse({
      id: runId,
      scenarioId: scenario.id,
      adapter: "model-swarm",
      status: "completed",
      startedAt,
      completedAt: this.now(),
      eventCount: events.length,
      events,
      interviews: [],
      budget,
      modelProfiles,
      providerRuns,
      rounds,
      transcripts,
      scorecard,
      costs: sumUsage(providerRuns),
      error: null,
    });
    this.runs.set(run.id, run);
    await this.store?.saveRun(run);
    return run;
  }

  async *stream(runId: string): AsyncIterable<SimulationEvent> {
    const run = await this.requireRun(runId);
    for (const event of run.events) yield event;
  }

  async interview(runId: string, request: SimulationInterviewRequest): Promise<SimulationInterviewResult> {
    const run = await this.requireRun(runId);
    const scenario = await this.requireScenario(run.scenarioId);
    const agent = scenario.agents.find((candidate) => candidate.id === request.agentId) ?? scenario.agents[0];
    if (!agent) throw new Error(`No agents available for run ${runId}`);
    const agentTranscripts = run.transcripts.filter((transcript) => transcript.agentId === agent.id);
    const memory = agentTranscripts.at(-1)?.response ?? run.transcripts.at(-1)?.response ?? "No transcript memory exists yet.";
    const evidenceFindingIds = unique([
      ...agent.evidenceFindingIds,
      ...agentTranscripts.flatMap((transcript) => transcript.evidenceFindingIds),
    ]).slice(0, 8);
    const interview = SimulationInterviewResultSchema.parse({
      id: stableId("interview", `${runId}:${agent.id}:${request.prompt}`),
      runId,
      agentId: agent.id,
      agentName: agent.name,
      prompt: request.prompt,
      answer: `${agent.name} answers from transcript memory: ${memory} The spec should preserve cited evidence, expose assumptions, and keep a validation metric attached to the decision.`,
      evidenceFindingIds,
      createdAt: this.now(),
    });
    const event = SimulationEventSchema.parse({
      id: stableId("event", `${interview.id}:interview`),
      runId,
      scenarioId: scenario.id,
      kind: "interview",
      timestamp: interview.createdAt,
      title: `Interview: ${agent.name}`,
      summary: interview.answer,
      impact: "neutral",
      agentId: agent.id,
      evidenceFindingIds,
      data: { prompt: request.prompt },
    });
    const nextRun = SimulationRunSchema.parse({
      ...run,
      interviews: [...run.interviews, interview],
      events: [...run.events, event],
      eventCount: run.eventCount + 1,
    });
    this.runs.set(nextRun.id, nextRun);
    await this.store?.saveRun(nextRun);
    return interview;
  }

  async stop(runId: string): Promise<SimulationRun> {
    const run = await this.requireRun(runId);
    const stopped = SimulationRunSchema.parse({ ...run, status: "stopped", completedAt: this.now() });
    this.runs.set(stopped.id, stopped);
    await this.store?.saveRun(stopped);
    return stopped;
  }

  async exportReport(runId: string): Promise<SimulationReport> {
    const run = await this.requireRun(runId);
    const scenario = await this.requireScenario(run.scenarioId);
    const evidenceFindingIds = unique([
      ...scenario.metadata.evidenceFindingIds,
      ...run.events.flatMap((event) => event.evidenceFindingIds),
      ...run.interviews.flatMap((interview) => interview.evidenceFindingIds),
      ...run.transcripts.flatMap((transcript) => transcript.evidenceFindingIds),
    ]);
    return SimulationReportSchema.parse({
      id: stableId("report", run.id),
      runId: run.id,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      hypothesis: scenario.hypothesis,
      generatedAt: this.now(),
      summary: `${scenario.name} ran ${run.rounds.length} model-swarm round${run.rounds.length === 1 ? "" : "s"} across ${run.transcripts.length} transcript turns and ${run.modelProfiles.length} model profile${run.modelProfiles.length === 1 ? "" : "s"}.`,
      recommendations: run.scorecard.recommendations.length
        ? run.scorecard.recommendations
        : ["Convert model disagreements into product-spec acceptance criteria."],
      risks: unique([
        ...scenario.graph.nodes.filter((node) => node.kind === "risk").map((node) => node.summary),
        ...(run.scorecard.risk > 0.65 ? ["High model-swarm risk score; require live validation before roadmap commitment."] : []),
      ]).slice(0, 8),
      unresolvedAssumptions: [
        "Live user evidence remains the source of truth after simulation.",
        ...(run.costs.estimatedCostUsd > run.budget.maxEstimatedCostUsd && run.budget.maxEstimatedCostUsd > 0
          ? ["Estimated model spend exceeded the configured budget."]
          : []),
      ],
      evidenceFindingIds,
      events: run.events,
      interviews: run.interviews,
      budget: run.budget,
      modelProfiles: run.modelProfiles,
      providerRuns: run.providerRuns,
      rounds: run.rounds,
      transcripts: run.transcripts,
      scorecard: run.scorecard,
      costs: run.costs,
      comparisons: [],
    });
  }

  private resolveBudget(input?: Partial<SimulationBudget>): SimulationBudget {
    return SimulationBudgetSchema.parse({
      ...this.defaultBudget,
      ...(input ?? {}),
      ...this.budgetOverrides,
      maxAgents: clamp(Math.round(this.budgetOverrides.maxAgents ?? input?.maxAgents ?? this.defaultBudget.maxAgents), 1, 60),
      maxRounds: clamp(Math.round(this.budgetOverrides.maxRounds ?? input?.maxRounds ?? this.defaultBudget.maxRounds), 1, 12),
    });
  }

  private async requireScenario(id: string): Promise<ProductSimulationScenario> {
    const scenario = this.scenarios.get(id) ?? await this.store?.loadScenario(id);
    if (!scenario) throw new Error(`Unknown simulation scenario: ${id}`);
    this.scenarios.set(scenario.id, scenario);
    return scenario;
  }

  private async requireRun(id: string): Promise<SimulationRun> {
    const run = this.runs.get(id) ?? await this.store?.loadRun(id);
    if (!run) throw new Error(`Unknown simulation run: ${id}`);
    this.runs.set(run.id, run);
    return run;
  }
}

export function compareSimulationRuns(runs: SimulationRun[], now = new Date().toISOString()): SimulationComparison {
  const rows = runs.map((run) => ({
    runId: run.id,
    scenarioId: run.scenarioId,
    score: clamp(round((run.scorecard.adoption + run.scorecard.confidence + run.scorecard.evidenceCoverage - run.scorecard.risk) / 3), 0, 1),
    adoption: run.scorecard.adoption,
    risk: run.scorecard.risk,
    confidence: run.scorecard.confidence,
    estimatedCostUsd: run.costs.estimatedCostUsd,
  }));
  const winner = rows.slice().sort((a, b) => b.score - a.score)[0] ?? null;
  return SimulationComparisonSchema.parse({
    id: stableId("comparison", `${runs.map((run) => run.id).join(":")}:${now}`),
    generatedAt: now,
    runIds: runs.map((run) => run.id),
    winnerRunId: winner?.runId ?? null,
    summary: winner
      ? `${winner.runId} has the strongest score after balancing adoption, confidence, evidence coverage, risk, and cost.`
      : "No runs were available for comparison.",
    runs: rows,
  });
}

export function simulationCosts(run: SimulationRun) {
  return {
    ...run.costs,
    providerRuns: run.providerRuns.length,
    liveProviderRuns: run.providerRuns.filter((providerRun) => providerRun.executionMode === "live").length,
    fallbackProviderRuns: run.providerRuns.filter((providerRun) => providerRun.executionMode === "deterministic-fallback").length,
    maxEstimatedCostUsd: run.budget.maxEstimatedCostUsd,
  };
}

function buildRoundPrompt(scenario: ProductSimulationScenario, agent: ProductSimulationScenario["agents"][number], phase: SimulationRound["phase"], roundIndex: number): string {
  const variableSummary = scenario.variables.map((variable) => `${variable.name}=${variable.value}`).join("; ") || "no explicit variables";
  return [
    `Scenario: ${scenario.name}`,
    `Hypothesis: ${scenario.hypothesis}`,
    `Round ${roundIndex} phase: ${phase}`,
    `Agent: ${agent.name} (${agent.role})`,
    `Goals: ${agent.goals.join("; ")}`,
    `Pain points: ${agent.painPoints.join("; ")}`,
    `Variables: ${variableSummary}`,
    `Evidence ids: ${agent.evidenceFindingIds.join(", ") || scenario.metadata.evidenceFindingIds.slice(0, 5).join(", ") || "none"}`,
    "Return a concise product-spec impact judgment with adoption, resistance, risks, and the next requirement change.",
  ].join("\n");
}

function buildScorecard(
  scenario: ProductSimulationScenario,
  providerRuns: SimulationProviderRun[],
  transcripts: SimulationTranscript[],
  modelProfiles: SimulationModelProfile[],
  agents: ProductSimulationScenario["agents"],
): SimulationScorecard {
  const evidenceIds = new Set(transcripts.flatMap((transcript) => transcript.evidenceFindingIds));
  const fallbackRatio = providerRuns.length ? providerRuns.filter((run) => run.executionMode === "deterministic-fallback").length / providerRuns.length : 1;
  const riskNodes = scenario.graph.nodes.filter((node) => node.kind === "risk").length;
  const contradictionNodes = scenario.graph.nodes.filter((node) => node.kind === "contradiction").length;
  const modelProviderCount = new Set(modelProfiles.map((profile) => profile.provider)).size;
  const adoption = clamp(round(0.42 + (scenario.variables.length * 0.04) + (evidenceIds.size * 0.01)), 0.05, 0.95);
  const resistance = clamp(round(0.18 + (riskNodes * 0.05) + (contradictionNodes * 0.06) + (fallbackRatio * 0.08)), 0.05, 0.9);
  const evidenceCoverage = clamp(round(evidenceIds.size / Math.max(1, scenario.metadata.evidenceFindingIds.length)), 0, 1);
  const modelDiversity = clamp(round(modelProviderCount / 5), 0.2, 1);
  const risk = clamp(round(0.2 + (riskNodes * 0.08) + (contradictionNodes * 0.08) + Math.max(0, resistance - adoption) * 0.5), 0.05, 0.95);
  const confidence = clamp(round((evidenceCoverage * 0.45) + (modelDiversity * 0.25) + ((1 - risk) * 0.2) + (Math.min(agents.length, 60) / 60 * 0.1)), 0.05, 0.95);
  return SimulationScorecardSchema.parse({
    adoption,
    resistance,
    confidence,
    risk,
    evidenceCoverage,
    modelDiversity,
    recommendations: [
      "Add evidence ids to each product requirement before handoff.",
      "Convert the strongest model disagreement into an explicit validation question.",
      "Attach one measurable acceptance metric to the simulated variable.",
    ],
  });
}

function ensureModelDiversity(profiles: SimulationModelProfile[]): SimulationModelProfile[] {
  const enabled = profiles.filter((profile) => profile.enabled);
  const codex = enabled.find((profile) => profile.provider === "codex");
  const deterministic = enabled.find((profile) => profile.provider === "deterministic");
  const diverse = uniqueBy([
    ...(codex ? [codex] : []),
    ...enabled.filter((profile) => profile.provider !== "codex" && profile.provider !== "deterministic").slice(0, 4),
    ...(deterministic ? [deterministic] : []),
  ], (profile) => profile.id);
  return diverse.length ? diverse : enabled.slice(0, 1);
}

function phaseForRound(index: number, maxRounds: number): SimulationRound["phase"] {
  if (index === 1) return "briefing";
  if (index === maxRounds) return "synthesis";
  return index % 2 === 0 ? "debate" : "variable-injection";
}

function impactForAgent(agent: ProductSimulationScenario["agents"][number]): SimulationEvent["impact"] {
  if (agent.painPoints.length > agent.goals.length + 1) return "negative";
  if (agent.goals.length > agent.painPoints.length) return "positive";
  return "mixed";
}

function sumUsage(providerRuns: SimulationProviderRun[]) {
  return providerRuns.reduce((usage, run) => ({
    inputTokens: usage.inputTokens + run.usage.inputTokens,
    outputTokens: usage.outputTokens + run.usage.outputTokens,
    estimatedCostUsd: round(usage.estimatedCostUsd + run.usage.estimatedCostUsd),
  }), { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 });
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function uniqueBy<T>(values: T[], key: (value: T) => string): T[] {
  return Array.from(new Map(values.map((value) => [key(value), value])).values());
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
