import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import {
  SimulationBudgetSchema,
  SimulationModelProfileSchema,
  SimulationProviderRunSchema,
  SimulationTranscriptSchema,
  type SimulationBudget,
  type SimulationModelProfile,
  type SimulationProviderRun,
  type SimulationTranscript,
  type SimulationUsage,
} from "./types.js";
import { stableId } from "./research-scenario.js";

export interface SimulationModelRouterOptions {
  env?: NodeJS.ProcessEnv;
  now?: () => string;
  resolveCommand?: (command: string) => string | null;
  fetchImpl?: typeof fetch;
}

export interface SimulationModelExecutionRequest {
  prompt: string;
  system: string;
  budget: SimulationBudget;
  runId?: string;
  scenarioId?: string;
  roundId?: string;
  agentId?: string;
  evidenceFindingIds?: string[];
  cwd?: string;
}

export interface SimulationModelExecutionResult {
  transcript: SimulationTranscript;
  providerRun: SimulationProviderRun;
}

export class SimulationModelRouter {
  private readonly env: NodeJS.ProcessEnv;
  private readonly now: () => string;
  private readonly resolveCommand: (command: string) => string | null;
  private readonly fetchImpl: typeof fetch;

  constructor(options: SimulationModelRouterOptions = {}) {
    this.env = options.env ?? process.env;
    this.now = options.now ?? (() => new Date().toISOString());
    this.resolveCommand = options.resolveCommand ?? resolveCommandFromPath;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  listProfiles(): SimulationModelProfile[] {
    const openAiCompatibleKey = this.env.OPENAI_API_KEY ?? this.env.LLM_API_KEY;
    const openAiCompatibleBase = this.env.OPENAI_BASE_URL ?? this.env.LLM_BASE_URL ?? null;
    const openAiCompatibleModel = this.env.OPENAI_MODEL ?? this.env.LLM_MODEL_NAME ?? "gpt-5.5";
    const anthropicKey = this.env.ANTHROPIC_API_KEY;
    const profiles = [
      {
        id: "codex-gpt-5-5",
        label: "Codex GPT-5.5",
        provider: "codex",
        model: this.env.CODEX_MODEL ?? "gpt-5.5",
        reasoningEffort: this.env.CODEX_REASONING_EFFORT ?? "xhigh",
        source: "studio-harness",
        command: this.resolveCommand("codex"),
        requiresCredential: true,
        credentialEnv: "Codex login",
      },
      {
        id: "claude-code-sonnet",
        label: "Claude Code Sonnet",
        provider: "claude-code",
        model: this.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514",
        reasoningEffort: null,
        source: "studio-harness",
        command: this.resolveCommand("claude"),
        requiresCredential: true,
        credentialEnv: "Claude Code auth",
      },
      {
        id: "ollama-local",
        label: "Ollama local",
        provider: "ollama",
        model: this.env.OLLAMA_MODEL ?? "llama3.1:8b",
        reasoningEffort: null,
        source: "local",
        command: this.resolveCommand("ollama"),
        requiresCredential: false,
        credentialEnv: null,
      },
      {
        id: "openai-compatible",
        label: "OpenAI-compatible",
        provider: "openai-compatible",
        model: openAiCompatibleModel,
        reasoningEffort: null,
        source: "provider-env",
        command: null,
        requiresCredential: true,
        credentialEnv: openAiCompatibleKey ? "OPENAI_API_KEY" : "LLM_API_KEY",
        baseUrl: openAiCompatibleBase,
      },
      {
        id: "anthropic-compatible",
        label: "Anthropic-compatible",
        provider: "anthropic-compatible",
        model: this.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
        reasoningEffort: null,
        source: "provider-env",
        command: null,
        requiresCredential: true,
        credentialEnv: "ANTHROPIC_API_KEY",
        baseUrl: "https://api.anthropic.com",
      },
      {
        id: "deterministic-product-simulator",
        label: "Deterministic product simulator",
        provider: "deterministic",
        model: "memoire-clean-room-v2",
        reasoningEffort: null,
        source: "fallback",
        command: null,
        requiresCredential: false,
        credentialEnv: null,
        notes: ["Always available", "No token spend"],
      },
    ] as const;

    return profiles.map((profile) => SimulationModelProfileSchema.parse({
      ...profile,
      available: profile.provider === "deterministic"
        || (profile.provider === "openai-compatible" && Boolean(openAiCompatibleKey && openAiCompatibleBase))
        || (profile.provider === "anthropic-compatible" && Boolean(anthropicKey))
        || Boolean(profile.command),
      baseUrl: "baseUrl" in profile ? profile.baseUrl : null,
      enabled: true,
      notes: "notes" in profile ? profile.notes : [],
    }));
  }

  async execute(profile: SimulationModelProfile, request: SimulationModelExecutionRequest): Promise<SimulationModelExecutionResult> {
    const budget = SimulationBudgetSchema.parse(request.budget);
    const startedAt = this.now();
    const liveAllowed = budget.allowLiveModels && profile.available && profile.provider !== "deterministic";
    const live = liveAllowed ? await this.tryLiveExecution(profile, request) : null;
    const completedAt = this.now();
    const response = live?.response ?? deterministicResponse(profile, request.prompt);
    const usage = live?.usage ?? estimateUsage(request.prompt, response, 0);
    const executionMode = live?.response ? "live" : "deterministic-fallback";
    const providerRun = SimulationProviderRunSchema.parse({
      id: stableId("provider-run", `${profile.id}:${request.runId ?? "run"}:${request.roundId ?? "round"}:${request.agentId ?? "agent"}:${startedAt}`),
      profileId: profile.id,
      provider: profile.provider,
      model: profile.model,
      status: "completed",
      executionMode,
      startedAt,
      completedAt,
      latencyMs: elapsedMs(startedAt, completedAt),
      usage,
      error: live?.error ?? null,
    });
    const transcript = SimulationTranscriptSchema.parse({
      id: stableId("transcript", `${providerRun.id}:${request.prompt}`),
      runId: request.runId ?? "run-router",
      scenarioId: request.scenarioId ?? "scenario-router",
      roundId: request.roundId ?? null,
      agentId: request.agentId ?? null,
      modelProfileId: profile.id,
      prompt: request.prompt,
      response,
      evidenceFindingIds: request.evidenceFindingIds ?? [],
      startedAt,
      completedAt,
      usage,
      fallback: executionMode === "deterministic-fallback",
    });
    return { providerRun, transcript };
  }

  private async tryLiveExecution(
    profile: SimulationModelProfile,
    request: SimulationModelExecutionRequest,
  ): Promise<{ response?: string; usage?: SimulationUsage; error?: string } | null> {
    try {
      if (profile.provider === "openai-compatible" && profile.baseUrl) {
        return await this.runOpenAICompatible(profile, request);
      }
      if (profile.provider === "codex" && profile.command) {
        return runCli(profile.command, [
          "exec",
          "--json",
          "--model",
          profile.model,
          "-c",
          `model_reasoning_effort="${profile.reasoningEffort ?? "xhigh"}"`,
          "--sandbox",
          "read-only",
          request.prompt,
        ], request);
      }
      if (profile.provider === "claude-code" && profile.command) {
        return runCli(profile.command, ["-p", "--output-format", "text", request.prompt], request);
      }
      if (profile.provider === "ollama" && profile.command) {
        return runCli(profile.command, ["run", profile.model, request.prompt], request);
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
    return null;
  }

  private async runOpenAICompatible(
    profile: SimulationModelProfile,
    request: SimulationModelExecutionRequest,
  ): Promise<{ response?: string; usage?: SimulationUsage; error?: string }> {
    const key = this.env.OPENAI_API_KEY ?? this.env.LLM_API_KEY;
    if (!key || !profile.baseUrl) return { error: "OpenAI-compatible key or base URL missing" };
    const response = await this.fetchImpl(`${profile.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: profile.model,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.prompt },
        ],
        temperature: 0.2,
      }),
    });
    if (!response.ok) return { error: `OpenAI-compatible request failed (${response.status})` };
    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return { error: "OpenAI-compatible response had no message content" };
    return {
      response: content,
      usage: {
        inputTokens: payload.usage?.prompt_tokens ?? estimateTokens(request.prompt),
        outputTokens: payload.usage?.completion_tokens ?? estimateTokens(content),
        estimatedCostUsd: 0,
      },
    };
  }
}

function runCli(command: string, args: string[], request: SimulationModelExecutionRequest): { response?: string; usage?: SimulationUsage; error?: string } {
  const result = spawnSync(command, args, {
    cwd: request.cwd,
    encoding: "utf-8",
    timeout: Math.min(request.budget.maxWallTimeMs, 120_000),
    shell: false,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      USER: process.env.USER,
      LOGNAME: process.env.LOGNAME,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    },
    maxBuffer: 4_000_000,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  if (result.status !== 0) return { error: output || `Command exited with ${result.status}` };
  return {
    response: extractCliResponse(output),
    usage: estimateUsage(request.prompt, output, 0),
  };
}

function deterministicResponse(profile: SimulationModelProfile, prompt: string): string {
  const firstLine = prompt.split(/\n+/).find(Boolean)?.slice(0, 180) ?? "the scenario";
  return `${profile.label} deterministic fallback: pressure-tested ${firstLine}. Adoption rises when requirements keep evidence citations, resistance rises when the spec hides assumptions, and the next step is to convert disagreements into measurable acceptance criteria.`;
}

function extractCliResponse(output: string): string {
  const lines = output.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    try {
      const parsed = JSON.parse(line) as { content?: string; message?: { content?: string }; text?: string; type?: string };
      const content = parsed.content ?? parsed.message?.content ?? parsed.text;
      if (typeof content === "string" && content.trim()) return content;
    } catch {
      // Text output is acceptable for non-JSON harnesses.
    }
  }
  return output;
}

function estimateUsage(prompt: string, response: string, estimatedCostUsd: number): SimulationUsage {
  return {
    inputTokens: estimateTokens(prompt),
    outputTokens: estimateTokens(response),
    estimatedCostUsd,
  };
}

function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.split(/\s+/).filter(Boolean).length * 1.35));
}

function elapsedMs(startedAt: string, completedAt: string): number {
  return Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime());
}

function resolveCommandFromPath(command: string): string | null {
  if (command.includes("/")) return existsSync(command) ? command : null;
  const entries = [
    ...(process.env.PATH ?? "").split(delimiter).filter(Boolean),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
  ];
  for (const entry of Array.from(new Set(entries))) {
    const candidate = join(entry, command);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
