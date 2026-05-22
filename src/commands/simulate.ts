import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Command } from "commander";
import type { MemoireEngine } from "../engine/core.js";
import type { ResearchStore } from "../research/engine.js";
import {
  FileSimulationStore,
  ForkBridgeAdapter,
  LocalSimulationAdapter,
  ModelSwarmSimulationAdapter,
  SimulationModelRouter,
  buildProductSimulationScenarioFromResearch,
  compareSimulationRuns,
  exportProductSpecFromRun,
  simulationCosts,
  type SimulationAdapter,
  type SimulationAdapterKind,
  type SimulationBudget,
} from "../simulation/index.js";

interface SimulateJsonOptions {
  json?: boolean;
}

interface SimulateAdapterOptions {
  adapter?: SimulationAdapterKind;
  url?: string;
}

interface SimulateRunOptions extends SimulateAdapterOptions, SimulateJsonOptions {
  maxAgents?: string;
  rounds?: string;
  maxTokens?: string;
  maxCost?: string;
  liveModels?: boolean;
}

export function registerSimulateCommand(program: Command, engine: MemoireEngine): void {
  const simulate = program
    .command("simulate")
    .description("Run clean-room product scenario simulations from Memoire research");

  simulate
    .command("models")
    .description("List model profiles available to model-swarm simulations")
    .option("--json", "Output model profiles as JSON")
    .action(async (opts: SimulateJsonOptions) => {
      const profiles = new SimulationModelRouter().listProfiles();
      emit(opts, {
        action: "models",
        status: "completed",
        profiles,
      }, profiles.map((profile) => `${profile.id}: ${profile.available ? "available" : "fallback"} (${profile.provider})`).join("\n"));
    });

  simulate
    .command("generate-agents")
    .description("Generate a model-swarm agent cohort from research without running it")
    .option("--adapter <adapter>", "Simulation adapter: local, model-swarm, or mirofish", "model-swarm")
    .option("--count <count>", "Target agent count for model-swarm runs", "24")
    .option("--json", "Output generated agents as JSON")
    .action(async (opts: { count?: string } & SimulateAdapterOptions & SimulateJsonOptions) => {
      const adapterKind = normalizeAdapter(opts.adapter);
      const research = await loadResearchStore(engine);
      const scenario = buildProductSimulationScenarioFromResearch(research, {
        adapter: adapterKind,
        agentCount: numberOption(opts.count, 24),
      });
      emit(opts, {
        action: "generate-agents",
        status: "completed",
        adapter: adapterKind,
        agents: scenario.agents,
        graph: scenario.graph,
        budget: scenario.metadata.budget,
      }, scenario.agents.map((agent) => `${agent.name} (${agent.role})`).join("\n"));
    });

  simulate
    .command("plan")
    .description("Create a product simulation scenario from research/store.v2.json")
    .option("--name <name>", "Scenario name")
    .option("--hypothesis <hypothesis>", "Scenario hypothesis")
    .option("--adapter <adapter>", "Simulation adapter: local, model-swarm, or mirofish", "local")
    .option("--url <url>", "Simulation fork bridge URL")
    .option("--count <count>", "Target agent count for model-swarm scenarios")
    .option("--rounds <rounds>", "Model-swarm round budget")
    .option("--max-agents <maxAgents>", "Model-swarm max agent budget")
    .option("--max-tokens <maxTokens>", "Model-swarm token budget")
    .option("--max-cost <maxCost>", "Model-swarm estimated cost budget in USD")
    .option("--live-models", "Allow live model calls; default is deterministic fallback")
    .option("--json", "Output scenario plan as JSON")
    .action(async (opts: { name?: string; hypothesis?: string; count?: string } & SimulateRunOptions) => {
      const adapterKind = normalizeAdapter(opts.adapter);
      const store = new FileSimulationStore(engine.config.projectRoot);
      const adapter = createAdapter(engine.config.projectRoot, adapterKind, opts.url, budgetFromOptions(opts));
      const research = await loadResearchStore(engine);
      const scenario = buildProductSimulationScenarioFromResearch(research, {
        name: opts.name,
        hypothesis: opts.hypothesis,
        adapter: adapterKind,
        agentCount: numberOption(opts.count ?? opts.maxAgents, adapterKind === "model-swarm" ? 24 : undefined),
        budget: budgetFromOptions(opts),
      });
      const prepared = await adapter.prepare(scenario);
      await store.saveScenario(prepared.scenario);
      emit(opts, {
        action: "plan",
        status: "completed",
        adapter: adapterKind,
        scenario: prepared.scenario,
        warnings: prepared.warnings,
        artifacts: simulationArtifacts(engine.config.projectRoot, prepared.scenario.id),
      }, `Created simulation scenario ${prepared.scenario.id}`);
    });

  simulate
    .command("run <scenarioId>")
    .description("Run a prepared simulation scenario")
    .option("--adapter <adapter>", "Simulation adapter: local, model-swarm, or mirofish")
    .option("--url <url>", "Simulation fork bridge URL")
    .option("--max-agents <maxAgents>", "Model-swarm max agent budget")
    .option("--rounds <rounds>", "Model-swarm round budget")
    .option("--max-tokens <maxTokens>", "Model-swarm token budget")
    .option("--max-cost <maxCost>", "Model-swarm estimated cost budget in USD")
    .option("--live-models", "Allow live model calls; default is deterministic fallback")
    .option("--json", "Output run result as JSON")
    .action(async (scenarioId: string, opts: SimulateRunOptions) => {
      const store = new FileSimulationStore(engine.config.projectRoot);
      const scenario = await store.loadScenario(scenarioId);
      const adapterKind = normalizeAdapter(opts.adapter ?? scenario?.adapter ?? "local");
      const adapter = createAdapter(engine.config.projectRoot, adapterKind, opts.url, budgetFromOptions(opts));
      const run = await adapter.start(scenarioId);
      emit(opts, {
        action: "run",
        status: "completed",
        run,
        artifacts: simulationArtifacts(engine.config.projectRoot, run.scenarioId, run.id),
      }, `Completed simulation run ${run.id}`);
    });

  simulate
    .command("status <runId>")
    .description("Read a local simulation run status")
    .option("--json", "Output run status as JSON")
    .action(async (runId: string, opts: SimulateJsonOptions) => {
      const store = new FileSimulationStore(engine.config.projectRoot);
      const run = await store.loadRun(runId);
      if (!run) throw new Error(`Unknown simulation run: ${runId}`);
      emit(opts, {
        action: "status",
        status: "completed",
        run,
        artifacts: simulationArtifacts(engine.config.projectRoot, run.scenarioId, run.id),
      }, `${run.id}: ${run.status} (${run.eventCount} events)`);
    });

  simulate
    .command("interview <runId>")
    .description("Interview a simulation agent")
    .requiredOption("--agent <agentId>", "Simulation agent id")
    .requiredOption("--prompt <prompt>", "Interview question")
    .option("--adapter <adapter>", "Simulation adapter: local, model-swarm, or mirofish")
    .option("--url <url>", "Simulation fork bridge URL")
    .option("--json", "Output interview result as JSON")
    .action(async (runId: string, opts: { agent: string; prompt: string } & SimulateAdapterOptions & SimulateJsonOptions) => {
      const adapter = await adapterForRun(engine.config.projectRoot, runId, opts);
      const interview = await adapter.interview(runId, { agentId: opts.agent, prompt: opts.prompt });
      emit(opts, {
        action: "interview",
        status: "completed",
        interview,
      }, interview.answer);
    });

  simulate
    .command("report <runId>")
    .description("Export a simulation report")
    .option("--adapter <adapter>", "Simulation adapter: local, model-swarm, or mirofish")
    .option("--url <url>", "Simulation fork bridge URL")
    .option("--json", "Output report as JSON")
    .action(async (runId: string, opts: SimulateAdapterOptions & SimulateJsonOptions) => {
      const adapter = await adapterForRun(engine.config.projectRoot, runId, opts);
      const report = await adapter.exportReport(runId);
      emit(opts, {
        action: "report",
        status: "completed",
        report,
      }, report.summary);
    });

  simulate
    .command("export-spec <runId>")
    .description("Convert a simulation report into a product-spec impact artifact")
    .option("--adapter <adapter>", "Simulation adapter: local, model-swarm, or mirofish")
    .option("--url <url>", "Simulation fork bridge URL")
    .option("--json", "Output spec impact artifact as JSON")
    .action(async (runId: string, opts: SimulateAdapterOptions & SimulateJsonOptions) => {
      const adapter = await adapterForRun(engine.config.projectRoot, runId, opts);
      const report = await adapter.exportReport(runId);
      const spec = exportProductSpecFromRun(report);
      emit(opts, {
        action: "export-spec",
        status: "completed",
        spec,
      }, `${spec.title}\n${spec.sections.map((section) => `\n## ${section.title}\n${section.body}`).join("\n")}`);
    });

  simulate
    .command("stream <runId>")
    .description("Export persisted simulation events in stream order")
    .option("--adapter <adapter>", "Simulation adapter: local, model-swarm, or mirofish")
    .option("--url <url>", "Simulation fork bridge URL")
    .option("--json", "Output events as JSON")
    .action(async (runId: string, opts: SimulateAdapterOptions & SimulateJsonOptions) => {
      const adapter = await adapterForRun(engine.config.projectRoot, runId, opts);
      const events = [];
      for await (const event of adapter.stream(runId)) events.push(event);
      emit(opts, {
        action: "stream",
        status: "completed",
        events,
      }, events.map((event) => `${event.kind}: ${event.title}`).join("\n"));
    });

  simulate
    .command("transcript <runId>")
    .description("Export model-swarm transcript memory for a run")
    .option("--json", "Output transcripts as JSON")
    .action(async (runId: string, opts: SimulateJsonOptions) => {
      const store = new FileSimulationStore(engine.config.projectRoot);
      const run = await requireRun(store, runId);
      emit(opts, {
        action: "transcript",
        status: "completed",
        runId,
        transcripts: run.transcripts,
      }, run.transcripts.map((transcript) => `${transcript.modelProfileId}: ${transcript.response}`).join("\n"));
    });

  simulate
    .command("costs <runId>")
    .description("Summarize model-swarm token and cost usage")
    .option("--json", "Output costs as JSON")
    .action(async (runId: string, opts: SimulateJsonOptions) => {
      const store = new FileSimulationStore(engine.config.projectRoot);
      const run = await requireRun(store, runId);
      emit(opts, {
        action: "costs",
        status: "completed",
        runId,
        costs: simulationCosts(run),
      }, JSON.stringify(simulationCosts(run), null, 2));
    });

  simulate
    .command("compare <runIds...>")
    .description("Compare completed simulation runs")
    .option("--json", "Output comparison as JSON")
    .action(async (runIds: string[], opts: SimulateJsonOptions) => {
      const store = new FileSimulationStore(engine.config.projectRoot);
      const runs = await Promise.all(runIds.map((runId) => requireRun(store, runId)));
      const comparison = compareSimulationRuns(runs);
      emit(opts, {
        action: "compare",
        status: "completed",
        ...comparison,
      }, comparison.summary);
    });

  simulate
    .command("run-matrix")
    .description("Plan and run multiple model-swarm hypotheses for comparison")
    .option("--adapter <adapter>", "Simulation adapter: local, model-swarm, or mirofish", "model-swarm")
    .option("--url <url>", "Simulation fork bridge URL")
    .option("--name <name>", "Scenario name prefix", "Simulation matrix")
    .option("--hypothesis <hypothesis>", "Hypothesis to run; repeat for multiple hypotheses", collect, [])
    .option("--max-agents <maxAgents>", "Model-swarm max agent budget")
    .option("--rounds <rounds>", "Model-swarm round budget")
    .option("--max-tokens <maxTokens>", "Model-swarm token budget")
    .option("--max-cost <maxCost>", "Model-swarm estimated cost budget in USD")
    .option("--live-models", "Allow live model calls; default is deterministic fallback")
    .option("--json", "Output matrix run as JSON")
    .action(async (opts: { name?: string; hypothesis?: string[] } & SimulateRunOptions) => {
      const adapterKind = normalizeAdapter(opts.adapter);
      const research = await loadResearchStore(engine);
      const adapter = createAdapter(engine.config.projectRoot, adapterKind, opts.url, budgetFromOptions(opts));
      const hypotheses = opts.hypothesis?.length ? opts.hypothesis : ["Research-backed simulation will improve the product specification."];
      const runs = [];
      for (let index = 0; index < hypotheses.length; index += 1) {
        const hypothesis = hypotheses[index];
        const scenario = buildProductSimulationScenarioFromResearch(research, {
          name: `${opts.name ?? "Simulation matrix"} ${index + 1}`,
          hypothesis,
          adapter: adapterKind,
          agentCount: numberOption(opts.maxAgents, adapterKind === "model-swarm" ? 24 : undefined),
          budget: budgetFromOptions(opts),
        });
        const prepared = await adapter.prepare(scenario);
        const run = await adapter.start(prepared.scenario.id);
        runs.push({ hypothesis, scenario: prepared.scenario, run });
      }
      const comparison = compareSimulationRuns(runs.map((entry) => entry.run));
      emit(opts, {
        action: "run-matrix",
        status: "completed",
        runs,
        comparison,
      }, comparison.summary);
    });
}

function createAdapter(projectRoot: string, adapter: SimulationAdapterKind, url?: string, budget?: Partial<SimulationBudget>): SimulationAdapter {
  if (adapter === "mirofish") {
    if (!url) throw new Error("mirofish compatibility adapter requires --url <server>");
    return new ForkBridgeAdapter({ baseUrl: url });
  }
  if (adapter === "model-swarm") {
    return new ModelSwarmSimulationAdapter({ store: new FileSimulationStore(projectRoot), defaultBudget: budget });
  }
  return new LocalSimulationAdapter({ store: new FileSimulationStore(projectRoot) });
}

async function adapterForRun(projectRoot: string, runId: string, opts: SimulateAdapterOptions): Promise<SimulationAdapter> {
  const store = new FileSimulationStore(projectRoot);
  const run = await store.loadRun(runId);
  return createAdapter(projectRoot, normalizeAdapter(opts.adapter ?? run?.adapter ?? "local"), opts.url);
}

async function loadResearchStore(engine: MemoireEngine): Promise<ResearchStore> {
  if (engine.research) {
    await engine.init();
    await engine.research.load();
    return engine.research.getStore();
  }
  const raw = await readFile(join(engine.config.projectRoot, "research", "store.v2.json"), "utf-8");
  return JSON.parse(raw) as ResearchStore;
}

function normalizeAdapter(adapter: unknown): SimulationAdapterKind {
  if (adapter === "model-swarm") return "model-swarm";
  return adapter === "mirofish" ? "mirofish" : "local";
}

function budgetFromOptions(opts: Partial<SimulateRunOptions>): Partial<SimulationBudget> | undefined {
  const budget: Partial<SimulationBudget> = {};
  if (opts.maxAgents !== undefined) budget.maxAgents = numberOption(opts.maxAgents, 24);
  if (opts.rounds !== undefined) budget.maxRounds = numberOption(opts.rounds, 3);
  if (opts.maxTokens !== undefined) budget.maxTokens = numberOption(opts.maxTokens, 48_000);
  if (opts.maxCost !== undefined) budget.maxEstimatedCostUsd = numberOption(opts.maxCost, 0);
  if (opts.liveModels !== undefined) budget.allowLiveModels = Boolean(opts.liveModels);
  return Object.keys(budget).length ? budget : undefined;
}

function numberOption(value: string | undefined, fallback: number): number;
function numberOption(value: string | undefined, fallback: number | undefined): number | undefined;
function numberOption(value: string | undefined, fallback: number | undefined): number | undefined {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function requireRun(store: FileSimulationStore, runId: string) {
  const run = await store.loadRun(runId);
  if (!run) throw new Error(`Unknown simulation run: ${runId}`);
  return run;
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function emit(opts: SimulateJsonOptions, payload: unknown, text: string): void {
  if (opts.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(text);
}

function simulationArtifacts(projectRoot: string, scenarioId: string, runId?: string) {
  return {
    simulationsDir: join(projectRoot, ".memoire", "simulations"),
    scenarioPath: join(projectRoot, ".memoire", "simulations", "scenarios", `${scenarioId}.json`),
    runPath: runId ? join(projectRoot, ".memoire", "simulations", "runs", `${runId}.json`) : null,
  };
}
