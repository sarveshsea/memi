import { z } from "zod";

type Schema<T> = z.ZodType<T, z.ZodTypeDef, unknown>;

export const SimulationAdapterKindSchema = z.enum(["local", "model-swarm", "mirofish"]);
export type SimulationAdapterKind = z.infer<typeof SimulationAdapterKindSchema>;

export const SimulationModelProviderSchema = z.enum([
  "codex",
  "claude-code",
  "ollama",
  "openai-compatible",
  "anthropic-compatible",
  "deterministic",
]);
export type SimulationModelProvider = z.infer<typeof SimulationModelProviderSchema>;

export const SimulationExecutionModeSchema = z.enum(["live", "deterministic-fallback", "skipped"]);
export type SimulationExecutionMode = z.infer<typeof SimulationExecutionModeSchema>;

export interface SimulationBudget {
  maxAgents: number;
  maxRounds: number;
  maxTokens: number;
  maxWallTimeMs: number;
  maxEstimatedCostUsd: number;
  allowLiveModels: boolean;
}

export const SimulationBudgetSchema: Schema<SimulationBudget> = z.object({
  maxAgents: z.number().int().min(1).max(60).default(24),
  maxRounds: z.number().int().min(1).max(12).default(3),
  maxTokens: z.number().int().min(1).default(48_000),
  maxWallTimeMs: z.number().int().min(1000).default(300_000),
  maxEstimatedCostUsd: z.number().min(0).default(0),
  allowLiveModels: z.boolean().default(false),
});

export interface SimulationUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export const SimulationUsageSchema: Schema<SimulationUsage> = z.object({
  inputTokens: z.number().int().min(0).default(0),
  outputTokens: z.number().int().min(0).default(0),
  estimatedCostUsd: z.number().min(0).default(0),
});

export interface SimulationModelProfile {
  id: string;
  label: string;
  provider: SimulationModelProvider;
  model: string;
  reasoningEffort: string | null;
  enabled: boolean;
  available: boolean;
  source: "studio-harness" | "provider-env" | "local" | "fallback";
  requiresCredential: boolean;
  credentialEnv: string | null;
  baseUrl: string | null;
  command: string | null;
  notes: string[];
}

export const SimulationModelProfileSchema: Schema<SimulationModelProfile> = z.object({
  id: z.string(),
  label: z.string(),
  provider: SimulationModelProviderSchema,
  model: z.string(),
  reasoningEffort: z.string().nullable().default(null),
  enabled: z.boolean().default(true),
  available: z.boolean().default(false),
  source: z.enum(["studio-harness", "provider-env", "local", "fallback"]).default("fallback"),
  requiresCredential: z.boolean().default(false),
  credentialEnv: z.string().nullable().default(null),
  baseUrl: z.string().nullable().default(null),
  command: z.string().nullable().default(null),
  notes: z.array(z.string()).default([]),
});

export interface SimulationProviderRun {
  id: string;
  profileId: string;
  provider: SimulationModelProvider;
  model: string;
  status: "completed" | "failed" | "skipped";
  executionMode: SimulationExecutionMode;
  startedAt: string;
  completedAt: string;
  latencyMs: number;
  usage: SimulationUsage;
  error: string | null;
}

export const SimulationProviderRunSchema: Schema<SimulationProviderRun> = z.object({
  id: z.string(),
  profileId: z.string(),
  provider: SimulationModelProviderSchema,
  model: z.string(),
  status: z.enum(["completed", "failed", "skipped"]).default("completed"),
  executionMode: SimulationExecutionModeSchema,
  startedAt: z.string(),
  completedAt: z.string(),
  latencyMs: z.number().int().min(0).default(0),
  usage: SimulationUsageSchema.default({}),
  error: z.string().nullable().default(null),
});

export interface SimulationScorecard {
  adoption: number;
  resistance: number;
  confidence: number;
  risk: number;
  evidenceCoverage: number;
  modelDiversity: number;
  recommendations: string[];
}

export const SimulationScorecardSchema: Schema<SimulationScorecard> = z.object({
  adoption: z.number().min(0).max(1).default(0),
  resistance: z.number().min(0).max(1).default(0),
  confidence: z.number().min(0).max(1).default(0),
  risk: z.number().min(0).max(1).default(0),
  evidenceCoverage: z.number().min(0).max(1).default(0),
  modelDiversity: z.number().min(0).max(1).default(0),
  recommendations: z.array(z.string()).default([]),
});

export interface SimulationTranscript {
  id: string;
  runId: string;
  scenarioId: string;
  roundId: string | null;
  agentId: string | null;
  modelProfileId: string;
  prompt: string;
  response: string;
  evidenceFindingIds: string[];
  startedAt: string;
  completedAt: string;
  usage: SimulationUsage;
  fallback: boolean;
}

export const SimulationTranscriptSchema: Schema<SimulationTranscript> = z.object({
  id: z.string(),
  runId: z.string(),
  scenarioId: z.string(),
  roundId: z.string().nullable().default(null),
  agentId: z.string().nullable().default(null),
  modelProfileId: z.string(),
  prompt: z.string(),
  response: z.string(),
  evidenceFindingIds: z.array(z.string()).default([]),
  startedAt: z.string(),
  completedAt: z.string(),
  usage: SimulationUsageSchema.default({}),
  fallback: z.boolean().default(false),
});

export interface SimulationRound {
  id: string;
  runId: string;
  scenarioId: string;
  index: number;
  phase: "briefing" | "debate" | "variable-injection" | "synthesis";
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt: string | null;
  agentIds: string[];
  eventIds: string[];
  transcriptIds: string[];
  scorecard: SimulationScorecard;
}

export const SimulationRoundSchema: Schema<SimulationRound> = z.object({
  id: z.string(),
  runId: z.string(),
  scenarioId: z.string(),
  index: z.number().int().min(1),
  phase: z.enum(["briefing", "debate", "variable-injection", "synthesis"]),
  status: z.enum(["running", "completed", "failed"]).default("completed"),
  startedAt: z.string(),
  completedAt: z.string().nullable().default(null),
  agentIds: z.array(z.string()).default([]),
  eventIds: z.array(z.string()).default([]),
  transcriptIds: z.array(z.string()).default([]),
  scorecard: SimulationScorecardSchema.default({}),
});

export interface SimulationVariable {
  id: string;
  name: string;
  value: string;
  description: string;
}

export const SimulationVariableSchema: Schema<SimulationVariable> = z.object({
  id: z.string(),
  name: z.string(),
  value: z.string(),
  description: z.string(),
});

export interface SimulationAgent {
  id: string;
  name: string;
  role: string;
  goals: string[];
  painPoints: string[];
  behaviors: string[];
  source: string;
  evidenceFindingIds: string[];
  influence: number;
}

export const SimulationAgentSchema: Schema<SimulationAgent> = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  goals: z.array(z.string()),
  painPoints: z.array(z.string()),
  behaviors: z.array(z.string()),
  source: z.string(),
  evidenceFindingIds: z.array(z.string()),
  influence: z.number().min(0).max(1),
});

export type SimulationGraphNodeKind = "agent" | "finding" | "theme" | "risk" | "opportunity" | "contradiction" | "metric" | "variable" | "outcome";

export interface SimulationGraphNode {
  id: string;
  label: string;
  kind: SimulationGraphNodeKind;
  summary: string;
  evidenceFindingIds: string[];
  weight: number;
}

export const SimulationGraphNodeSchema: Schema<SimulationGraphNode> = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["agent", "finding", "theme", "risk", "opportunity", "contradiction", "metric", "variable", "outcome"]),
  summary: z.string(),
  evidenceFindingIds: z.array(z.string()).default([]),
  weight: z.number().min(0).max(1).default(0.5),
});

export type SimulationGraphEdgeKind = "represents" | "evidence" | "influence" | "conflict" | "variable" | "outcome";

export interface SimulationGraphEdge {
  id: string;
  source: string;
  target: string;
  kind: SimulationGraphEdgeKind;
  label: string;
  strength: number;
}

export const SimulationGraphEdgeSchema: Schema<SimulationGraphEdge> = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  kind: z.enum(["represents", "evidence", "influence", "conflict", "variable", "outcome"]),
  label: z.string(),
  strength: z.number().min(0).max(1),
});

export interface SimulationGraph {
  nodes: SimulationGraphNode[];
  edges: SimulationGraphEdge[];
}

export const SimulationGraphSchema: Schema<SimulationGraph> = z.object({
  nodes: z.array(SimulationGraphNodeSchema),
  edges: z.array(SimulationGraphEdgeSchema),
});

export interface ProductSimulationScenario {
  id: string;
  adapter: SimulationAdapterKind;
  name: string;
  hypothesis: string;
  createdAt: string;
  sourceSummary: {
    findings: number;
    themes: number;
    personas: number;
    risks: number;
    opportunities: number;
    metrics: number;
    qualityScore: number | null;
  };
  variables: SimulationVariable[];
  agents: SimulationAgent[];
  graph: SimulationGraph;
  metadata: {
    source: "memoire-research";
    evidenceFindingIds: string[];
    licenseBoundary: "clean-room";
    modelProfiles: SimulationModelProfile[];
    budget: SimulationBudget;
  };
}

export const ProductSimulationScenarioSchema: Schema<ProductSimulationScenario> = z.object({
  id: z.string(),
  adapter: SimulationAdapterKindSchema,
  name: z.string(),
  hypothesis: z.string(),
  createdAt: z.string(),
  sourceSummary: z.object({
    findings: z.number(),
    themes: z.number(),
    personas: z.number(),
    risks: z.number(),
    opportunities: z.number(),
    metrics: z.number(),
    qualityScore: z.number().nullable(),
  }),
  variables: z.array(SimulationVariableSchema),
  agents: z.array(SimulationAgentSchema),
  graph: SimulationGraphSchema,
  metadata: z.object({
    source: z.literal("memoire-research"),
    evidenceFindingIds: z.array(z.string()),
    licenseBoundary: z.literal("clean-room"),
    modelProfiles: z.array(SimulationModelProfileSchema).default([]),
    budget: SimulationBudgetSchema.default({}),
  }),
});

export type SimulationEventKind =
  | "agent-reaction"
  | "variable-shift"
  | "risk-signal"
  | "opportunity-signal"
  | "outcome"
  | "interview"
  | "round-start"
  | "model-response"
  | "round-summary"
  | "scorecard"
  | "model-disagreement";

export type SimulationImpact = "positive" | "negative" | "mixed" | "neutral";

export interface SimulationEvent {
  id: string;
  runId: string;
  scenarioId: string;
  kind: SimulationEventKind;
  timestamp: string;
  title: string;
  summary: string;
  impact: SimulationImpact;
  agentId?: string;
  evidenceFindingIds: string[];
  data?: Record<string, unknown>;
}

export const SimulationEventSchema: Schema<SimulationEvent> = z.object({
  id: z.string(),
  runId: z.string(),
  scenarioId: z.string(),
  kind: z.enum([
    "agent-reaction",
    "variable-shift",
    "risk-signal",
    "opportunity-signal",
    "outcome",
    "interview",
    "round-start",
    "model-response",
    "round-summary",
    "scorecard",
    "model-disagreement",
  ]),
  timestamp: z.string(),
  title: z.string(),
  summary: z.string(),
  impact: z.enum(["positive", "negative", "mixed", "neutral"]),
  agentId: z.string().optional(),
  evidenceFindingIds: z.array(z.string()),
  data: z.record(z.unknown()).optional(),
});

export interface SimulationInterviewResult {
  id: string;
  runId: string;
  agentId: string;
  agentName: string;
  prompt: string;
  answer: string;
  evidenceFindingIds: string[];
  createdAt: string;
}

export const SimulationInterviewResultSchema: Schema<SimulationInterviewResult> = z.object({
  id: z.string(),
  runId: z.string(),
  agentId: z.string(),
  agentName: z.string(),
  prompt: z.string(),
  answer: z.string(),
  evidenceFindingIds: z.array(z.string()),
  createdAt: z.string(),
});

export interface SimulationRun {
  id: string;
  scenarioId: string;
  adapter: SimulationAdapterKind;
  status: "prepared" | "running" | "completed" | "stopped" | "failed";
  startedAt: string;
  completedAt: string | null;
  eventCount: number;
  events: SimulationEvent[];
  interviews: SimulationInterviewResult[];
  budget: SimulationBudget;
  modelProfiles: SimulationModelProfile[];
  providerRuns: SimulationProviderRun[];
  rounds: SimulationRound[];
  transcripts: SimulationTranscript[];
  scorecard: SimulationScorecard;
  costs: SimulationUsage;
  error: string | null;
}

export const SimulationRunSchema: Schema<SimulationRun> = z.object({
  id: z.string(),
  scenarioId: z.string(),
  adapter: SimulationAdapterKindSchema,
  status: z.enum(["prepared", "running", "completed", "stopped", "failed"]),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  eventCount: z.number(),
  events: z.array(SimulationEventSchema),
  interviews: z.array(SimulationInterviewResultSchema).default([]),
  budget: SimulationBudgetSchema.default({}),
  modelProfiles: z.array(SimulationModelProfileSchema).default([]),
  providerRuns: z.array(SimulationProviderRunSchema).default([]),
  rounds: z.array(SimulationRoundSchema).default([]),
  transcripts: z.array(SimulationTranscriptSchema).default([]),
  scorecard: SimulationScorecardSchema.default({}),
  costs: SimulationUsageSchema.default({}),
  error: z.string().nullable().default(null),
});

export interface SimulationReport {
  id: string;
  runId: string;
  scenarioId: string;
  scenarioName: string;
  hypothesis: string;
  generatedAt: string;
  summary: string;
  recommendations: string[];
  risks: string[];
  unresolvedAssumptions: string[];
  evidenceFindingIds: string[];
  events: SimulationEvent[];
  interviews: SimulationInterviewResult[];
  budget: SimulationBudget;
  modelProfiles: SimulationModelProfile[];
  providerRuns: SimulationProviderRun[];
  rounds: SimulationRound[];
  transcripts: SimulationTranscript[];
  scorecard: SimulationScorecard;
  costs: SimulationUsage;
  comparisons: string[];
}

export const SimulationReportSchema: Schema<SimulationReport> = z.object({
  id: z.string(),
  runId: z.string(),
  scenarioId: z.string(),
  scenarioName: z.string(),
  hypothesis: z.string(),
  generatedAt: z.string(),
  summary: z.string(),
  recommendations: z.array(z.string()),
  risks: z.array(z.string()),
  unresolvedAssumptions: z.array(z.string()),
  evidenceFindingIds: z.array(z.string()),
  events: z.array(SimulationEventSchema),
  interviews: z.array(SimulationInterviewResultSchema),
  budget: SimulationBudgetSchema.default({}),
  modelProfiles: z.array(SimulationModelProfileSchema).default([]),
  providerRuns: z.array(SimulationProviderRunSchema).default([]),
  rounds: z.array(SimulationRoundSchema).default([]),
  transcripts: z.array(SimulationTranscriptSchema).default([]),
  scorecard: SimulationScorecardSchema.default({}),
  costs: SimulationUsageSchema.default({}),
  comparisons: z.array(z.string()).default([]),
});

export interface SimulationComparison {
  id: string;
  generatedAt: string;
  runIds: string[];
  winnerRunId: string | null;
  summary: string;
  runs: Array<{
    runId: string;
    scenarioId: string;
    score: number;
    adoption: number;
    risk: number;
    confidence: number;
    estimatedCostUsd: number;
  }>;
}

export const SimulationComparisonSchema: Schema<SimulationComparison> = z.object({
  id: z.string(),
  generatedAt: z.string(),
  runIds: z.array(z.string()),
  winnerRunId: z.string().nullable(),
  summary: z.string(),
  runs: z.array(z.object({
    runId: z.string(),
    scenarioId: z.string(),
    score: z.number().min(0).max(1),
    adoption: z.number().min(0).max(1),
    risk: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
    estimatedCostUsd: z.number().min(0),
  })),
});

export interface SimulationPrepareResult {
  adapter: SimulationAdapterKind;
  scenario: ProductSimulationScenario;
  warnings: string[];
}

export interface SimulationInterviewRequest {
  agentId: string;
  prompt: string;
}

export interface SimulationAdapter {
  prepare(scenario: ProductSimulationScenario): Promise<SimulationPrepareResult>;
  start(scenarioId: string): Promise<SimulationRun>;
  stream(runId: string): AsyncIterable<SimulationEvent>;
  interview(runId: string, request: SimulationInterviewRequest): Promise<SimulationInterviewResult>;
  stop(runId: string): Promise<SimulationRun>;
  exportReport(runId: string): Promise<SimulationReport>;
}

export interface ProductSpecImpact {
  title: string;
  scenarioId: string;
  runId: string;
  researchBacking: string[];
  sections: Array<{
    title: string;
    body: string;
  }>;
}
