import {
  ProductSimulationScenarioSchema,
  SimulationEventSchema,
  SimulationInterviewResultSchema,
  SimulationReportSchema,
  SimulationRunSchema,
  type ProductSimulationScenario,
  type SimulationAdapter,
  type SimulationEvent,
  type SimulationInterviewRequest,
  type SimulationInterviewResult,
  type SimulationPrepareResult,
  type SimulationReport,
  type SimulationRun,
} from "./types.js";
import { stableId } from "./research-scenario.js";
import { FileSimulationStore } from "./store.js";

export interface LocalSimulationAdapterOptions {
  store?: FileSimulationStore;
  now?: () => string;
}

export class LocalSimulationAdapter implements SimulationAdapter {
  private scenarios = new Map<string, ProductSimulationScenario>();
  private runs = new Map<string, SimulationRun>();
  private readonly store?: FileSimulationStore;
  private readonly now: () => string;

  constructor(options: LocalSimulationAdapterOptions = {}) {
    this.store = options.store;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async prepare(scenario: ProductSimulationScenario): Promise<SimulationPrepareResult> {
    const parsed = ProductSimulationScenarioSchema.parse({ ...scenario, adapter: "local" });
    this.scenarios.set(parsed.id, parsed);
    await this.store?.saveScenario(parsed);
    return {
      adapter: "local",
      scenario: parsed,
      warnings: parsed.metadata.licenseBoundary === "clean-room" ? [] : ["Scenario is not marked clean-room."],
    };
  }

  async start(scenarioId: string): Promise<SimulationRun> {
    const scenario = await this.requireScenario(scenarioId);
    const runId = stableId("run", `${scenario.id}:${this.now()}`);
    const startedAt = this.now();
    const events = buildEvents(runId, scenario, startedAt);
    const run = SimulationRunSchema.parse({
      id: runId,
      scenarioId: scenario.id,
      adapter: "local",
      status: "completed",
      startedAt,
      completedAt: this.now(),
      eventCount: events.length,
      events,
      interviews: [],
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
    const primaryFinding = agent.evidenceFindingIds[0] ?? scenario.metadata.evidenceFindingIds[0];
    const recommendation = scenario.graph.nodes.find((node) => node.kind === "opportunity")?.summary
      ?? "Tighten the product spec around the highest-confidence research evidence.";
    const interview = SimulationInterviewResultSchema.parse({
      id: stableId("interview", `${runId}:${agent.id}:${request.prompt}`),
      runId,
      agentId: agent.id,
      agentName: agent.name,
      prompt: request.prompt,
      answer: `${agent.name} (${agent.role}) would update the spec by anchoring requirements to ${recommendation}`,
      evidenceFindingIds: primaryFinding ? [primaryFinding] : [],
      createdAt: this.now(),
    });
    const nextRun = SimulationRunSchema.parse({
      ...run,
      interviews: [...run.interviews, interview],
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
    const recommendations = unique([
      ...scenario.graph.nodes.filter((node) => node.kind === "opportunity").map((node) => node.summary),
      ...run.events.filter((event) => event.kind === "outcome").map((event) => event.summary),
    ]).filter(Boolean).slice(0, 8);
    const risks = unique([
      ...scenario.graph.nodes.filter((node) => node.kind === "risk").map((node) => node.summary),
      ...run.events.filter((event) => event.kind === "risk-signal").map((event) => event.summary),
    ]).filter(Boolean).slice(0, 8);
    const evidenceFindingIds = unique([
      ...scenario.metadata.evidenceFindingIds,
      ...run.events.flatMap((event) => event.evidenceFindingIds),
      ...run.interviews.flatMap((interview) => interview.evidenceFindingIds),
    ]);

    return SimulationReportSchema.parse({
      id: stableId("report", run.id),
      runId: run.id,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      hypothesis: scenario.hypothesis,
      generatedAt: this.now(),
      summary: `${scenario.name} tested "${scenario.hypothesis}" with ${scenario.agents.length} research-backed agent${scenario.agents.length === 1 ? "" : "s"} and ${run.events.length} simulated event${run.events.length === 1 ? "" : "s"}.`,
      recommendations: recommendations.length ? recommendations : ["Convert the strongest research finding into a product requirement before handoff."],
      risks: risks.length ? risks : ["Evidence coverage is narrow; validate with another research source before a major roadmap bet."],
      unresolvedAssumptions: buildUnresolvedAssumptions(scenario),
      evidenceFindingIds,
      events: run.events,
      interviews: run.interviews,
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

function buildEvents(runId: string, scenario: ProductSimulationScenario, timestamp: string): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  const primaryFinding = scenario.metadata.evidenceFindingIds[0];
  for (const agent of scenario.agents) {
    const strongestPain = agent.painPoints[0] ?? "unclear product evidence";
    events.push(SimulationEventSchema.parse({
      id: stableId("event", `${runId}:${agent.id}:reaction`),
      runId,
      scenarioId: scenario.id,
      kind: "agent-reaction",
      timestamp,
      title: `${agent.name} reacts to the hypothesis`,
      summary: `${agent.role} pressure-tests the scenario against ${strongestPain}.`,
      impact: agent.painPoints.length > agent.goals.length ? "negative" : "mixed",
      agentId: agent.id,
      evidenceFindingIds: agent.evidenceFindingIds,
      data: { influence: agent.influence },
    }));
  }

  for (const variable of scenario.variables) {
    events.push(SimulationEventSchema.parse({
      id: stableId("event", `${runId}:${variable.id}:shift`),
      runId,
      scenarioId: scenario.id,
      kind: "variable-shift",
      timestamp,
      title: `${variable.name} changes the scenario`,
      summary: `${variable.description} (${variable.value}) changes how agents prioritize the spec.`,
      impact: "mixed",
      evidenceFindingIds: primaryFinding ? [primaryFinding] : [],
      data: { variable },
    }));
  }

  for (const risk of scenario.graph.nodes.filter((node) => node.kind === "risk").slice(0, 4)) {
    events.push(SimulationEventSchema.parse({
      id: stableId("event", `${runId}:${risk.id}:risk`),
      runId,
      scenarioId: scenario.id,
      kind: "risk-signal",
      timestamp,
      title: risk.label,
      summary: risk.summary,
      impact: "negative",
      evidenceFindingIds: risk.evidenceFindingIds,
    }));
  }

  const opportunity = scenario.graph.nodes.find((node) => node.kind === "opportunity");
  events.push(SimulationEventSchema.parse({
    id: stableId("event", `${runId}:outcome`),
    runId,
    scenarioId: scenario.id,
    kind: "outcome",
    timestamp,
    title: "Spec impact outcome",
    summary: opportunity?.summary ?? "Prioritize the clearest research-backed requirement and record remaining assumptions.",
    impact: opportunity ? "positive" : "neutral",
    evidenceFindingIds: opportunity?.evidenceFindingIds ?? scenario.metadata.evidenceFindingIds.slice(0, 5),
  }));

  return events;
}

function buildUnresolvedAssumptions(scenario: ProductSimulationScenario): string[] {
  const assumptions = [];
  if (scenario.sourceSummary.qualityScore !== null && scenario.sourceSummary.qualityScore < 70) {
    assumptions.push("Research quality is below the decision-grade threshold; run another source before shipping.");
  }
  if (scenario.sourceSummary.personas < 2) {
    assumptions.push("Only one persona/cohort is represented; verify whether other product stakeholders disagree.");
  }
  if (scenario.sourceSummary.metrics === 0) {
    assumptions.push("No quantitative metric is attached to this scenario; define a measurable acceptance signal.");
  }
  return assumptions.length ? assumptions : ["Confirm the simulated recommendation with live user or customer evidence before launch."];
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}
