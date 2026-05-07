import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import type { StudioBrowserAdapter } from "./browser-adapter.js";
import { getHarnessManifest } from "./harnesses.js";
import { captureKnowledgeEvent, getKnowledgeItem, listKnowledgeStore } from "./knowledge-store.js";
import {
  addMermaidBoardNode,
  connectMermaidBoardNodes,
  createMermaidBoard,
  exportMermaidBoardForJam,
  layoutMermaidBoard,
  updateMermaidBoardNode,
} from "./mermaid-board.js";
import { Registry } from "../engine/registry.js";
import { resolveMermaidJamIntegration } from "../integrations/mermaid-jam.js";
import {
  buildResearchDesignPackage,
  saveResearchDesignSpecs,
  writeMermaidJamArtifacts,
} from "../research/design-package.js";
import {
  buildProductSimulationScenarioFromResearch,
  compareSimulationRuns,
  exportProductSpecFromRun,
  FileSimulationStore,
  LocalSimulationAdapter,
  ModelSwarmSimulationAdapter,
  SimulationModelRouter,
  simulationCosts,
  type SimulationAdapter,
  type SimulationAdapterKind,
  type SimulationBudget,
  type SimulationReport,
} from "../simulation/index.js";
import type { ResearchStore } from "../research/engine.js";
import type {
  StudioBrowserActionRequest,
  StudioConfig,
  StudioEvent,
  StudioFigmaActionRequest,
  StudioFigmaActionResult,
  StudioToolCallRequest,
  StudioToolCallResult,
  StudioToolDefinition,
} from "./types.js";

export interface StudioToolBrokerOptions {
  projectRoot: string;
  getConfig: () => Promise<StudioConfig>;
  browser: StudioBrowserAdapter;
  runFigmaAction?: (request: StudioFigmaActionRequest) => Promise<StudioFigmaActionResult>;
}

export class StudioToolBroker {
  private readonly projectRoot: string;
  private readonly getConfig: () => Promise<StudioConfig>;
  private readonly browser: StudioBrowserAdapter;
  private readonly runFigmaAction?: (request: StudioFigmaActionRequest) => Promise<StudioFigmaActionResult>;
  private readonly simulation: LocalSimulationAdapter;

  constructor(options: StudioToolBrokerOptions) {
    this.projectRoot = resolve(options.projectRoot);
    this.getConfig = options.getConfig;
    this.browser = options.browser;
    this.runFigmaAction = options.runFigmaAction;
    this.simulation = new LocalSimulationAdapter({ store: new FileSimulationStore(this.projectRoot) });
  }

  listTools(): StudioToolDefinition[] {
    return [
      tool("workspace.read", "Read", "workspace", "Read a workspace file or directory.", false),
      tool("workspace.search", "Search", "workspace", "Search markdown, YAML, JSON, and code files inside workspace roots.", false),
      tool("workspace.write", "Write", "workspace", "Write a file inside an allowed workspace root.", true),
      tool("shell.run", "Shell", "shell", "Run an approved shell command inside the workspace.", true),
      tool("git.status", "Git status", "git", "Read git status for the workspace.", false),
      tool("git.diff", "Git diff", "git", "Read git diff for the workspace.", false),
      tool("git.checkpoint", "Checkpoint", "git", "Capture a pre-run git status and diff summary.", false),
      tool("browser.open", "Open browser", "browser", "Open a local Playwright browser session.", false),
      tool("browser.snapshot", "Snapshot", "browser", "Capture page URL, title, and HTML.", false),
      tool("browser.screenshot", "Screenshot", "browser", "Capture a browser screenshot artifact.", false),
      tool("browser.click", "Click", "browser", "Click a selector in an active browser session.", false),
      tool("browser.type", "Type", "browser", "Fill a selector in an active browser session.", false),
      tool("figma.action", "Figma", "figma", "Run an allowlisted Figma bridge action.", false),
      tool("mcp.list", "MCP list", "mcp", "List Mémoire MCP tools available to external agents.", false),
      tool("mcp.call", "MCP call", "mcp", "Reserved external MCP call adapter.", true),
      tool("knowledge.search", "Knowledge search", "knowledge", "Search indexed markdown, YAML, specs, references, and captures.", false),
      tool("knowledge.read", "Knowledge read", "knowledge", "Read an indexed knowledge item.", false),
      tool("knowledge.capture", "Knowledge capture", "knowledge", "Persist a research note, design decision, or artifact capture.", false),
      tool("research.design_package", "Research design", "research", "Preview research-backed vibe design specs and Mermaid Jam source.", false),
      tool("research.generate_specs", "Research specs", "research", "Write research-backed Atomic Design specs through the Memoire registry.", true),
      tool("mermaid_jam.export", "FigJam export", "research", "Write Mermaid Jam source artifacts for FigJam from research or simulation output.", false),
      tool("simulation.models", "Simulation models", "simulation", "List Codex-first model profiles available to Scenario Lab.", false),
      tool("simulation.generate_agents", "Simulation agents", "simulation", "Generate a 20-60 agent model-swarm cohort from research evidence.", false),
      tool("simulation.plan", "Simulation plan", "simulation", "Plan a local or model-swarm product simulation from research evidence.", false),
      tool("simulation.run", "Simulation run", "simulation", "Run a local or model-swarm product-team simulation.", false),
      tool("simulation.run_matrix", "Simulation matrix", "simulation", "Run multiple hypotheses and compare model-swarm outcomes.", false),
      tool("simulation.stream", "Simulation stream", "simulation", "Read persisted simulation events in stream order.", false),
      tool("simulation.status", "Simulation status", "simulation", "Read a local simulation run status.", false),
      tool("simulation.transcript", "Simulation transcript", "simulation", "Read model-swarm transcript memory for a run.", false),
      tool("simulation.compare", "Simulation compare", "simulation", "Compare completed simulation runs.", false),
      tool("simulation.costs", "Simulation costs", "simulation", "Summarize token and cost usage for a simulation run.", false),
      tool("simulation.interview", "Simulation interview", "simulation", "Interview a simulated stakeholder agent from a run.", false),
      tool("simulation.report", "Simulation report", "simulation", "Export a simulation report with recommendations and evidence.", false),
      tool("simulation.export_spec", "Simulation spec", "simulation", "Export a product spec impact report from a simulation run.", false),
      tool("board.create", "Board create", "board", "Create or load a Studio Mermaid Board sandbox.", false),
      tool("board.add_node", "Board node", "board", "Add a Mermaid Board node with evidence or Mermaid source.", false),
      tool("board.update_node", "Board update", "board", "Update a Mermaid Board node.", false),
      tool("board.connect", "Board connect", "board", "Connect two Mermaid Board nodes.", false),
      tool("board.layout", "Board layout", "board", "Apply a deterministic layout to Mermaid Board nodes.", false),
      tool("board.export_mermaid_jam", "Board export", "board", "Write Mermaid Board source artifacts for Mermaid Jam.", false),
    ];
  }

  async call(request: StudioToolCallRequest): Promise<StudioToolCallResult> {
    const startedAt = new Date().toISOString();
    const input = request.input ?? {};
    try {
      if (!this.listTools().some((candidate) => candidate.id === request.toolId)) {
        throw Object.assign(new Error(`Unknown Studio tool: ${request.toolId}`), { statusCode: 404 });
      }
      const data = await this.dispatch(request, input);
      return {
        id: request.id ?? `tool-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
        toolId: request.toolId,
        status: "completed",
        startedAt,
        completedAt: new Date().toISOString(),
        input,
        data,
        artifactPath: artifactPathFrom(data),
      };
    } catch (error) {
      const approval = approvalFrom(error);
      return {
        id: request.id ?? `tool-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
        toolId: request.toolId,
        status: approval ? "approval_required" : "failed",
        startedAt,
        completedAt: new Date().toISOString(),
        input,
        error: error instanceof Error ? error.message : String(error),
        approval: approval ? { required: true, reason: approval } : undefined,
      };
    }
  }

  private async dispatch(request: StudioToolCallRequest, input: Record<string, unknown>): Promise<unknown> {
    const config = await this.getConfig();
    const cwd = this.resolveWorkspacePath(request.cwd ?? this.projectRoot, config);
    if (request.toolId.startsWith("browser.") && !config.enabledTools.browser) throw new Error("Browser tools are disabled in Studio config");
    if (request.toolId.startsWith("figma.") && !config.enabledTools.figma) throw new Error("Figma tools are disabled in Studio config");
    if (request.toolId.startsWith("mcp.") && !config.enabledTools.mcp) throw new Error("MCP tools are disabled in Studio config");

    switch (request.toolId) {
      case "workspace.read":
        return this.readWorkspace(input, config);
      case "workspace.search":
        return this.searchWorkspace(input, config);
      case "workspace.write":
        if (!request.approved) throw Object.assign(new Error("Approval required to write workspace files"), { approvalReason: "Approve workspace file write" });
        return this.writeWorkspace(input, config);
      case "shell.run":
        return this.runShell(input, config, cwd, Boolean(request.approved));
      case "git.status":
        return runCommand("git", ["status", "--short"], cwd);
      case "git.diff":
        return runCommand("git", ["diff", "--", "."], cwd);
      case "git.checkpoint":
        return {
          checkpointId: `checkpoint-${Date.now().toString(36)}`,
          status: runCommand("git", ["status", "--short"], cwd),
          diff: runCommand("git", ["diff", "--stat", "--", "."], cwd),
        };
      case "browser.open":
        return this.browser.createSession({ url: stringInput(input.url, "url") });
      case "browser.snapshot":
      case "browser.screenshot":
      case "browser.click":
      case "browser.type":
        return this.browser.runAction(browserRequestFromTool(request.toolId, input));
      case "figma.action":
        if (!this.runFigmaAction) throw new Error("Figma bridge is not configured for Studio tools");
        return this.runFigmaAction(input as unknown as StudioFigmaActionRequest);
      case "mcp.list":
        return { tools: MEMOIRE_MCP_TOOL_NAMES };
      case "mcp.call":
        if (!request.approved) throw Object.assign(new Error("Approval required for external MCP calls"), { approvalReason: "Approve external MCP tool call" });
        return { status: "not_configured", message: "External MCP client calls are not configured in this runtime yet." };
      case "knowledge.search":
        return this.searchKnowledge(input);
      case "knowledge.read":
        return this.readKnowledge(input);
      case "knowledge.capture":
        return this.captureKnowledge(input, request);
      case "research.design_package":
        return this.researchDesignPackage(input);
      case "research.generate_specs":
        if (!request.approved) throw Object.assign(new Error("Approval required to write generated research specs"), { approvalReason: "Approve research spec generation" });
        return this.generateResearchSpecs(input);
      case "mermaid_jam.export":
        return this.exportMermaidJam(input);
      case "simulation.models":
        return this.listSimulationModels();
      case "simulation.generate_agents":
        return this.generateSimulationAgents(input);
      case "simulation.plan":
        return this.planSimulation(input);
      case "simulation.run":
        return this.runSimulation(input);
      case "simulation.run_matrix":
        return this.runSimulationMatrix(input);
      case "simulation.stream":
        return this.streamSimulation(input);
      case "simulation.status":
        return this.simulationStatus(input);
      case "simulation.transcript":
        return this.simulationTranscript(input);
      case "simulation.compare":
        return this.compareSimulations(input);
      case "simulation.costs":
        return this.simulationCosts(input);
      case "simulation.interview":
        return this.interviewSimulation(input);
      case "simulation.report":
        return this.reportSimulation(input);
      case "simulation.export_spec":
        return this.exportSimulationSpec(input);
      case "board.create":
        return this.createBoard(cwd, input);
      case "board.add_node":
        return this.addBoardNode(cwd, input);
      case "board.update_node":
        return this.updateBoardNode(cwd, input);
      case "board.connect":
        return this.connectBoard(cwd, input);
      case "board.layout":
        return this.layoutBoard(cwd, input);
      case "board.export_mermaid_jam":
        return this.exportBoard(cwd, input);
      default:
        throw new Error(`Unhandled Studio tool: ${request.toolId}`);
    }
  }

  private async readWorkspace(input: Record<string, unknown>, config: StudioConfig): Promise<unknown> {
    const path = this.resolveWorkspacePath(stringInput(input.path, "path"), config);
    const itemStat = await stat(path);
    if (itemStat.isDirectory()) {
      const entries = await readdir(path, { withFileTypes: true });
      return {
        path,
        type: "directory",
        entries: entries.slice(0, 200).map((entry) => ({
          name: entry.name,
          path: join(path, entry.name),
          type: entry.isDirectory() ? "directory" : "file",
        })),
      };
    }
    return {
      path,
      type: "file",
      content: await readFile(path, "utf-8"),
    };
  }

  private async searchWorkspace(input: Record<string, unknown>, config: StudioConfig): Promise<unknown> {
    const query = stringInput(input.query, "query").toLowerCase();
    const root = this.resolveWorkspacePath(typeof input.path === "string" ? input.path : this.projectRoot, config);
    const files = await collectSearchFiles(root, 400);
    const matches: Array<{ path: string; match: string }> = [];
    for (const file of files) {
      const rel = relative(root, file);
      if (rel.toLowerCase().includes(query)) {
        matches.push({ path: file, match: rel });
        continue;
      }
      try {
        const content = await readFile(file, "utf-8");
        const line = content.split(/\r?\n/).find((candidate) => candidate.toLowerCase().includes(query));
        if (line) matches.push({ path: file, match: line.trim().slice(0, 240) });
      } catch {
        // Binary or unreadable files are ignored.
      }
      if (matches.length >= 50) break;
    }
    return { query, matches };
  }

  private async writeWorkspace(input: Record<string, unknown>, config: StudioConfig): Promise<unknown> {
    const path = this.resolveWorkspacePath(stringInput(input.path, "path"), config);
    const content = stringInput(input.content, "content");
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf-8");
    return { path, bytes: Buffer.byteLength(content) };
  }

  private runShell(input: Record<string, unknown>, config: StudioConfig, cwd: string, approved: boolean): unknown {
    if (!config.enabledTools.shell) throw new Error("Shell tools are disabled in Studio config");
    const command = stringInput(input.command, "command");
    assertShellCommandAllowed(command);
    if (!approved) throw Object.assign(new Error("Approval required to run shell commands"), { approvalReason: "Approve shell command" });
    return runCommand(process.env.SHELL || "sh", ["-lc", command], cwd);
  }

  private async searchKnowledge(input: Record<string, unknown>): Promise<unknown> {
    const query = typeof input.query === "string" ? input.query.toLowerCase() : "";
    const index = await listKnowledgeStore(this.projectRoot);
    return {
      query,
      matches: index.items
        .filter((item) => !query || `${item.title} ${item.summary} ${item.sourcePath} ${item.tags.join(" ")}`.toLowerCase().includes(query))
        .slice(0, 50),
    };
  }

  private async readKnowledge(input: Record<string, unknown>): Promise<unknown> {
    const id = stringInput(input.id, "id");
    const item = await getKnowledgeItem(this.projectRoot, id);
    if (!item) throw Object.assign(new Error(`Unknown knowledge item: ${id}`), { statusCode: 404 });
    return { item };
  }

  private async captureKnowledge(input: Record<string, unknown>, request: StudioToolCallRequest): Promise<unknown> {
    const event: StudioEvent = {
      id: randomUUID(),
      sessionId: request.sessionId ?? "studio-tool-broker",
      type: input.type === "design_decision" ? "design_decision" : "research_note",
      timestamp: new Date().toISOString(),
      message: stringInput(input.message ?? input.title, "message"),
      data: input,
    };
    return { item: await captureKnowledgeEvent(this.projectRoot, event, null, input.item && typeof input.item === "object" ? input.item : undefined) };
  }

  private async researchDesignPackage(input: Record<string, unknown>): Promise<unknown> {
    const designPackage = await this.buildResearchDesignPackageFromInput(input);
    return { package: designPackage };
  }

  private async generateResearchSpecs(input: Record<string, unknown>): Promise<unknown> {
    const designPackage = await this.buildResearchDesignPackageFromInput(input);
    const registry = new Registry(join(this.projectRoot, ".memoire"));
    await registry.load();
    const specWrite = await saveResearchDesignSpecs(designPackage, registry);
    return { package: designPackage, specWrite };
  }

  private async exportMermaidJam(input: Record<string, unknown>): Promise<unknown> {
    const designPackage = await this.buildResearchDesignPackageFromInput(input);
    const integration = await resolveMermaidJamIntegration({ projectRoot: this.projectRoot });
    const exports = await writeMermaidJamArtifacts(designPackage, { projectRoot: this.projectRoot, integration });
    return { package: designPackage, exports, integration };
  }

  private async createBoard(cwd: string, input: Record<string, unknown>): Promise<unknown> {
    return { board: await createMermaidBoard(cwd, input) };
  }

  private async addBoardNode(cwd: string, input: Record<string, unknown>): Promise<unknown> {
    return { board: await addMermaidBoardNode(cwd, input) };
  }

  private async updateBoardNode(cwd: string, input: Record<string, unknown>): Promise<unknown> {
    return { board: await updateMermaidBoardNode(cwd, input) };
  }

  private async connectBoard(cwd: string, input: Record<string, unknown>): Promise<unknown> {
    return { board: await connectMermaidBoardNodes(cwd, input) };
  }

  private async layoutBoard(cwd: string, input: Record<string, unknown>): Promise<unknown> {
    return { board: await layoutMermaidBoard(cwd, input) };
  }

  private async exportBoard(cwd: string, input: Record<string, unknown>): Promise<unknown> {
    return exportMermaidBoardForJam(cwd, input);
  }

  private async buildResearchDesignPackageFromInput(input: Record<string, unknown>) {
    const research = await this.researchInput(input);
    const source = optionalStringInput(input.source);
    const runId = optionalStringInput(input.runId) ?? (source && source !== "research" ? source : undefined);
    const report = runId ? await this.simulationReport(runId) : null;
    return buildResearchDesignPackage(research, {
      intent: optionalStringInput(input.intent),
      hypothesis: optionalStringInput(input.hypothesis),
      simulationReport: report,
    });
  }

  private async simulationReport(runId: string): Promise<SimulationReport | null> {
    const store = new FileSimulationStore(this.projectRoot);
    const run = await store.loadRun(runId);
    if (!run) return null;
    return this.createSimulationAdapter(run.adapter).exportReport(runId);
  }

  private listSimulationModels(): Promise<unknown> {
    return Promise.resolve({ profiles: new SimulationModelRouter().listProfiles() });
  }

  private async generateSimulationAgents(input: Record<string, unknown>): Promise<unknown> {
    const adapter = normalizeSimulationAdapter(input.adapter, "model-swarm");
    const research = await this.researchInput(input);
    const scenario = buildProductSimulationScenarioFromResearch(research, {
      adapter,
      agentCount: numberInput(input.agentCount ?? input.count, adapter === "model-swarm" ? 24 : undefined),
      budget: budgetFromInput(input),
    });
    return { adapter, agents: scenario.agents, graph: scenario.graph, budget: scenario.metadata.budget };
  }

  private async planSimulation(input: Record<string, unknown>): Promise<unknown> {
    const adapterKind = normalizeSimulationAdapter(input.adapter, "local");
    const research = await this.researchInput(input);
    const budget = budgetFromInput(input);
    const modelProfiles = adapterKind === "model-swarm" ? new SimulationModelRouter().listProfiles() : [];
    const scenario = buildProductSimulationScenarioFromResearch(research, {
      adapter: adapterKind,
      name: optionalStringInput(input.name),
      hypothesis: optionalStringInput(input.hypothesis),
      agentCount: numberInput(input.agentCount ?? input.count ?? input.maxAgents, adapterKind === "model-swarm" ? 24 : undefined),
      budget,
      modelProfiles,
      variables: Array.isArray(input.variables) ? input.variables.filter(isSimulationVariable).map((variable) => ({
        id: variable.id,
        name: variable.name,
        value: variable.value,
        description: variable.description ?? variable.name,
      })) : undefined,
    });
    return this.createSimulationAdapter(adapterKind, budget).prepare(scenario);
  }

  private async runSimulation(input: Record<string, unknown>): Promise<unknown> {
    const scenarioId = stringInput(input.scenarioId, "scenarioId");
    const store = new FileSimulationStore(this.projectRoot);
    const scenario = await store.loadScenario(scenarioId);
    const adapter = this.createSimulationAdapter(normalizeSimulationAdapter(input.adapter, scenario?.adapter ?? "local"), budgetFromInput(input));
    return { run: await adapter.start(scenarioId) };
  }

  private async runSimulationMatrix(input: Record<string, unknown>): Promise<unknown> {
    const adapterKind = normalizeSimulationAdapter(input.adapter, "model-swarm");
    const adapter = this.createSimulationAdapter(adapterKind, budgetFromInput(input));
    const research = await this.researchInput(input);
    const hypotheses = Array.isArray(input.hypotheses)
      ? input.hypotheses.filter((value): value is string => typeof value === "string" && value.length > 0)
      : [typeof input.hypothesis === "string" ? input.hypothesis : "Research-backed simulation will improve the product specification."];
    const runs = [];
    for (let index = 0; index < hypotheses.length; index += 1) {
      const scenario = buildProductSimulationScenarioFromResearch(research, {
        adapter: adapterKind,
        name: `${typeof input.name === "string" ? input.name : "Simulation matrix"} ${index + 1}`,
        hypothesis: hypotheses[index],
        agentCount: numberInput(input.agentCount ?? input.count ?? input.maxAgents, adapterKind === "model-swarm" ? 24 : undefined),
        budget: budgetFromInput(input),
        modelProfiles: adapterKind === "model-swarm" ? new SimulationModelRouter().listProfiles() : [],
      });
      const prepared = await adapter.prepare(scenario);
      const run = await adapter.start(prepared.scenario.id);
      runs.push({ hypothesis: hypotheses[index], scenario: prepared.scenario, run });
    }
    return { runs, comparison: compareSimulationRuns(runs.map((entry) => entry.run)) };
  }

  private async streamSimulation(input: Record<string, unknown>): Promise<unknown> {
    const runId = stringInput(input.runId, "runId");
    const adapter = await this.adapterForRun(runId, input);
    const events = [];
    for await (const event of adapter.stream(runId)) events.push(event);
    return { events };
  }

  private async simulationStatus(input: Record<string, unknown>): Promise<unknown> {
    const store = new FileSimulationStore(this.projectRoot);
    const run = await store.loadRun(stringInput(input.runId, "runId"));
    if (!run) throw Object.assign(new Error(`Unknown simulation run: ${String(input.runId)}`), { statusCode: 404 });
    return { run };
  }

  private async interviewSimulation(input: Record<string, unknown>): Promise<unknown> {
    const adapter = await this.adapterForRun(stringInput(input.runId, "runId"), input);
    return {
      interview: await adapter.interview(stringInput(input.runId, "runId"), {
        agentId: stringInput(input.agentId, "agentId"),
        prompt: stringInput(input.prompt, "prompt"),
      }),
    };
  }

  private async reportSimulation(input: Record<string, unknown>): Promise<unknown> {
    const adapter = await this.adapterForRun(stringInput(input.runId, "runId"), input);
    return { report: await adapter.exportReport(stringInput(input.runId, "runId")) };
  }

  private async exportSimulationSpec(input: Record<string, unknown>): Promise<unknown> {
    const adapter = await this.adapterForRun(stringInput(input.runId, "runId"), input);
    const report = await adapter.exportReport(stringInput(input.runId, "runId"));
    return { spec: exportProductSpecFromRun(report) };
  }

  private async simulationTranscript(input: Record<string, unknown>): Promise<unknown> {
    const store = new FileSimulationStore(this.projectRoot);
    const run = await store.loadRun(stringInput(input.runId, "runId"));
    if (!run) throw Object.assign(new Error(`Unknown simulation run: ${String(input.runId)}`), { statusCode: 404 });
    return { transcripts: run.transcripts };
  }

  private async compareSimulations(input: Record<string, unknown>): Promise<unknown> {
    const runIds = Array.isArray(input.runIds)
      ? input.runIds.filter((value): value is string => typeof value === "string")
      : [stringInput(input.runId, "runId")];
    const store = new FileSimulationStore(this.projectRoot);
    const runs = await Promise.all(runIds.map(async (runId) => {
      const run = await store.loadRun(runId);
      if (!run) throw Object.assign(new Error(`Unknown simulation run: ${runId}`), { statusCode: 404 });
      return run;
    }));
    return { comparison: compareSimulationRuns(runs) };
  }

  private async simulationCosts(input: Record<string, unknown>): Promise<unknown> {
    const store = new FileSimulationStore(this.projectRoot);
    const run = await store.loadRun(stringInput(input.runId, "runId"));
    if (!run) throw Object.assign(new Error(`Unknown simulation run: ${String(input.runId)}`), { statusCode: 404 });
    return { costs: simulationCosts(run) };
  }

  private async adapterForRun(runId: string, input: Record<string, unknown>): Promise<SimulationAdapter> {
    const store = new FileSimulationStore(this.projectRoot);
    const run = await store.loadRun(runId);
    return this.createSimulationAdapter(normalizeSimulationAdapter(input.adapter, run?.adapter ?? "local"), budgetFromInput(input));
  }

  private createSimulationAdapter(adapter: SimulationAdapterKind, budget?: Partial<SimulationBudget>): SimulationAdapter {
    if (adapter === "model-swarm") return new ModelSwarmSimulationAdapter({ store: new FileSimulationStore(this.projectRoot), defaultBudget: budget });
    return this.simulation;
  }

  private async researchInput(input: Record<string, unknown>): Promise<ResearchStore> {
    return input.research && typeof input.research === "object" && !Array.isArray(input.research) && "version" in input.research
      ? input.research as ResearchStore
      : await this.loadResearchStoreOrEmpty(this.projectRoot);
  }

  private async loadResearchStoreOrEmpty(cwd: string): Promise<ResearchStore> {
    try {
      const raw = await readFile(join(cwd, "research", "store.v2.json"), "utf-8");
      return JSON.parse(raw) as ResearchStore;
    } catch {
      return emptyResearchStore();
    }
  }

  private resolveWorkspacePath(path: string, config: StudioConfig): string {
    const resolved = resolve(path);
    if (!isInWorkspace(resolved, config.workspaceRoots)) {
      throw Object.assign(new Error(`Workspace path is not allowed: ${resolved}`), { statusCode: 403 });
    }
    return resolved;
  }
}

const MEMOIRE_MCP_TOOL_NAMES = [
  "pull_design_system",
  "get_specs",
  "get_spec",
  "create_spec",
  "generate_code",
  "get_tokens",
  "sync_design_tokens",
  "capture_screenshot",
  "get_selection",
  "get_page_tree",
  "compose",
  "run_audit",
  "get_research",
  "analyze_design",
  "measure_text",
  "get_ai_usage",
  "check_bridge_health",
  "design_doc",
  "research.design_package",
  "research.generate_specs",
  "mermaid_jam.export",
  "simulation.models",
  "simulation.generate_agents",
  "simulation.plan",
  "simulation.run",
  "simulation.run_matrix",
  "simulation.stream",
  "simulation.status",
  "simulation.transcript",
  "simulation.compare",
  "simulation.costs",
  "simulation.interview",
  "simulation.report",
  "simulation.export_spec",
  "board.create",
  "board.add_node",
  "board.update_node",
  "board.connect",
  "board.layout",
  "board.export_mermaid_jam",
];

function tool(id: string, label: string, category: StudioToolDefinition["category"], description: string, requiresApproval: boolean): StudioToolDefinition {
  return { id, label, category, description, requiresApproval, enabled: true };
}

function browserRequestFromTool(toolId: string, input: Record<string, unknown>): StudioBrowserActionRequest {
  const action = toolId.replace("browser.", "") as StudioBrowserActionRequest["action"];
  return {
    action,
    sessionId: typeof input.sessionId === "string" ? input.sessionId : undefined,
    url: typeof input.url === "string" ? input.url : undefined,
    selector: typeof input.selector === "string" ? input.selector : undefined,
    text: typeof input.text === "string" ? input.text : undefined,
  };
}

function stringInput(value: unknown, name: string): string {
  if (typeof value === "string" && value.length > 0) return value;
  throw Object.assign(new Error(`Studio tool requires ${name}`), { statusCode: 400 });
}

function optionalStringInput(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function normalizeSimulationAdapter(value: unknown, fallback: SimulationAdapterKind): SimulationAdapterKind {
  if (value === "model-swarm" || value === "mirofish" || value === "local") return value;
  return fallback;
}

function numberInput(value: unknown, fallback: number): number;
function numberInput(value: unknown, fallback: number | undefined): number | undefined;
function numberInput(value: unknown, fallback: number | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function budgetFromInput(input: Record<string, unknown>): Partial<SimulationBudget> | undefined {
  const budget: Partial<SimulationBudget> = {};
  const maxAgents = numberInput(input.maxAgents, undefined);
  const maxRounds = numberInput(input.maxRounds ?? input.rounds, undefined);
  const maxTokens = numberInput(input.maxTokens, undefined);
  const maxEstimatedCostUsd = numberInput(input.maxEstimatedCostUsd ?? input.maxCost, undefined);
  if (maxAgents !== undefined) budget.maxAgents = maxAgents;
  if (maxRounds !== undefined) budget.maxRounds = maxRounds;
  if (maxTokens !== undefined) budget.maxTokens = maxTokens;
  if (maxEstimatedCostUsd !== undefined) budget.maxEstimatedCostUsd = maxEstimatedCostUsd;
  if (typeof input.allowLiveModels === "boolean") budget.allowLiveModels = input.allowLiveModels;
  if (typeof input.liveModels === "boolean") budget.allowLiveModels = input.liveModels;
  return Object.keys(budget).length ? budget : undefined;
}

function isSimulationVariable(value: unknown): value is { id: string; name: string; value: string; description?: string } {
  return Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && typeof (value as { id?: unknown }).id === "string"
    && typeof (value as { name?: unknown }).name === "string"
    && typeof (value as { value?: unknown }).value === "string",
  );
}

function emptyResearchStore(): ResearchStore {
  return {
    version: 2,
    sources: [],
    observations: [],
    highlights: [],
    codebook: [],
    findings: [],
    themes: [],
    evidenceLinks: [],
    personas: [],
    quantitativeMetrics: [],
    opportunities: [],
    risks: [],
    contradictions: [],
    reports: [],
    quality: {
      overallScore: 0,
      sampleSize: 0,
      completenessScore: 0,
      sourceDiversityScore: 0,
      triangulationScore: 0,
      structureScore: 0,
      notes: [],
      generatedAt: new Date().toISOString(),
    },
    methods: {
      analysisMode: "decision-grade",
      quantitativeApproach: "",
      qualitativeApproach: "",
      limitations: [],
    },
  };
}

function runCommand(command: string, args: string[], cwd: string): { command: string; args: string[]; cwd: string; status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf-8",
    shell: false,
    timeout: 30_000,
    maxBuffer: 2_000_000,
  });
  return {
    command,
    args,
    cwd,
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function assertShellCommandAllowed(command: string): void {
  for (const blocked of getHarnessManifest().hardlineBlockedPatterns) {
    if (new RegExp(blocked.pattern, "iu").test(command)) {
      throw new Error(`Blocked shell command: ${blocked.description}`);
    }
  }
}

async function collectSearchFiles(root: string, max: number): Promise<string[]> {
  const files: string[] = [];
  async function walk(dir: string): Promise<void> {
    if (files.length >= max) return;
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (files.length >= max) return;
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (/\.(md|mdx|ya?ml|json|ts|tsx|js|jsx|css|html)$/i.test(entry.name)) files.push(path);
    }
  }
  await walk(root);
  return files;
}

function isInWorkspace(path: string, roots: string[]): boolean {
  return roots.some((root) => isSubpath(path, root));
}

function isSubpath(path: string, root: string): boolean {
  const normalizedPath = canonicalPath(path);
  const normalizedRoot = canonicalPath(root);
  const rel = relative(normalizedRoot, normalizedPath);
  return rel === "" || (!rel.startsWith("..") && !rel.includes(`..${sep}`) && rel !== "..");
}

function canonicalPath(path: string): string {
  const resolved = resolve(path);
  try {
    return realpathSync.native(resolved);
  } catch {
    const parent = dirname(resolved);
    if (parent === resolved) return resolved;
    const canonicalParent = canonicalPath(parent);
    return join(canonicalParent, resolved.slice(parent.length + 1));
  }
}

function approvalFrom(error: unknown): string | null {
  if (error && typeof error === "object" && typeof (error as { approvalReason?: unknown }).approvalReason === "string") {
    return (error as { approvalReason: string }).approvalReason;
  }
  return null;
}

function artifactPathFrom(data: unknown): string | null {
  if (data && typeof data === "object" && typeof (data as { artifactPath?: unknown }).artifactPath === "string") {
    return (data as { artifactPath: string }).artifactPath;
  }
  return null;
}
