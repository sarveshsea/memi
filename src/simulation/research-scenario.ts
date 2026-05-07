import type { ResearchStore } from "../research/engine.js";
import {
  SimulationBudgetSchema,
  ProductSimulationScenarioSchema,
  type ProductSimulationScenario,
  type SimulationAgent,
  type SimulationBudget,
  type SimulationGraph,
  type SimulationGraphEdge,
  type SimulationGraphNode,
  type SimulationModelProfile,
  type SimulationVariable,
} from "./types.js";

export interface BuildScenarioOptions {
  name?: string;
  hypothesis?: string;
  variables?: SimulationVariable[];
  adapter?: ProductSimulationScenario["adapter"];
  agentCount?: number;
  budget?: Partial<SimulationBudget>;
  modelProfiles?: SimulationModelProfile[];
  now?: () => string;
}

export function buildProductSimulationScenarioFromResearch(
  store: ResearchStore,
  options: BuildScenarioOptions = {},
): ProductSimulationScenario {
  const now = options.now ?? (() => new Date().toISOString());
  const findings = store.findings ?? [];
  const themes = store.themes ?? [];
  const risks = store.risks ?? [];
  const contradictions = store.contradictions ?? [];
  const opportunities = store.opportunities ?? [];
  const metrics = store.quantitativeMetrics ?? [];
  const evidenceFindingIds = unique([
    ...findings.map((finding) => finding.id),
    ...opportunities.flatMap((opportunity) => opportunity.evidenceFindingIds ?? []),
    ...risks.flatMap((risk) => risk.evidenceFindingIds ?? []),
  ]).slice(0, 40);
  const name = options.name ?? deriveScenarioName(store);
  const hypothesis = options.hypothesis ?? deriveHypothesis(store);
  const agents = buildAgents(store, {
    targetCount: options.adapter === "model-swarm" ? clamp(Math.round(options.agentCount ?? 24), 20, 60) : options.agentCount,
  });
  const variables = options.variables?.length ? options.variables : deriveVariables(store);
  const graph = buildGraph({ agents, findings, themes, risks, opportunities, contradictions, metrics, variables });
  const budget = SimulationBudgetSchema.parse({
    ...SimulationBudgetSchema.parse({}),
    ...(options.budget ?? {}),
    maxAgents: options.adapter === "model-swarm"
      ? clamp(Math.round(options.budget?.maxAgents ?? options.agentCount ?? agents.length), 20, 60)
      : Math.round(options.budget?.maxAgents ?? agents.length),
  });

  return ProductSimulationScenarioSchema.parse({
    id: stableId("scenario", `${name}:${hypothesis}:${evidenceFindingIds.join(",")}`),
    adapter: options.adapter ?? "local",
    name,
    hypothesis,
    createdAt: now(),
    sourceSummary: {
      findings: findings.length,
      themes: themes.length,
      personas: store.personas?.length ?? 0,
      risks: risks.length,
      opportunities: opportunities.length,
      metrics: metrics.length,
      qualityScore: store.quality?.overallScore ?? null,
    },
    variables,
    agents,
    graph,
    metadata: {
      source: "memoire-research",
      evidenceFindingIds,
      licenseBoundary: "clean-room",
      modelProfiles: options.modelProfiles ?? [],
      budget,
    },
  });
}

function buildAgents(store: ResearchStore, options: { targetCount?: number } = {}): SimulationAgent[] {
  const personas = store.personas ?? [];
  let agents: SimulationAgent[];
  if (personas.length > 0) {
    agents = personas.slice(0, 12).map((persona, index) => ({
      id: stableId("agent", `${persona.name}:${persona.role}:${index}`),
      name: persona.name || `Research persona ${index + 1}`,
      role: persona.role || "Product stakeholder",
      goals: persona.goals?.length ? persona.goals.slice(0, 5) : ["Make a better product decision"],
      painPoints: persona.painPoints?.length ? persona.painPoints.slice(0, 5) : ["Missing clear evidence"],
      behaviors: persona.behaviors?.length ? persona.behaviors.slice(0, 5) : ["Reviews research before planning"],
      source: persona.source || "research",
      evidenceFindingIds: persona.evidenceFindingIds?.length ? persona.evidenceFindingIds.slice(0, 12) : inferEvidenceFromStore(store),
      influence: clamp(0.35 + (persona.confidence === "high" ? 0.35 : persona.confidence === "medium" ? 0.2 : 0.1), 0.1, 1),
    }));
    return expandAgentsForTarget(agents, store, options.targetCount);
  }

  const cohorts = unique((store.observations ?? []).map((observation) => observation.cohort).filter((cohort): cohort is string => Boolean(cohort))).slice(0, 8);
  if (cohorts.length > 0) {
    agents = cohorts.map((cohort, index) => ({
      id: stableId("agent", `${cohort}:${index}`),
      name: cohort,
      role: "Research cohort",
      goals: ["Represent cohort needs"],
      painPoints: ["Needs are not yet encoded in a product spec"],
      behaviors: ["Responds to scenario variables"],
      source: "research observations",
      evidenceFindingIds: inferEvidenceFromStore(store),
      influence: 0.5,
    }));
    return expandAgentsForTarget(agents, store, options.targetCount);
  }

  agents = [{
    id: "agent-product-team",
    name: "Product Team",
    role: "Product stakeholder",
    goals: ["Turn research into a scoped product decision"],
    painPoints: ["Research has not been pressure-tested"],
    behaviors: ["Reviews evidence and weighs tradeoffs"],
    source: "fallback",
    evidenceFindingIds: inferEvidenceFromStore(store),
    influence: 0.5,
  }];
  return expandAgentsForTarget(agents, store, options.targetCount);
}

function expandAgentsForTarget(agents: SimulationAgent[], store: ResearchStore, targetCount?: number): SimulationAgent[] {
  if (!targetCount || agents.length >= targetCount) return agents.slice(0, targetCount ?? agents.length);
  const findings = store.findings ?? [];
  const themes = store.themes ?? [];
  const roles = [
    "Primary user",
    "Power user",
    "Skeptical buyer",
    "Design partner",
    "Engineering lead",
    "Support lead",
    "Sales stakeholder",
    "Executive sponsor",
    "Risk reviewer",
    "Research participant",
  ];
  const expanded = [...agents];
  for (let index = agents.length; index < targetCount; index += 1) {
    const seed = agents[index % agents.length] ?? agents[0];
    const finding = findings[index % Math.max(findings.length, 1)];
    const theme = themes[index % Math.max(themes.length, 1)];
    const role = roles[index % roles.length];
    const label = theme?.name ?? finding?.category ?? `Segment ${index + 1}`;
    expanded.push({
      ...seed,
      id: stableId("agent", `${seed.id}:${role}:${label}:${index}`),
      name: `${seed.name} ${index + 1}`,
      role,
      goals: unique([`Represent ${label}`, ...seed.goals]).slice(0, 5),
      painPoints: unique([finding?.statement ?? "Needs stronger product evidence", ...seed.painPoints]).slice(0, 5),
      behaviors: unique([`Pressure-tests ${label}`, ...seed.behaviors]).slice(0, 5),
      source: seed.source || "memoire research swarm expansion",
      evidenceFindingIds: unique([...(finding ? [finding.id] : []), ...seed.evidenceFindingIds]).slice(0, 12),
      influence: clamp(seed.influence * (0.9 + ((index % 5) * 0.03)), 0.1, 1),
    });
  }
  return expanded;
}

function buildGraph(input: {
  agents: SimulationAgent[];
  findings: ResearchStore["findings"];
  themes: ResearchStore["themes"];
  risks: ResearchStore["risks"];
  opportunities: ResearchStore["opportunities"];
  contradictions: ResearchStore["contradictions"];
  metrics: ResearchStore["quantitativeMetrics"];
  variables: SimulationVariable[];
}): SimulationGraph {
  const nodes: SimulationGraphNode[] = [];
  const edges: SimulationGraphEdge[] = [];

  for (const agent of input.agents) {
    nodes.push({
      id: agent.id,
      label: agent.name,
      kind: "agent",
      summary: `${agent.role}: ${agent.goals[0] ?? "Product decision participant"}`,
      evidenceFindingIds: agent.evidenceFindingIds,
      weight: agent.influence,
    });
  }

  for (const finding of input.findings.slice(0, 16)) {
    nodes.push({
      id: finding.id,
      label: finding.category || "Finding",
      kind: "finding",
      summary: finding.statement,
      evidenceFindingIds: [finding.id],
      weight: confidenceWeight(finding.confidence),
    });
  }

  for (const theme of input.themes.slice(0, 10)) {
    nodes.push({
      id: theme.id,
      label: theme.name,
      kind: "theme",
      summary: theme.description,
      evidenceFindingIds: theme.findingIds,
      weight: confidenceWeight(theme.confidence),
    });
    for (const findingId of theme.findingIds.slice(0, 8)) {
      edges.push(edge(theme.id, findingId, "evidence", "theme evidence", 0.75));
    }
  }

  for (const opportunity of input.opportunities.slice(0, 10)) {
    const id = stableId("opportunity", opportunity.title);
    nodes.push({
      id,
      label: opportunity.title,
      kind: "opportunity",
      summary: opportunity.summary,
      evidenceFindingIds: opportunity.evidenceFindingIds,
      weight: priorityWeight(opportunity.priority),
    });
    for (const findingId of opportunity.evidenceFindingIds.slice(0, 8)) {
      edges.push(edge(id, findingId, "evidence", "opportunity evidence", 0.8));
    }
  }

  for (const risk of input.risks.slice(0, 10)) {
    const id = stableId("risk", risk.title);
    nodes.push({
      id,
      label: risk.title,
      kind: "risk",
      summary: risk.summary,
      evidenceFindingIds: risk.evidenceFindingIds,
      weight: priorityWeight(risk.severity),
    });
    for (const findingId of risk.evidenceFindingIds.slice(0, 8)) {
      edges.push(edge(id, findingId, "evidence", "risk evidence", 0.8));
    }
  }

  for (const contradiction of input.contradictions.slice(0, 10)) {
    const findingIds = unique([
      ...(contradiction.positiveFindingIds ?? []),
      ...(contradiction.negativeFindingIds ?? []),
    ]);
    const id = stableId("contradiction", contradiction.topic || contradiction.summary);
    nodes.push({
      id,
      label: contradiction.topic || "Contradiction",
      kind: "contradiction",
      summary: contradiction.summary,
      evidenceFindingIds: findingIds,
      weight: 0.75,
    });
    for (const findingId of findingIds.slice(0, 8)) {
      edges.push(edge(id, findingId, "conflict", "contradictory evidence", 0.8));
    }
  }

  for (const metric of input.metrics.slice(0, 8)) {
    nodes.push({
      id: metric.id,
      label: metric.label || metric.field,
      kind: "metric",
      summary: `${metric.label || metric.field}: mean ${round(metric.mean)} across ${metric.sampleSize} responses`,
      evidenceFindingIds: [],
      weight: metric.sampleSize > 0 ? 0.65 : 0.35,
    });
  }

  const firstFindingId = input.findings[0]?.id;
  for (const variable of input.variables) {
    nodes.push({
      id: variable.id,
      label: variable.name,
      kind: "variable",
      summary: `${variable.description} Current value: ${variable.value}`,
      evidenceFindingIds: firstFindingId ? [firstFindingId] : [],
      weight: 0.6,
    });
    if (firstFindingId) edges.push(edge(variable.id, firstFindingId, "variable", "variable pressure", 0.65));
  }

  for (const agent of input.agents) {
    for (const findingId of agent.evidenceFindingIds.slice(0, 8)) {
      if (input.findings.some((finding) => finding.id === findingId)) {
        edges.push(edge(agent.id, findingId, "represents", "persona evidence", agent.influence));
      }
    }
  }

  return { nodes: dedupeNodes(nodes), edges: dedupeEdges(edges) };
}

function deriveScenarioName(store: ResearchStore): string {
  const topTheme = store.themes?.[0]?.name;
  return topTheme ? `${topTheme} Scenario Lab` : "Product Research Scenario Lab";
}

function deriveHypothesis(store: ResearchStore): string {
  const opportunity = store.opportunities?.[0]?.title;
  if (opportunity) return `${opportunity} will improve the next product specification.`;
  const finding = store.findings?.[0]?.statement;
  return finding ? `Addressing "${finding}" will reduce product risk.` : "Research-backed scenario simulation will improve product decisions.";
}

function deriveVariables(store: ResearchStore): SimulationVariable[] {
  const variables = [
    ...(store.opportunities ?? []).slice(0, 3).map((opportunity) => ({
      id: stableId("variable", opportunity.title),
      name: opportunity.title,
      value: opportunity.priority,
      description: opportunity.summary,
    })),
    ...(store.risks ?? []).slice(0, 2).map((risk) => ({
      id: stableId("variable", risk.title),
      name: risk.title,
      value: risk.severity,
      description: risk.summary,
    })),
  ];
  return variables.length > 0 ? variables : [{
    id: "variable-spec-pressure",
    name: "Spec pressure",
    value: "medium",
    description: "How strongly the research should change product requirements.",
  }];
}

function inferEvidenceFromStore(store: ResearchStore): string[] {
  return (store.findings ?? []).slice(0, 8).map((finding) => finding.id);
}

function edge(source: string, target: string, kind: SimulationGraphEdge["kind"], label: string, strength: number): SimulationGraphEdge {
  return {
    id: stableId("edge", `${source}:${kind}:${target}`),
    source,
    target,
    kind,
    label,
    strength,
  };
}

function confidenceWeight(confidence: string | undefined): number {
  if (confidence === "high") return 0.9;
  if (confidence === "medium") return 0.65;
  return 0.4;
}

function priorityWeight(priority: string | undefined): number {
  if (priority === "high") return 0.9;
  if (priority === "medium") return 0.65;
  return 0.4;
}

function dedupeNodes(nodes: SimulationGraphNode[]): SimulationGraphNode[] {
  return Array.from(new Map(nodes.map((node) => [node.id, node])).values());
}

function dedupeEdges(edges: SimulationGraphEdge[]): SimulationGraphEdge[] {
  return Array.from(new Map(edges.map((next) => [next.id, next])).values());
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function stableId(prefix: string, value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return `${prefix}-${slug || "item"}-${Math.abs(hash).toString(36)}`;
}
