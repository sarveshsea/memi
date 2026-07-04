import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import type { StudioBrowserAdapter } from "./browser-adapter.js";
import { getHarnessManifest } from "./harnesses.js";
import { captureKnowledgeEvent, getKnowledgeItem, listKnowledgeStore } from "./knowledge-store.js";
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
import { buildUxAuditReport, writeUxAuditReport } from "../ux/tenets-traps.js";
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

type BoardNodeKind = "mermaid" | "sticky" | "evidence" | "persona" | "risk" | "metric" | "spec" | "comment";
type BoardMode = "pm-brainstorm" | "ia" | "sandbox";

interface BoardNode {
  id: string;
  kind: BoardNodeKind;
  title: string;
  body: string;
  mermaidSource?: string;
  researchBacking: string[];
  sourceEventIds: string[];
  author: "human" | "agent";
  laneId?: string;
  priority?: "low" | "medium" | "high";
  confidence?: number;
  decisionStatus?: "open" | "recommended" | "decided" | "blocked";
  position: { x: number; y: number; width: number; height: number };
  createdAt: string;
  updatedAt: string;
}

interface BoardEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label: string;
  sourceEventIds: string[];
  author: "human" | "agent";
  createdAt: string;
  updatedAt: string;
}

interface BoardState {
  schemaVersion: 1;
  id: string;
  title: string;
  description: string;
  mode: BoardMode;
  templateId: string;
  brief: { problem: string; targetUser: string; outcome: string; constraints: string[]; prompt?: string };
  lastFigJamSync?: {
    status: "idle" | "synced" | "fallback" | "unavailable" | "failed";
    message: string;
    syncedAt: string;
    integration: string;
    outputPaths: string[];
    createdNodeCount: number;
    artifactPath: string | null;
    diagnostics: string[];
    fallbackReason?: string;
  } | null;
  nodes: BoardNode[];
  edges: BoardEdge[];
  frames: Array<{ id: string; title: string; nodeIds: string[]; laneId?: string; position: { x: number; y: number; width: number; height: number } }>;
  createdAt: string;
  updatedAt: string;
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
      tool("ux.audit_screenshot", "UX audit", "review", "Audit a screenshot artifact against UX tenets and traps.", false),
      tool("mcp.list", "MCP list", "mcp", "List Mémoire MCP tools available to external agents.", false),
      tool("mcp.call", "MCP call", "mcp", "Reserved external MCP call adapter.", true),
      tool("knowledge.search", "Knowledge search", "knowledge", "Search indexed markdown, YAML, specs, references, and captures.", false),
      tool("knowledge.read", "Knowledge read", "knowledge", "Read an indexed knowledge item.", false),
      tool("knowledge.capture", "Knowledge capture", "knowledge", "Persist a research note, design decision, or artifact capture.", false),
      tool("research_design_package", "Research design", "research", "Preview research-backed vibe design specs and Mermaid Jam source.", false),
      tool("research_generate_specs", "Research specs", "research", "Write research-backed Atomic Design specs through the Memoire registry.", true),
      tool("mermaid_jam_export", "FigJam export", "research", "Write Mermaid Jam source artifacts for FigJam from research or simulation output.", false),
      tool("board.create", "Board create", "board", "Create a local PM/FigJam-ready board from prompt or research context.", false),
      tool("board.add_node", "Board node", "board", "Add a local board card with evidence metadata.", false),
      tool("board.update_node", "Board update", "board", "Update a local board card.", false),
      tool("board.connect", "Board connect", "board", "Connect two local board cards.", false),
      tool("board.layout", "Board layout", "board", "Lay out local board cards into product-design lanes.", false),
      tool("board.capture_ia", "IA capture", "board", "Capture an IA board from the current agent trace.", false),
      tool("board.export_mermaid_jam", "Board export", "board", "Write local Mermaid Jam source files for a board without syncing externally.", false),
      tool("board.apply_template", "Board template", "board", "Apply the product brainstorm template to a local board.", false),
      tool("board.sync_figjam", "FigJam source", "board", "Prepare local FigJam source and report sync readiness without external writes.", false),
      tool("simulation_models", "Simulation models", "simulation", "List Codex-first model profiles available to Scenario Lab.", false),
      tool("simulation_generate_agents", "Simulation agents", "simulation", "Generate a 20-60 agent model-swarm cohort from research evidence.", false),
      tool("simulation_plan", "Simulation plan", "simulation", "Plan a local or model-swarm product simulation from research evidence.", false),
      tool("simulation_run", "Simulation run", "simulation", "Run a local or model-swarm product-team simulation.", false),
      tool("simulation_run_matrix", "Simulation matrix", "simulation", "Run multiple hypotheses and compare model-swarm outcomes.", false),
      tool("simulation_stream", "Simulation stream", "simulation", "Read persisted simulation events in stream order.", false),
      tool("simulation_status", "Simulation status", "simulation", "Read a local simulation run status.", false),
      tool("simulation_transcript", "Simulation transcript", "simulation", "Read model-swarm transcript memory for a run.", false),
      tool("simulation_compare", "Simulation compare", "simulation", "Compare completed simulation runs.", false),
      tool("simulation_costs", "Simulation costs", "simulation", "Summarize token and cost usage for a simulation run.", false),
      tool("simulation_interview", "Simulation interview", "simulation", "Interview a simulated stakeholder agent from a run.", false),
      tool("simulation_report", "Simulation report", "simulation", "Export a simulation report with recommendations and evidence.", false),
      tool("simulation_export_spec", "Simulation spec", "simulation", "Export a product spec impact report from a simulation run.", false),
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
      case "ux.audit_screenshot":
        return this.auditUxScreenshot(input, config);
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
      case "research_design_package":
        return this.researchDesignPackage(input);
      case "research_generate_specs":
        if (!request.approved) throw Object.assign(new Error("Approval required to write generated research specs"), { approvalReason: "Approve research spec generation" });
        return this.generateResearchSpecs(input);
      case "mermaid_jam_export":
        return this.exportMermaidJam(input);
      case "board.create":
        return this.createBoard(input);
      case "board.add_node":
        return this.addBoardNode(input);
      case "board.update_node":
        return this.updateBoardNode(input);
      case "board.connect":
        return this.connectBoardNodes(input);
      case "board.layout":
        return this.layoutBoard(input);
      case "board.capture_ia":
        return this.captureIABoard(input, request);
      case "board.export_mermaid_jam":
        return this.exportBoardMermaidJam(input);
      case "board.apply_template":
        return this.applyBoardTemplate(input);
      case "board.sync_figjam":
        return this.syncBoardFigJam(input);
      case "simulation_models":
        return this.listSimulationModels();
      case "simulation_generate_agents":
        return this.generateSimulationAgents(input);
      case "simulation_plan":
        return this.planSimulation(input);
      case "simulation_run":
        return this.runSimulation(input);
      case "simulation_run_matrix":
        return this.runSimulationMatrix(input);
      case "simulation_stream":
        return this.streamSimulation(input);
      case "simulation_status":
        return this.simulationStatus(input);
      case "simulation_transcript":
        return this.simulationTranscript(input);
      case "simulation_compare":
        return this.compareSimulations(input);
      case "simulation_costs":
        return this.simulationCosts(input);
      case "simulation_interview":
        return this.interviewSimulation(input);
      case "simulation_report":
        return this.reportSimulation(input);
      case "simulation_export_spec":
        return this.exportSimulationSpec(input);
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

  private async createBoard(input: Record<string, unknown>): Promise<unknown> {
    const board = this.applyBoardTemplateDefaults(this.newBoard(input, normalizeBoardMode(input.mode, "pm-brainstorm")));
    await this.saveBoard(board);
    return { board };
  }

  private async applyBoardTemplate(input: Record<string, unknown>): Promise<unknown> {
    const board = this.applyBoardTemplateDefaults(await this.loadOrCreateBoard(input, "pm-brainstorm"));
    await this.saveBoard(board);
    return { board };
  }

  private async addBoardNode(input: Record<string, unknown>): Promise<unknown> {
    const board = await this.loadOrCreateBoard(input, normalizeBoardMode(input.mode, "pm-brainstorm"));
    const now = new Date().toISOString();
    board.nodes.push({
      id: optionalStringInput(input.nodeId ?? input.id) ?? `node-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`,
      kind: normalizeBoardNodeKind(input.kind),
      title: optionalStringInput(input.title) ?? titleForBoardNodeKind(normalizeBoardNodeKind(input.kind)),
      body: optionalStringInput(input.body ?? input.text ?? input.prompt) ?? "Captured board note.",
      mermaidSource: optionalStringInput(input.mermaidSource ?? input.source),
      researchBacking: stringListInput(input.researchBacking ?? input.evidence),
      sourceEventIds: stringListInput(input.sourceEventIds),
      author: input.author === "human" ? "human" : "agent",
      laneId: optionalStringInput(input.laneId) ?? laneForBoardNodeKind(normalizeBoardNodeKind(input.kind), board.mode),
      priority: normalizePriority(input.priority),
      confidence: numberInput(input.confidence, undefined),
      decisionStatus: normalizeDecisionStatus(input.decisionStatus),
      position: { x: 0, y: 0, width: 220, height: 128 },
      createdAt: now,
      updatedAt: now,
    });
    const laidOut = layoutBoardNodes(board);
    await this.saveBoard(laidOut);
    return { board: laidOut };
  }

  private async updateBoardNode(input: Record<string, unknown>): Promise<unknown> {
    const board = await this.loadBoardOrThrow(boardIdFromInput(input));
    const nodeId = stringInput(input.nodeId ?? input.id, "nodeId");
    const node = board.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) throw Object.assign(new Error(`Unknown board node: ${nodeId}`), { statusCode: 404 });
    node.title = optionalStringInput(input.title) ?? node.title;
    node.body = optionalStringInput(input.body ?? input.text) ?? node.body;
    node.mermaidSource = optionalStringInput(input.mermaidSource ?? input.source) ?? node.mermaidSource;
    node.laneId = optionalStringInput(input.laneId) ?? node.laneId;
    node.priority = normalizePriority(input.priority) ?? node.priority;
    node.confidence = numberInput(input.confidence, undefined) ?? node.confidence;
    node.decisionStatus = normalizeDecisionStatus(input.decisionStatus) ?? node.decisionStatus;
    node.updatedAt = new Date().toISOString();
    board.updatedAt = node.updatedAt;
    await this.saveBoard(board);
    return { board, node };
  }

  private async connectBoardNodes(input: Record<string, unknown>): Promise<unknown> {
    const board = await this.loadBoardOrThrow(boardIdFromInput(input));
    const fromNodeId = stringInput(input.fromNodeId ?? input.from, "fromNodeId");
    const toNodeId = stringInput(input.toNodeId ?? input.to, "toNodeId");
    if (!board.nodes.some((node) => node.id === fromNodeId)) throw Object.assign(new Error(`Unknown board node: ${fromNodeId}`), { statusCode: 404 });
    if (!board.nodes.some((node) => node.id === toNodeId)) throw Object.assign(new Error(`Unknown board node: ${toNodeId}`), { statusCode: 404 });
    const now = new Date().toISOString();
    const edge: BoardEdge = {
      id: optionalStringInput(input.edgeId ?? input.id) ?? `edge-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`,
      fromNodeId,
      toNodeId,
      label: optionalStringInput(input.label) ?? "relates to",
      sourceEventIds: stringListInput(input.sourceEventIds),
      author: input.author === "human" ? "human" : "agent",
      createdAt: now,
      updatedAt: now,
    };
    board.edges.push(edge);
    board.updatedAt = now;
    await this.saveBoard(board);
    return { board, edge };
  }

  private async layoutBoard(input: Record<string, unknown>): Promise<unknown> {
    const board = layoutBoardNodes(await this.loadBoardOrThrow(boardIdFromInput(input)));
    await this.saveBoard(board);
    return { board };
  }

  private async captureIABoard(input: Record<string, unknown>, request: StudioToolCallRequest): Promise<unknown> {
    const board = this.applyBoardTemplateDefaults(this.newBoard({ ...input, id: optionalStringInput(input.boardId ?? input.id) ?? "studio-ia-board" }, "ia"));
    const events = Array.isArray(input.events) ? input.events.filter((event): event is StudioEvent => Boolean(event && typeof event === "object")) : [];
    const sourceEventIds = events.map((event) => event.id).filter(Boolean).slice(0, 8);
    const now = new Date().toISOString();
    const prompt = optionalStringInput(input.prompt) ?? "Capture IA from current run.";
    board.nodes.push({
      id: `ia-source-${randomUUID().slice(0, 8)}`,
      kind: "evidence",
      title: "Run evidence",
      body: events.slice(-3).map((event) => event.message).join("\n") || prompt,
      researchBacking: [],
      sourceEventIds: sourceEventIds.length ? sourceEventIds : request.sessionId ? [request.sessionId] : [],
      author: "agent",
      laneId: "evidence",
      position: { x: 0, y: 0, width: 240, height: 140 },
      createdAt: now,
      updatedAt: now,
    });
    const laidOut = layoutBoardNodes(board);
    await this.saveBoard(laidOut);
    return { board: laidOut };
  }

  private async exportBoardMermaidJam(input: Record<string, unknown>): Promise<unknown> {
    const board = await this.loadBoardOrThrow(boardIdFromInput(input));
    const exports = await this.writeBoardExports(board);
    return { board, exports, integration: await resolveMermaidJamIntegration({ projectRoot: this.projectRoot }) };
  }

  private async syncBoardFigJam(input: Record<string, unknown>): Promise<unknown> {
    const board = await this.loadBoardOrThrow(boardIdFromInput(input));
    const exports = await this.writeBoardExports(board);
    const sync = {
      status: "fallback" as const,
      message: "Local Mermaid Jam source is ready. Direct FigJam writes were not executed.",
      syncedAt: new Date().toISOString(),
      integration: exports[0]?.integration ?? "mermaid-jam",
      outputPaths: exports.map((item) => item.outputPath),
      createdNodeCount: 0,
      artifactPath: exports[0]?.outputPath ?? null,
      diagnostics: ["External FigJam sync requires an explicit approval and connected bridge."],
      fallbackReason: "No external FigJam write was requested.",
    };
    board.lastFigJamSync = sync;
    board.updatedAt = sync.syncedAt;
    await this.saveBoard(board);
    return { board, exports, sync };
  }

  private newBoard(input: Record<string, unknown>, mode: BoardMode): BoardState {
    const now = new Date().toISOString();
    const prompt = optionalStringInput(input.prompt);
    const id = optionalStringInput(input.id ?? input.boardId) ?? (mode === "ia" ? "studio-ia-board" : "studio-mermaid-board");
    return {
      schemaVersion: 1,
      id,
      title: optionalStringInput(input.title) ?? (mode === "ia" ? "IA Board" : "Product Design Board"),
      description: optionalStringInput(input.description) ?? "Local Studio board for product design planning and FigJam source export.",
      mode,
      templateId: optionalStringInput(input.templateId) ?? (mode === "ia" ? "ia-journeys" : "pm-brainstorm"),
      brief: {
        problem: optionalStringInput(input.problem) ?? prompt ?? "Clarify the product design direction.",
        targetUser: optionalStringInput(input.targetUser) ?? "Product designers and PMs",
        outcome: optionalStringInput(input.outcome) ?? "A board of editable, evidence-linked design decisions.",
        constraints: stringListInput(input.constraints),
        ...(prompt ? { prompt } : {}),
      },
      lastFigJamSync: null,
      nodes: [],
      edges: [],
      frames: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  private applyBoardTemplateDefaults(board: BoardState): BoardState {
    if (board.nodes.length > 0) return layoutBoardNodes(board);
    const now = new Date().toISOString();
    const defaults = board.mode === "ia"
      ? [
          ["sitemap", "spec", "Sitemap hypothesis", "Top-level routes and product areas to validate."],
          ["navigation", "sticky", "Navigation model", "Primary wayfinding, labels, and hierarchy."],
          ["journeys", "mermaid", "Journey flow", "flowchart TD\n  Start[Open product] --> Decide[Choose task]\n  Decide --> Done[Complete flow]"],
          ["screens", "spec", "Screen inventory", "Screens and states required for the next prototype."],
        ]
      : [
          ["problem", "sticky", "Problem", board.brief.problem],
          ["users", "persona", "User", board.brief.targetUser],
          ["journey", "mermaid", "Journey map", "journey\n  title Product design review\n  section Discover\n    Gather evidence: 5: Designer\n  section Decide\n    Compare options: 4: PM\n  section Ship\n    Export FigJam source: 5: Designer"],
          ["opportunities", "spec", "Opportunity", board.brief.outcome],
          ["risks", "risk", "Risk", "Source evidence can get lost if the board is not kept local and editable."],
          ["metrics", "metric", "Metric", "Decision confidence and handoff completeness."],
        ];
    board.nodes = defaults.map(([laneId, kind, title, body], index) => ({
      id: `node-${safeSlug(laneId)}-${index + 1}`,
      kind: normalizeBoardNodeKind(kind),
      title,
      body,
      mermaidSource: kind === "mermaid" ? body : undefined,
      researchBacking: [],
      sourceEventIds: [],
      author: "agent",
      laneId,
      priority: index === 0 ? "high" : "medium",
      decisionStatus: kind === "risk" ? "open" : undefined,
      position: { x: 0, y: 0, width: 220, height: 128 },
      createdAt: now,
      updatedAt: now,
    }));
    board.updatedAt = now;
    return layoutBoardNodes(board);
  }

  private async loadOrCreateBoard(input: Record<string, unknown>, mode: BoardMode): Promise<BoardState> {
    const id = optionalStringInput(input.boardId ?? input.id);
    if (id) {
      const loaded = await this.loadBoard(id);
      if (loaded) return loaded;
    }
    return this.newBoard(input, mode);
  }

  private async loadBoardOrThrow(id: string): Promise<BoardState> {
    const board = await this.loadBoard(id);
    if (!board) throw Object.assign(new Error(`Unknown board: ${id}`), { statusCode: 404 });
    return board;
  }

  private async loadBoard(id: string): Promise<BoardState | null> {
    try {
      return JSON.parse(await readFile(this.boardPath(id), "utf-8")) as BoardState;
    } catch {
      return null;
    }
  }

  private async saveBoard(board: BoardState): Promise<void> {
    await mkdir(dirname(this.boardPath(board.id)), { recursive: true });
    await writeFile(this.boardPath(board.id), JSON.stringify(board, null, 2) + "\n", "utf-8");
  }

  private boardPath(id: string): string {
    return join(this.projectRoot, ".memoire", "studio", "boards", `${safeSlug(id)}.json`);
  }

  private async writeBoardExports(board: BoardState) {
    const integration = await resolveMermaidJamIntegration({ projectRoot: this.projectRoot });
    const outputDir = join(this.projectRoot, ".memoire", "mermaid-jam", "boards", safeSlug(board.id));
    await mkdir(outputDir, { recursive: true });
    const markdownSource = boardMarkdownSource(board);
    const mermaidSource = boardMermaidSource(board);
    const jsonSource = JSON.stringify(board, null, 2);
    const outputs = [
      { id: `${board.id}-summary`, title: `${board.title} summary`, format: "markdown" as const, kind: "board-summary" as const, source: markdownSource, outputPath: join(outputDir, "board.md") },
      { id: `${board.id}-source`, title: `${board.title} Mermaid`, format: "mermaid" as const, kind: "board-source" as const, source: mermaidSource, outputPath: join(outputDir, "board.mmd") },
      { id: `${board.id}-json`, title: `${board.title} JSON`, format: "json" as const, kind: "board-json" as const, source: jsonSource, outputPath: join(outputDir, "board.json") },
    ];
    for (const output of outputs) await writeFile(output.outputPath, output.source, "utf-8");
    return outputs.map((output) => ({
      ...output,
      integration: integration.id,
      nextSteps: [
        `Open Mermaid Jam in FigJam using ${integration.local.ready && integration.local.manifestPath ? integration.local.manifestPath : integration.communityUrl}.`,
        `Paste the saved source from ${output.outputPath}; no external sync was executed by Studio.`,
      ],
    }));
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

  private async auditUxScreenshot(input: Record<string, unknown>, config: StudioConfig): Promise<unknown> {
    const artifactPath = this.resolveWorkspacePath(
      stringInput(input.artifactPath ?? input.screenshotPath ?? input.path, "artifactPath"),
      config,
    );
    await stat(artifactPath);
    const report = buildUxAuditReport({
      target: optionalStringInput(input.target) ?? "screenshot",
      artifactPath,
      source: "screenshot",
    });
    const artifact = await writeUxAuditReport(this.projectRoot, report);
    return {
      report,
      artifactPath: artifact.jsonPath,
      markdownPath: artifact.markdownPath,
      screenshotPath: artifactPath,
      designSystemArtifact: {
        kind: "ux-tenets-traps",
        path: artifact.jsonPath,
        markdownPath: artifact.markdownPath,
        score: report.score,
        traps: report.trapRisks.filter((risk) => risk.status !== "clear").map((risk) => risk.trapId),
      },
    };
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
  "audit_ux_tenets_traps",
  "research_design_package",
  "research_generate_specs",
  "mermaid_jam_export",
  "board.create",
  "board.add_node",
  "board.update_node",
  "board.connect",
  "board.layout",
  "board.capture_ia",
  "board.export_mermaid_jam",
  "board.apply_template",
  "board.sync_figjam",
  "simulation_models",
  "simulation_generate_agents",
  "simulation_plan",
  "simulation_run",
  "simulation_run_matrix",
  "simulation_stream",
  "simulation_status",
  "simulation_transcript",
  "simulation_compare",
  "simulation_costs",
  "simulation_interview",
  "simulation_report",
  "simulation_export_spec",
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

function stringListInput(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  if (typeof value === "string" && value.length > 0) return [value];
  return [];
}

function boardIdFromInput(input: Record<string, unknown>): string {
  return optionalStringInput(input.boardId ?? input.id) ?? "studio-mermaid-board";
}

function normalizeBoardMode(value: unknown, fallback: BoardMode): BoardMode {
  if (value === "pm-brainstorm" || value === "ia" || value === "sandbox") return value;
  return fallback;
}

function normalizeBoardNodeKind(value: unknown): BoardNodeKind {
  if (value === "mermaid" || value === "sticky" || value === "evidence" || value === "persona" || value === "risk" || value === "metric" || value === "spec" || value === "comment") return value;
  return "sticky";
}

function titleForBoardNodeKind(kind: BoardNodeKind): string {
  if (kind === "persona") return "Persona";
  if (kind === "risk") return "Risk";
  if (kind === "metric") return "Metric";
  if (kind === "spec") return "Spec";
  if (kind === "evidence") return "Evidence";
  if (kind === "comment") return "Decision";
  if (kind === "mermaid") return "Flow";
  return "Note";
}

function laneForBoardNodeKind(kind: BoardNodeKind, mode: BoardMode): string {
  if (mode === "ia") {
    if (kind === "mermaid") return "journeys";
    if (kind === "spec") return "screens";
    return "evidence";
  }
  if (kind === "persona") return "users";
  if (kind === "mermaid") return "journey";
  if (kind === "spec") return "opportunities";
  if (kind === "comment") return "decisions";
  if (kind === "risk") return "risks";
  if (kind === "metric") return "metrics";
  if (kind === "evidence") return "next-steps";
  return "problem";
}

function normalizePriority(value: unknown): BoardNode["priority"] | undefined {
  if (value === "low" || value === "medium" || value === "high") return value;
  return undefined;
}

function normalizeDecisionStatus(value: unknown): BoardNode["decisionStatus"] | undefined {
  if (value === "open" || value === "recommended" || value === "decided" || value === "blocked") return value;
  return undefined;
}

function layoutBoardNodes(board: BoardState): BoardState {
  const laneOrder = board.mode === "ia"
    ? ["sitemap", "navigation", "journeys", "screens", "evidence"]
    : ["problem", "users", "journey", "opportunities", "decisions", "risks", "metrics", "next-steps"];
  const laneIndex = new Map(laneOrder.map((lane, index) => [lane, index]));
  const counts = new Map<string, number>();
  const now = new Date().toISOString();
  board.nodes = board.nodes.map((node) => {
    const laneId = node.laneId ?? laneForBoardNodeKind(node.kind, board.mode);
    const index = counts.get(laneId) ?? 0;
    counts.set(laneId, index + 1);
    return {
      ...node,
      laneId,
      position: {
        x: (laneIndex.get(laneId) ?? laneOrder.length) * 260,
        y: index * 160,
        width: node.position?.width ?? 220,
        height: node.position?.height ?? 128,
      },
      updatedAt: node.updatedAt ?? now,
    };
  });
  board.frames = laneOrder.map((lane, index) => ({
    id: `frame-${lane}`,
    title: lane.replace(/-/g, " "),
    laneId: lane,
    nodeIds: board.nodes.filter((node) => node.laneId === lane).map((node) => node.id),
    position: { x: index * 260 - 16, y: -48, width: 248, height: Math.max(180, (counts.get(lane) ?? 1) * 160) },
  }));
  board.updatedAt = now;
  return board;
}

function boardMarkdownSource(board: BoardState): string {
  return [
    `# ${board.title}`,
    "",
    board.description,
    "",
    `Problem: ${board.brief.problem}`,
    `Target user: ${board.brief.targetUser}`,
    `Outcome: ${board.brief.outcome}`,
    "",
    "## Cards",
    ...board.nodes.map((node) => [
      "",
      `### ${node.title}`,
      `Lane: ${node.laneId ?? laneForBoardNodeKind(node.kind, board.mode)} / ${node.kind}`,
      node.body,
      node.mermaidSource ? `\n\`\`\`mermaid\n${node.mermaidSource}\n\`\`\`` : "",
    ].filter(Boolean).join("\n")),
  ].join("\n");
}

function boardMermaidSource(board: BoardState): string {
  const lines = ["flowchart LR"];
  for (const node of board.nodes) {
    lines.push(`  ${safeMermaidId(node.id)}["${escapeMermaidLabel(node.title)}"]`);
  }
  for (const edge of board.edges) {
    lines.push(`  ${safeMermaidId(edge.fromNodeId)} -->|${escapeMermaidLabel(edge.label)}| ${safeMermaidId(edge.toNodeId)}`);
  }
  if (board.edges.length === 0) {
    for (let index = 0; index < board.nodes.length - 1; index += 1) {
      lines.push(`  ${safeMermaidId(board.nodes[index].id)} --> ${safeMermaidId(board.nodes[index + 1].id)}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function safeSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || "board";
}

function safeMermaidId(value: string): string {
  return `n_${value.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

function escapeMermaidLabel(value: string): string {
  return value.replace(/"/g, "'");
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
