import type { ProjectMemoryKind, StudioAgentContext, StudioCodexConfig, StudioHarnessId, StudioRunAction } from "./types.js";
import { MEMOIRE_PACKAGE_NAME, MEMOIRE_PACKAGE_URL, MEMOIRE_PACKAGE_VERSION } from "./package-info.js";
import { agenticDesignSystemPromptLines } from "./agentic-design-system.js";

const KIND_LABELS: Record<ProjectMemoryKind, string> = {
  home: "Home",
  research: "Research",
  spec: "Specs",
  system: "Systems",
  monitor: "Monitor",
  changelog: "Changelog",
};

const DEFAULT_CODEX_CONFIG: StudioCodexConfig = {
  model: "gpt-5.5",
  reasoningEffort: "xhigh",
  approvalPolicy: "never",
  webSearch: true,
  skipGitRepoCheck: true,
  includeMemoireCommands: true,
  includeCodexCommands: true,
  planModeDefault: false,
};

export function createDesignAgentSystemPrompt(context: StudioAgentContext): string {
  const codex = context.harness === "codex" ? normalizedCodexConfig(context.codex) : null;
  return [
    "You are the Mémoire Studio design harness.",
    "Act as a product design, UX research, and design-system agent before acting as a coding agent.",
    "Preserve Atomic Design levels: atom, molecule, organism, template, page.",
    "Use project memory, specs, reference corpus, and Figma bridge state as first-class context.",
    `Reference package: ${MEMOIRE_PACKAGE_NAME}@${MEMOIRE_PACKAGE_VERSION}.`,
    "When full_access is selected, execute workspace, terminal, and computer actions directly while keeping every action traceable.",
    context.goal?.trim() ? `Persistent conversation goal: ${context.goal.trim()}` : "",
    context.permissionMode === "plan" ? "Plan mode is read-only: inspect, research, and propose before editing files or running mutating commands." : "",
    codex ? `Codex settings: model ${codex.model}, model_reasoning_effort ${codex.reasoningEffort}, approval_policy ${codex.approvalPolicy}.` : "",
    "Report useful discoveries as research_note, design_decision, tool_call, artifact, and session_result events when the harness supports structured output.",
    "Design-system and design-related work must emit changelog-ready design_decision, artifact, design_system_artifact, or file_change evidence for .memoire/project-memory/changelog.",
    `Current action: ${context.action}. Current harness: ${context.harness}. Chat mode: ${context.chatMode}. Permission mode: ${context.permissionMode}.`,
  ].filter(Boolean).join(" ");
}

export function createDesignAgentEnvelope(context: StudioAgentContext): string {
  const codex = context.harness === "codex" ? normalizedCodexConfig(context.codex) : null;
  const memoryLines = Object.entries(context.memory.counts)
    .map(([kind, count]) => `- ${KIND_LABELS[kind as ProjectMemoryKind] ?? kind}: ${count}`)
    .join("\n");
  const recent = context.memory.recent.length > 0
    ? context.memory.recent
      .slice(0, 6)
      .map((item) => `- ${item.kind}: ${item.title}${item.sourcePath ? ` (${item.sourcePath})` : ""} — ${compact(item.summary, 160)}`)
      .join("\n")
    : "- No recent memory items indexed.";
  const figma = context.figma.enabled
    ? `Figma bridge: ${context.figma.status}${context.figma.port ? ` on ${context.figma.port}` : ""} with ${context.figma.clients} client${context.figma.clients === 1 ? "" : "s"}`
    : "Figma bridge: disabled";
  const knowledgeCounts = context.knowledge
    ? Object.entries(context.knowledge.counts)
      .filter(([, count]) => typeof count === "number" && count > 0)
      .map(([kind, count]) => `${kind} ${count}`)
      .join(" / ")
    : "not indexed";
  const knowledgeRecent = context.knowledge?.recent.length
    ? context.knowledge.recent
      .slice(0, 6)
      .map((item) => `- ${item.kind}: ${item.title} (${item.sourcePath}) — ${compact(item.summary, 140)}`)
      .join("\n")
    : "- No repository knowledge items loaded yet.";
  const researchDesign = researchDesignLines(context);

  return [
    "# Mémoire Studio Agent Task",
    "",
    "## Design/research lens",
    "- Start from UX research, user experience, research evidence, information architecture, accessibility, and design-system coherence.",
    "- Treat implementation as the final handoff of a design decision, not the starting point.",
    "- Keep all component thinking in Atomic design levels: atom -> molecule -> organism -> template -> page.",
    "- Prefer existing specs, tokens, references, and Figma state before creating new abstractions.",
    "- If a workflow is learned, write it down as a durable research_note or design_decision in the final response.",
    "- End every design/build session with acceptance criteria that a product owner can verify.",
    "",
    "## Harness behavior",
    `- Harness: ${context.harness}`,
    ...(context.conversationId ? [
      `- Conversation: ${context.conversationId}`,
      `- Turn: ${(context.turnIndex ?? 0) + 1}`,
    ] : []),
    `- Action: ${context.action}`,
    `- Mode: ${context.mode}`,
    `- Chat mode: ${context.chatMode}`,
    `- Permission mode: ${context.permissionMode}`,
    ...(codex ? [
      `- Codex model: ${codex.model}`,
      `- Codex reasoning: ${codex.reasoningEffort}`,
      `- Codex approval policy: ${codex.approvalPolicy}`,
      `- Codex web search: ${codex.webSearch ? "enabled" : "disabled"}`,
    ] : []),
    `- Reference package: ${MEMOIRE_PACKAGE_NAME}@${MEMOIRE_PACKAGE_VERSION} (${MEMOIRE_PACKAGE_URL})`,
    "- In ideate and research modes, produce plans, questions, references, research evidence, and design artifacts before implementation.",
    context.permissionMode === "plan" ? "- Plan mode: stay read-only, inspect first, and return a plan with evidence, risks, commands to run, and acceptance criteria before edits." : "",
    "- In build and terminal modes, keep terminal commands, output, previews, and handoff artifacts traceable.",
    "- Use tools carefully and summarize tool calls so Studio can render them as blocks.",
    "- In full_access mode, act without extra confirmation inside configured workspaces; reserve destructive host actions for explicit user requests.",
    "- Produce a concise final session_result with artifacts, files changed, assumptions, and next design/research step.",
    "- For repo creation, scaffold the smallest coherent app/repo, document setup commands, name the design-system atoms/molecules/organisms/templates/pages, and include an acceptance_statement in the final result.",
    ...harnessSpecificGuidance(context.harness, codex),
    "",
    ...agenticDesignSystemPromptLines(),
    "",
    "## Project memory",
    memoryLines,
    "",
    "## Recent context",
    recent,
    "",
    "## Knowledge capture",
    `- Repository knowledge database: ${knowledgeCounts}`,
    "- Treat markdown and YAML files as durable design/research context. Prefer reading existing notes, specs, and references before generating new material.",
    "- When Codex, Claude, Hermes, or any harness discovers research, documentation, references, or design decisions, report them as structured research_note, design_decision, artifact, or file_change events so Studio can persist them through /api/knowledge.",
    "- Durable knowledge sources:",
    knowledgeRecent,
    "",
    "## Research-backed vibe design",
    ...researchDesign,
    "",
    "## Design changelog capture",
    "- Studio auto-captures design-system and design-related work under `.memoire/project-memory/changelog`; never write these project memory notes to repo CHANGELOG.md.",
    "- Emit design_decision for rationale, design_system_artifact or artifact for generated evidence, and file_change/tool_call entries that name changed tokens, styles, specs, Figma/plugin, component, research, or Studio UI files.",
    "- If evidence is incomplete, Studio records capture warnings rather than blocking session completion, so include enough file and event evidence to keep the changelog useful.",
    "",
    "## Figma and design system",
    `- ${figma}`,
    "- If Figma is connected, use it for selection inspection, token pulls, components, screenshots, and full sync when relevant.",
    "- If Figma is offline, continue from filesystem memory and say what could be improved after connection.",
    "",
    "## Studio event hints",
    "- research_note: evidence, user insight, assumption, source, or question worth saving.",
    "- design_decision: a product/design-system choice and why it improves the experience.",
    "- tool_call: any file, terminal, browser, Figma, or MCP action that materially changes context.",
    "- artifact: generated specs, docs, screenshots, patches, token exports, or reference pulls.",
    "",
    "## Knowledge capture",
    "- Save durable learnings through `/api/knowledge` when the harness or Studio surface exposes it.",
    "- Prefer markdown and YAML for portable memory artifacts, design decisions, runbooks, and reusable workflow notes.",
    "",
    ...(context.goal?.trim() ? [
      "## Conversation goal",
      context.goal.trim(),
      "",
    ] : []),
    "## User request",
    context.prompt.trim(),
  ].join("\n");
}

export function summarizeAgentContext(context: StudioAgentContext): {
  workspace: string;
  harness: StudioHarnessId;
  action: StudioRunAction;
  memory: string;
  figma: string;
} {
  const memory = Object.entries(context.memory.counts)
    .map(([kind, count]) => `${kind} ${count}`)
    .join(" / ");
  const figma = context.figma.enabled
    ? `${context.figma.status}${context.figma.port ? ` on ${context.figma.port}` : ""} with ${context.figma.clients} client${context.figma.clients === 1 ? "" : "s"}`
    : "disabled";

  return {
    workspace: context.workspaceLabel,
    harness: context.harness,
    action: context.action,
    memory,
    figma,
  };
}

export function basicAgentContext(input: {
  workspaceLabel?: string;
  projectRoot: string;
  action: StudioRunAction;
  harness: StudioHarnessId;
  prompt: string;
  goal?: string;
  conversationId?: string;
  turnIndex?: number;
  model?: string | null;
  effort?: string | null;
  mode?: StudioAgentContext["mode"];
  chatMode?: StudioAgentContext["chatMode"];
  permissionMode?: StudioAgentContext["permissionMode"];
  codex?: StudioCodexConfig;
}): StudioAgentContext {
  return {
    workspaceLabel: input.workspaceLabel ?? "Memoire workspace",
    projectRoot: input.projectRoot,
    conversationId: input.conversationId,
    turnIndex: input.turnIndex,
    goal: input.goal,
    model: input.model,
    effort: input.effort,
    action: input.action,
    harness: input.harness,
    mode: input.mode ?? "delegate",
    chatMode: input.chatMode ?? "ideate",
    permissionMode: input.permissionMode ?? "guarded",
    codex: input.codex ?? DEFAULT_CODEX_CONFIG,
    prompt: input.prompt,
    memory: {
      counts: { home: 0, research: 0, spec: 0, system: 0, monitor: 0, changelog: 0 },
      recent: [],
    },
    figma: {
      enabled: false,
      status: "unknown",
      clients: 0,
      port: null,
    },
    knowledge: {
      counts: {},
      recent: [],
    },
    researchDesign: {
      personas: [],
      findings: [],
      risks: [],
      metrics: [],
      latestSimulationRunId: null,
      suggestedTools: ["research.design_package", "research.generate_specs", "mermaid_jam.export"],
    },
  };
}

function compact(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}...`;
}

function researchDesignLines(context: StudioAgentContext): string[] {
  const design = context.researchDesign;
  if (!design) {
    return [
      "- Research design context was not indexed for this run.",
      "- Suggested tools: research.design_package, research.generate_specs, mermaid_jam.export",
    ];
  }
  return [
    `- Personas: ${formatContextList(design.personas, "none indexed")}`,
    `- Findings: ${formatContextList(design.findings, "none indexed")}`,
    `- Risks: ${formatContextList(design.risks, "none indexed")}`,
    `- Metrics: ${formatContextList(design.metrics, "none indexed")}`,
    `- Latest simulation run: ${design.latestSimulationRunId ?? "none"}`,
    `- Suggested tools: ${formatContextList(design.suggestedTools, "research.design_package, research.generate_specs, mermaid_jam.export")}`,
  ];
}

function formatContextList(items: string[], fallback: string): string {
  return items.length ? items.slice(0, 5).map((item) => compact(item, 96)).join(" | ") : fallback;
}

function normalizedCodexConfig(config?: StudioCodexConfig): StudioCodexConfig {
  return { ...DEFAULT_CODEX_CONFIG, ...(config ?? {}) };
}

function harnessSpecificGuidance(harness: StudioHarnessId, codex: StudioCodexConfig | null = null): string[] {
  if (harness === "codex") {
    const settings = normalizedCodexConfig(codex ?? undefined);
    return [
      "",
      "## Codex GPT-5.5 design workspace",
      "- Treat Codex as the primary GPT-5.5 app/repo builder inside Mémoire Studio.",
      "- Start with a product brief, design-system inventory, implementation plan, and acceptance criteria before editing.",
      `- Use model_reasoning_effort=${settings.reasoningEffort} for hard research, audit, and design-system synthesis; downshift only when the user asks for speed.`,
      settings.webSearch ? "- Use Codex live web search for research actions when a current external source changes the answer." : "- Do not rely on Codex live web search; use local repository memory and Mémoire research commands first.",
      "- For new app or repo creation, create the smallest useful working repository with scripts, README, tokens, component levels, and preview instructions.",
      "- When asked to accept or review work, produce a clear acceptance_statement with what passed, what remains, and exact verification commands.",
      "- Avoid spawning subagents for focused Studio runs; if delegation is necessary, do not combine a full-history fork with explicit agent_type, model, or reasoning_effort.",
      "",
      "## Codex + Mémoire command ladder",
      settings.includeCodexCommands ? "- First confirm Codex readiness with `codex login status` when auth or run ability is unclear." : "- Codex readiness checks are disabled in Studio settings; do not spend tokens on auth checks unless the run fails.",
      settings.includeMemoireCommands ? "- Start workspace inspection with `memi status --json`, then `memi suite doctor --json` when a suite manifest exists." : "- Mémoire command hints are disabled in Studio settings; rely on repository inspection and explicit user commands.",
      settings.includeMemoireCommands ? "- For research-scale work, prefer `memi research report --json` or `memi research synthesize --json` when research inputs exist." : "- When research inputs exist, summarize them directly from files instead of invoking Mémoire research commands.",
      settings.includeMemoireCommands ? "- For UI quality and shadcn/Tailwind cleanup, use `memi diagnose . --json`, token pulls, and design docs before editing." : "- For UI quality work, inspect files manually and still report research_note/design_decision sections.",
      "- Emit final sections with these exact labels when possible: research_note, design_decision, tool_call, artifact, acceptance_statement, session_result.",
    ];
  }
  if (harness !== "hermes") return [];
  return [
    "",
    "## Hermes Memoire skill activation",
    "- Prefer the `memoire-design-tooling` skill for UI design, Figma, design-system, Tailwind, shadcn/ui, research, and Atomic Design tasks.",
    "- If the skill is missing, tell the user to run `memi agent install hermes`; continue with the commands below when `memi` is already available.",
    "- Use `memi status` to inspect workspace setup, `memi compose` for design/research orchestration, and `memi diagnose .` or `memi audit` for evidence-backed UI quality work.",
    "- Treat Figma bridge state, project memory, specs, tokens, and research notes as native Hermes context before editing files.",
  ];
}
