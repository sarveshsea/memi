import { deriveDesignSystemArtifactsFromEvents } from "./design-system-artifacts.js";
import { deriveReferenceTraceFromEvents } from "./reference-trace.js";
import type { StudioReferenceTraceItem } from "./reference-trace.js";
import type { StudioDesignSystemArtifact } from "./design-system-artifact-types.js";

export const STUDIO_TRACE_PHASES = [
  { id: "research", label: "Research" },
  { id: "analyze", label: "Analyze" },
  { id: "ideate", label: "Ideate" },
  { id: "design", label: "Design" },
  { id: "spec", label: "Spec" },
  { id: "handoff", label: "Handoff" },
] as const;

export type StudioTracePhaseId = (typeof STUDIO_TRACE_PHASES)[number]["id"];
export type StudioTraceStatus = "queued" | "running" | "completed" | "failed";

export interface StudioTraceEventLike {
  id: string;
  type: string;
  message: string;
  timestamp?: string;
  data?: unknown;
}

export interface StudioTraceSessionLike {
  id: string;
  action?: string;
  status: "running" | "completed" | "failed" | "cancelled" | string;
}

export interface StudioTracePhase {
  id: StudioTracePhaseId;
  label: string;
  status: StudioTraceStatus;
  evidenceIds: string[];
}

export interface StudioTraceTask {
  id: string;
  label: string;
  status: StudioTraceStatus;
  progress: number;
  evidenceIds: string[];
}

export type StudioTraceOutputKind =
  | "chat"
  | "terminal"
  | "design"
  | "preview"
  | "research"
  | "marketplace"
  | "handoff"
  | "artifact"
  | "auth";

export interface StudioTraceOutput {
  id: string;
  kind: StudioTraceOutputKind;
  title: string;
  summary: string;
  sourcePath?: string;
  artifactPath?: string;
  url?: string;
  eventIds: string[];
}

export interface StudioTraceToolRun {
  id: string;
  tool: string;
  status: "queued" | "running" | "completed" | "failed" | "approval_required";
  summary: string;
  eventIds: string[];
}

export interface StudioTraceCitation {
  id: string;
  label: string;
  url?: string;
  sourcePath?: string;
  eventIds: string[];
}

export interface StudioTraceResearchEvidence {
  id: string;
  label: string;
  method: "qualitative" | "quantitative" | "mixed" | "netnography" | "desk";
  summary: string;
  sourcePath?: string;
  url?: string;
  tags: string[];
  eventIds: string[];
}

export type StudioActivityKind =
  | "thinking"
  | "reading_file"
  | "searching"
  | "listing"
  | "running_command"
  | "writing_file"
  | "using_tool"
  | "browser_action"
  | "figma_action"
  | "mcp_call"
  | "computer_action"
  | "terminal_group";

export interface StudioActivityItem {
  id: string;
  kind: StudioActivityKind;
  status: "running" | "completed" | "failed";
  label: string;
  summary: string;
  targetPath?: string;
  command?: string;
  sourceEventIds: string[];
  startedAt: string;
  completedAt?: string;
  outputPreview?: string;
}

export interface StudioActiveProcess {
  id: string;
  sessionId?: string;
  command: string;
  cwd?: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  outputPreview: string;
  sourceEventIds: string[];
}

export interface StudioTraceModel {
  phases: StudioTracePhase[];
  tasks: StudioTraceTask[];
  evidenceCount: number;
  activePhaseId: StudioTracePhaseId | null;
  references: StudioReferenceTraceItem[];
  outputs: StudioTraceOutput[];
  toolRuns: StudioTraceToolRun[];
  citations: StudioTraceCitation[];
  researchEvidence: StudioTraceResearchEvidence[];
  artifacts: StudioDesignSystemArtifact[];
  activities: StudioActivityItem[];
  activeProcesses: StudioActiveProcess[];
}

export interface StudioTraceSnapshot extends StudioTraceModel {
  sessionId: string | null;
  source: "live" | "persisted" | "empty";
  generatedAt: string;
  eventIds: string[];
}

const PHASE_EVENT_MAP: Record<string, StudioTracePhaseId> = {
  research_note: "research",
  research_capture: "research",
  research_code: "research",
  research_theme: "research",
  research_metric: "research",
  reasoning: "analyze",
  tool_call: "analyze",
  terminal_command: "analyze",
  terminal_output: "analyze",
  approval_request: "analyze",
  auth_state: "analyze",
  auth_status: "analyze",
  harness_log: "analyze",
  design_decision: "ideate",
  chat_message: "ideate",
  screenshot: "design",
  design_artifact: "design",
  design_system_artifact: "design",
  design_preview: "design",
  preview_ready: "design",
  figma_candidate: "design",
  video_project_created: "design",
  video_render_started: "design",
  video_render_completed: "design",
  video_render_failed: "design",
  spec_reference: "spec",
  artifact: "spec",
  file_change: "spec",
  handoff_bundle: "handoff",
  marketplace_download: "handoff",
  token_usage: "handoff",
  session_result: "handoff",
  acceptance_statement: "handoff",
};

export function deriveStudioTrace(input: {
  session: StudioTraceSessionLike | null;
  events: StudioTraceEventLike[];
}): StudioTraceModel {
  const phaseEvidence = new Map<StudioTracePhaseId, string[]>(
    STUDIO_TRACE_PHASES.map((phase) => [phase.id, []]),
  );
  let activePhaseId: StudioTracePhaseId | null = null;

  for (const event of input.events) {
    const phaseId = phaseForEvent(event);
    if (!phaseId) continue;
    phaseEvidence.get(phaseId)?.push(event.id);
    activePhaseId = phaseId;
  }

  const hasSessionError = input.events.some((event) => event.type === "session_error") || input.session?.status === "failed";
  const isRunning = input.session?.status === "running";
  const phases = STUDIO_TRACE_PHASES.map<StudioTracePhase>((phase) => {
    const evidenceIds = phaseEvidence.get(phase.id) ?? [];
    return {
      id: phase.id,
      label: phase.label,
      status: derivePhaseStatus({
        evidenceIds,
        phaseId: phase.id,
        activePhaseId,
        isRunning,
        hasSessionError,
      }),
      evidenceIds,
    };
  });

  return {
    phases,
    tasks: deriveTraceTasks({ phases, events: input.events, action: input.session?.action ?? null, hasSessionError }),
    evidenceCount: Array.from(phaseEvidence.values()).reduce((count, ids) => count + ids.length, 0),
    activePhaseId,
    references: deriveReferenceTraceFromEvents(input.events),
    outputs: deriveTraceOutputs(input.events),
    toolRuns: deriveTraceToolRuns(input.events),
    citations: deriveTraceCitations(input.events),
    researchEvidence: deriveTraceResearchEvidence(input.events),
    artifacts: deriveDesignSystemArtifactsFromEvents({
      session: input.session,
      events: input.events,
    }),
    activities: deriveActivities(input.events),
    activeProcesses: deriveActiveProcesses(input.events, input.session),
  };
}

export function createStudioTraceSnapshot(input: {
  session: StudioTraceSessionLike | null;
  events: StudioTraceEventLike[];
  source: "live" | "persisted" | "empty";
  now?: string;
}): StudioTraceSnapshot {
  return {
    ...deriveStudioTrace({ session: input.session, events: input.events }),
    sessionId: input.session?.id ?? null,
    source: input.source,
    generatedAt: input.now ?? new Date().toISOString(),
    eventIds: input.events.map((event) => event.id),
  };
}

function deriveTraceOutputs(events: StudioTraceEventLike[]): StudioTraceOutput[] {
  const outputs: StudioTraceOutput[] = [];
  for (const event of events) {
    const kind = outputKindForEvent(event);
    if (!kind) continue;
    const data = asRecord(event.data);
    const artifactTitle = (event.type === "artifact" || event.type === "design_system_artifact") ? artifactTitleForMessage(event.message) : null;
    outputs.push({
      id: `output:${event.id}`,
      kind,
      title: pickString(data, ["title", "label", "name"]) ?? artifactTitle ?? outputTitleForEvent(event),
      summary: pickString(data, ["summary", "description", "result"]) ?? event.message,
      sourcePath: pickString(data, ["sourcePath", "path", "filePath"]),
      artifactPath: pickString(data, ["artifactPath"]),
      url: pickString(data, ["url", "previewUrl", "href"]),
      eventIds: [event.id],
    });
  }
  return outputs;
}

function artifactTitleForMessage(message: string): string | null {
  const first = message.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  if (!first) return null;
  const title = first.replace(/^[-*#\s]+/, "").replace(/^artifact\s*:\s*/i, "").replace(/:$/, "").trim();
  return /\b(design|system|artifact|pull|audit|review)\b/i.test(title) ? title : null;
}

function deriveTraceToolRuns(events: StudioTraceEventLike[]): StudioTraceToolRun[] {
  const runs = new Map<string, StudioTraceToolRun>();
  for (const event of events) {
    if (!isTraceToolEvent(event)) continue;
    const data = asRecord(event.data);
    const key = traceToolKey(event) ?? event.id;
    const id = `tool:${key}`;
    const status = toolStatusForEvent(event);
    const existing = runs.get(id);
    if (existing) {
      existing.eventIds.push(event.id);
      existing.status = mergeTraceToolStatus(existing.status, status);
      if (existing.tool === "tool_call" || existing.tool === "tool_result" || existing.tool === event.type) {
        existing.tool = traceToolLabel(event, data);
      }
      if (event.type === "tool_result" || event.type === "terminal_output" || event.type === "approval_resolved") {
        existing.summary = traceToolSummary(event, data);
      }
      continue;
    }
    runs.set(id, {
      id,
      tool: traceToolLabel(event, data),
      status,
      summary: traceToolSummary(event, data),
      eventIds: [event.id],
    });
  }
  return Array.from(runs.values());
}

function deriveTraceCitations(events: StudioTraceEventLike[]): StudioTraceCitation[] {
  const citations = new Map<string, StudioTraceCitation>();
  for (const event of events) {
    const data = asRecord(event.data);
    const candidates = [
      ...arrayOfRecords(data.citations),
      ...arrayOfRecords(data.sources),
      ...arrayOfRecords(data.references),
    ];
    for (const candidate of candidates) {
      const url = pickString(candidate, ["url", "href", "sourceUrl"]);
      const sourcePath = pickString(candidate, ["sourcePath", "path"]);
      const label = pickString(candidate, ["label", "title", "name"]) ?? url ?? sourcePath;
      if (!label) continue;
      const id = `citation:${url ?? sourcePath ?? label}`;
      const existing = citations.get(id);
      if (existing) {
        existing.eventIds.push(event.id);
        continue;
      }
      citations.set(id, { id, label, url, sourcePath, eventIds: [event.id] });
    }
  }
  return Array.from(citations.values());
}

function deriveTraceResearchEvidence(events: StudioTraceEventLike[]): StudioTraceResearchEvidence[] {
  return events
    .filter((event) => /^research_/.test(event.type) || event.type === "research_note")
    .map((event) => {
      const data = asRecord(event.data);
      return {
        id: `research:${event.id}`,
        label: pickString(data, ["label", "title", "name"]) ?? outputTitleForEvent(event),
        method: researchMethodFrom(data, event),
        summary: pickString(data, ["summary", "finding", "observation", "result"]) ?? event.message,
        sourcePath: pickString(data, ["sourcePath", "path"]),
        url: pickString(data, ["url", "sourceUrl"]),
        tags: arrayOfStrings(data.tags),
        eventIds: [event.id],
      };
    });
}

function deriveActivities(events: StudioTraceEventLike[]): StudioActivityItem[] {
  const activities: StudioActivityItem[] = [];
  const latestTerminalCommandIndex = latestTerminalCommandIndexes(events);
  const terminalOutputByExecutionId = terminalOutputsByExecutionId(events);
  const toolResultByKey = latestEventsByTraceKey(events, new Set(["tool_result"]));
  const approvalResolutionByKey = latestEventsByTraceKey(events, new Set(["approval_resolved"]));
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.type === "reasoning") {
      activities.push(activityFromParts({
        event,
        kind: "thinking",
        status: "completed",
        label: "Thinking",
        summary: event.message,
      }));
      continue;
    }
    if (event.type === "tool_call") {
      const key = traceToolKey(event);
      activities.push(activityFromToolCall(event, key ? toolResultByKey.get(key) ?? null : null));
      continue;
    }
    if (event.type === "approval_request") {
      const key = traceToolKey(event);
      activities.push(activityFromApproval(event, key ? approvalResolutionByKey.get(key) ?? null : null));
      continue;
    }
    if (event.type === "browser_snapshot") {
      activities.push(activityFromParts({
        event,
        kind: "browser_action",
        status: toolStatusForEvent(event) === "failed" ? "failed" : "completed",
        label: "Browser",
        summary: pickString(asRecord(event.data), ["url", "href", "summary"]) ?? event.message,
      }));
      continue;
    }
    if (event.type === "mcp_call") {
      const data = asRecord(event.data);
      const tool = pickString(data, ["tool", "toolId", "name"]) ?? event.message;
      activities.push(activityFromParts({
        event,
        kind: "mcp_call",
        status: toolStatusForEvent(event) === "failed" ? "failed" : "completed",
        label: `MCP ${tool}`,
        summary: event.message,
      }));
      continue;
    }
    if (event.type === "figma_action_started" || event.type === "figma_action_completed" || event.type === "figma_action_failed") {
      const data = asRecord(event.data);
      const action = pickString(data, ["action", "tool", "name"]) ?? "action";
      activities.push(activityFromParts({
        event,
        kind: "figma_action",
        status: event.type === "figma_action_failed" ? "failed" : event.type === "figma_action_started" ? "running" : "completed",
        label: `Figma ${action}`,
        summary: event.message,
      }));
      continue;
    }
    if (event.type === "computer_action_started" || event.type === "computer_action_completed" || event.type === "computer_action_failed") {
      activities.push(activityFromParts({
        event,
        kind: "computer_action",
        status: event.type === "computer_action_failed" ? "failed" : event.type === "computer_action_started" ? "running" : "completed",
        label: computerActivityLabel(event),
        summary: event.message,
      }));
      continue;
    }
    if (event.type !== "terminal_command") continue;
    const executionId = terminalExecutionId(event);
    if (executionId && latestTerminalCommandIndex.get(executionId) !== index) continue;
    const next = events[index + 1];
    const pairedOutput = executionId
      ? terminalOutputByExecutionId.get(executionId) ?? (next?.type === "terminal_output" ? next : null)
      : next?.type === "terminal_output" ? next : null;
    activities.push(activityFromTerminalCommand(event, pairedOutput));
    if (pairedOutput && pairedOutput === next) index += 1;
  }
  if (activities.length === 0) {
    const outputEvent = events.find((event) => (
      event.type === "session_result"
      || event.type === "artifact"
      || event.type === "design_decision"
      || event.type === "research_note"
      || event.type === "acceptance_statement"
    ));
    if (outputEvent) {
      activities.push(activityFromParts({
        event: outputEvent,
        kind: "thinking",
        status: "completed",
        label: "Summarized result",
        summary: firstOutputLine(outputEvent.message) || "Model returned a final result without tool calls.",
        outputPreview: firstOutputLine(outputEvent.message),
      }));
    }
  }

  return activities;
}

function deriveActiveProcesses(
  events: StudioTraceEventLike[],
  session: StudioTraceSessionLike | null,
): StudioActiveProcess[] {
  if (!session || session.status !== "running") return [];
  return deriveActivities(events)
    .filter((activity) => activity.status === "running" && activity.command)
    .map((activity) => ({
      id: `process:${activity.sourceEventIds[0]}`,
      sessionId: session?.id,
      command: activity.command ?? activity.summary,
      status: activity.status,
      startedAt: activity.startedAt,
      outputPreview: activity.outputPreview ?? "",
      sourceEventIds: activity.sourceEventIds,
    }));
}

function activityFromTerminalCommand(
  event: StudioTraceEventLike,
  outputEvent: StudioTraceEventLike | null,
): StudioActivityItem {
  const data = asRecord(outputEvent?.data ?? event.data);
  const rawCommand = pickString(data, ["command"]) ?? event.message;
  const command = unwrapShellCommand(rawCommand);
  const inferred = inferCommandActivity(command);
  const status = commandActivityStatus(data, outputEvent);
  return activityFromParts({
    event,
    kind: inferred.kind,
    status,
    label: inferred.label,
    summary: inferred.summary ?? command,
    targetPath: inferred.targetPath,
    command: rawCommand,
    sourceEventIds: outputEvent ? [event.id, outputEvent.id] : [event.id],
    completedAt: status === "running" ? undefined : outputEvent?.timestamp ?? event.timestamp,
    outputPreview: outputEvent ? firstOutputLine(outputEvent.message) : firstOutputLine(pickString(data, ["aggregated_output", "output"]) ?? ""),
  });
}

function latestTerminalCommandIndexes(events: StudioTraceEventLike[]): Map<string, number> {
  const latest = new Map<string, number>();
  events.forEach((event, index) => {
    if (event.type !== "terminal_command") return;
    const executionId = terminalExecutionId(event);
    if (!executionId) return;
    latest.set(executionId, index);
  });
  return latest;
}

function terminalExecutionId(event: StudioTraceEventLike): string | null {
  const data = asRecord(event.data);
  return pickString(data, ["id", "executionId", "itemId", "callId", "call_id"]) ?? null;
}

function terminalOutputsByExecutionId(events: StudioTraceEventLike[]): Map<string, StudioTraceEventLike> {
  const outputs = new Map<string, StudioTraceEventLike>();
  for (const event of events) {
    if (event.type !== "terminal_output") continue;
    const executionId = terminalExecutionId(event);
    if (executionId) outputs.set(executionId, event);
  }
  return outputs;
}

function latestEventsByTraceKey(events: StudioTraceEventLike[], types: Set<string>): Map<string, StudioTraceEventLike> {
  const matches = new Map<string, StudioTraceEventLike>();
  for (const event of events) {
    if (!types.has(event.type)) continue;
    const key = traceToolKey(event);
    if (key) matches.set(key, event);
  }
  return matches;
}

function activityFromToolCall(event: StudioTraceEventLike, result: StudioTraceEventLike | null = null): StudioActivityItem {
  const data = asRecord(event.data);
  const input = asRecord(data.input);
  const name = pickString(data, ["name", "tool", "toolId"]) ?? event.message;
  const normalized = name.toLowerCase();
  const filePath = pickString(input, ["file_path", "path", "sourcePath", "filePath"]);
  const pattern = pickString(input, ["pattern", "query"]);
  const resultStatus = result ? activityStatusFromToolResult(result) : "running";
  const sourceEventIds = result ? [event.id, result.id] : [event.id];
  const outputPreview = result ? firstOutputLine(result.message) : undefined;
  const completedAt = resultStatus === "running" ? undefined : result?.timestamp;
  if (normalized === "read" && filePath) {
    return activityFromParts({
      event,
      kind: "reading_file",
      status: resultStatus,
      label: `Reading ${basename(filePath)}`,
      summary: `Read ${filePath}`,
      targetPath: filePath,
      sourceEventIds,
      completedAt,
      outputPreview,
    });
  }
  if ((normalized === "grep" || normalized === "glob") && (filePath || pattern)) {
    const target = filePath ?? "workspace";
    return activityFromParts({
      event,
      kind: "searching",
      status: resultStatus,
      label: `Searching ${target}`,
      summary: `${name}${pattern ? ` ${pattern}` : ""}${filePath ? ` in ${filePath}` : ""}`.trim(),
      targetPath: filePath,
      sourceEventIds,
      completedAt,
      outputPreview,
    });
  }
  if (/^(edit|write|multiedit)$/i.test(name) && filePath) {
    return activityFromParts({
      event,
      kind: "writing_file",
      status: resultStatus,
      label: `Writing ${basename(filePath)}`,
      summary: `${name} ${filePath}`,
      targetPath: filePath,
      sourceEventIds,
      completedAt,
      outputPreview,
    });
  }
  if (/^(bash|shell|terminal)$/i.test(name)) {
    const command = pickString(input, ["command", "cmd"]) ?? event.message;
    const inferred = inferCommandActivity(command);
    return activityFromParts({
      event,
      kind: inferred.kind,
      status: resultStatus,
      label: inferred.label,
      summary: inferred.summary ?? command,
      targetPath: inferred.targetPath,
      command,
      sourceEventIds,
      completedAt,
      outputPreview,
    });
  }
  return activityFromParts({
    event,
    kind: "using_tool",
    status: resultStatus,
    label: name,
    summary: event.message,
    sourceEventIds,
    completedAt,
    outputPreview,
  });
}

function activityFromApproval(event: StudioTraceEventLike, resolution: StudioTraceEventLike | null): StudioActivityItem {
  const data = asRecord(event.data);
  const tool = pickString(data, ["tool", "toolId", "name", "command", "action"]) ?? "tool";
  const status = resolution ? activityStatusFromToolResult(resolution) : "running";
  return activityFromParts({
    event,
    kind: "using_tool",
    status,
    label: `Approve ${tool}`,
    summary: resolution?.message ?? event.message,
    sourceEventIds: resolution ? [event.id, resolution.id] : [event.id],
    completedAt: resolution && status !== "running" ? resolution.timestamp : undefined,
  });
}

function activityStatusFromToolResult(event: StudioTraceEventLike): StudioActivityItem["status"] {
  const status = toolStatusForEvent(event);
  if (status === "failed") return "failed";
  if (status === "running" || status === "approval_required" || status === "queued") return "running";
  return "completed";
}

function activityFromParts(input: {
  event: StudioTraceEventLike;
  kind: StudioActivityKind;
  status: StudioActivityItem["status"];
  label: string;
  summary: string;
  targetPath?: string;
  command?: string;
  sourceEventIds?: string[];
  completedAt?: string;
  outputPreview?: string;
}): StudioActivityItem {
  return {
    id: `activity:${input.sourceEventIds?.[0] ?? input.event.id}`,
    kind: input.kind,
    status: input.status,
    label: input.label,
    summary: input.summary,
    ...(input.targetPath ? { targetPath: input.targetPath } : {}),
    ...(input.command ? { command: input.command } : {}),
    sourceEventIds: input.sourceEventIds ?? [input.event.id],
    startedAt: input.event.timestamp ?? "",
    ...(input.completedAt ? { completedAt: input.completedAt } : {}),
    ...(input.outputPreview !== undefined ? { outputPreview: input.outputPreview } : {}),
  };
}

function inferCommandActivity(command: string): Pick<StudioActivityItem, "kind" | "label" | "summary" | "targetPath"> {
  const tokens = shellTokens(command);
  const first = tokens[0] ?? "";
  const firstCommand = basename(first);
  if (firstCommand === "rg") {
    const target = searchTarget(tokens);
    return {
      kind: "searching",
      label: `Searching ${target}`,
      summary: command,
      targetPath: target === "workspace" ? undefined : target,
    };
  }
  if (firstCommand === "find") {
    const target = tokens.find((token, index) => index > 0 && !token.startsWith("-")) ?? "workspace";
    return { kind: "searching", label: `Searching ${target}`, summary: command, targetPath: target };
  }
  if (firstCommand === "ls" || firstCommand === "tree") {
    const target = commandTarget(tokens) ?? "workspace";
    return { kind: "listing", label: `Listing ${target}`, summary: command, targetPath: target === "workspace" ? undefined : target };
  }
  const readTarget = readCommandTarget(command, tokens, firstCommand);
  if (readTarget) {
    return {
      kind: "reading_file",
      label: `Reading ${basename(readTarget)}`,
      summary: command,
      targetPath: readTarget,
    };
  }
  return { kind: "running_command", label: `Running ${firstCommand || "command"}`, summary: command };
}

function commandActivityStatus(data: Record<string, unknown>, outputEvent: StudioTraceEventLike | null): StudioActivityItem["status"] {
  const status = pickString(data, ["status"])?.toLowerCase() ?? "";
  if (/in[_ -]?progress|running|started/.test(status)) return "running";
  const exitCode = data.exit_code;
  if (typeof exitCode === "number" && exitCode !== 0) return "failed";
  if (/failed|error/.test(status)) return "failed";
  if (!outputEvent && status && !/completed|success/.test(status)) return "running";
  return "completed";
}

function unwrapShellCommand(command: string): string {
  const match = command.match(/\s-lc\s+(['"])([\s\S]*)\1\s*$/);
  if (!match) return command.trim();
  return match[2].trim();
}

function shellTokens(command: string): string[] {
  const firstPipeline = command.split("|", 1)[0] ?? command;
  const tokens: string[] = [];
  const pattern = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(firstPipeline)) !== null) {
    tokens.push((match[1] ?? match[2] ?? match[3] ?? "").replace(/\\(["'])/g, "$1"));
  }
  return tokens;
}

function searchTarget(tokens: string[]): string {
  const candidates = tokens.slice(1).filter((token) => !token.startsWith("-"));
  if (candidates.length <= 1) return "workspace";
  return candidates.at(-1) ?? "workspace";
}

function commandTarget(tokens: string[]): string | null {
  return tokens.slice(1).reverse().find((token) => !token.startsWith("-")) ?? null;
}

function readCommandTarget(command: string, tokens: string[], firstCommand: string): string | null {
  if (firstCommand === "cat" || firstCommand === "nl" || firstCommand === "head" || firstCommand === "tail") {
    return commandTarget(tokens);
  }
  if (firstCommand === "sed") {
    return commandTarget(tokens);
  }
  const pipelineRead = command.match(/\b(?:cat|nl|head|tail)\b(?:\s+-\S+)*\s+([^\s|;&]+)/);
  return pipelineRead?.[1] ?? null;
}

function computerActivityLabel(event: StudioTraceEventLike): string {
  const data = asRecord(event.data);
  const action = pickString(data, ["action"]) ?? "computer";
  if (event.type === "computer_action_started") return `Computer ${action}`;
  if (event.type === "computer_action_failed") return `Computer ${action}`;
  return `Computer ${action}`;
}

function firstOutputLine(value: string): string {
  return value.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
}

function phaseForEvent(event: StudioTraceEventLike): StudioTracePhaseId | null {
  if (event.type === "reference_trace") return null;
  if (PHASE_EVENT_MAP[event.type]) return PHASE_EVENT_MAP[event.type];
  const normalized = `${event.type} ${event.message}`.toLowerCase();
  if (/\bresearch|insight|persona|source\b/.test(normalized)) return "research";
  if (/\banaly[sz]e|audit|inspect|read|scan\b/.test(normalized)) return "analyze";
  if (/\bideate|decision|direction|concept\b/.test(normalized)) return "ideate";
  if (/\bdesign|screen|preview|screenshot|figma\b/.test(normalized)) return "design";
  if (/\bspec|component|token|style|file\b/.test(normalized)) return "spec";
  if (/\bhandoff|result|export|patch\b/.test(normalized)) return "handoff";
  return null;
}

function outputKindForEvent(event: StudioTraceEventLike): StudioTraceOutputKind | null {
  if (event.type === "chat_message") return "chat";
  if (event.type === "terminal_command" || event.type === "terminal_output" || event.type === "stdout" || event.type === "stderr") return "terminal";
  if (event.type === "design_artifact" || event.type === "design_preview" || event.type === "figma_candidate") return "design";
  if (event.type === "design_system_artifact") return "artifact";
  if (event.type === "preview_ready" || event.type === "screenshot" || event.type === "browser_snapshot") return "preview";
  if (/^research_/.test(event.type) || event.type === "research_note") return "research";
  if (event.type === "marketplace_download") return "marketplace";
  if (event.type === "handoff_bundle" || event.type === "session_result" || event.type === "acceptance_statement") return "handoff";
  if (event.type === "artifact" || event.type === "file_change" || event.type === "spec_reference") return "artifact";
  if (event.type === "auth_state" || event.type === "auth_status") return "auth";
  return null;
}

function outputTitleForEvent(event: StudioTraceEventLike): string {
  return event.type
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function isTraceToolEvent(event: StudioTraceEventLike): boolean {
  return [
    "tool_call",
    "tool_result",
    "terminal_command",
    "terminal_output",
    "browser_snapshot",
    "mcp_call",
    "approval_request",
    "approval_resolved",
    "figma_action_started",
    "figma_action_completed",
    "figma_action_failed",
  ].includes(event.type);
}

function traceToolKey(event: StudioTraceEventLike): string | null {
  if (event.type === "terminal_command" || event.type === "terminal_output") return terminalExecutionId(event);
  const data = asRecord(event.data);
  return pickString(data, [
    "id",
    "callId",
    "call_id",
    "toolCallId",
    "tool_call_id",
    "toolUseId",
    "tool_use_id",
    "executionId",
    "itemId",
  ]) ?? null;
}

function traceToolLabel(event: StudioTraceEventLike, data: Record<string, unknown>): string {
  return pickString(data, ["name", "tool", "toolId", "command", "action"]) ?? event.type;
}

function traceToolSummary(event: StudioTraceEventLike, data: Record<string, unknown>): string {
  return pickString(data, ["summary", "description", "result", "output", "aggregated_output"]) ?? event.message;
}

function mergeTraceToolStatus(
  current: StudioTraceToolRun["status"],
  next: StudioTraceToolRun["status"],
): StudioTraceToolRun["status"] {
  if (next === "failed" || current === "failed") return "failed";
  if (next === "completed") return "completed";
  if (current === "completed") return "completed";
  if (next === "approval_required" || current === "approval_required") return "approval_required";
  if (next === "running" || current === "running") return "running";
  return next;
}

function toolStatusForEvent(event: StudioTraceEventLike): StudioTraceToolRun["status"] {
  const data = asRecord(event.data);
  const status = pickString(data, ["status", "state"])?.toLowerCase() ?? "";
  if (event.type === "approval_request") return "approval_required";
  if (event.type === "approval_resolved") {
    if (/reject|denied|cancel|fail|error/.test(status) || /reject|denied|cancel|fail|error/i.test(event.message)) return "failed";
    return "completed";
  }
  if (event.type === "terminal_command" || event.type === "tool_call") {
    if (/completed|success|done/.test(status)) return "completed";
    if (/failed|error/.test(status)) return "failed";
    return "running";
  }
  const exitCode = data.exit_code;
  if (typeof exitCode === "number" && exitCode !== 0) return "failed";
  if (/failed|error|reject|denied|cancel/.test(status)) return "failed";
  if (/failed|error/i.test(event.message)) return "failed";
  return "completed";
}

function researchMethodFrom(data: Record<string, unknown>, event: StudioTraceEventLike): StudioTraceResearchEvidence["method"] {
  const value = pickString(data, ["method", "sourceKind", "kind"])?.toLowerCase();
  if (value === "quantitative" || event.type === "research_metric") return "quantitative";
  if (value === "mixed") return "mixed";
  if (value === "netnography" || /netnograph|social|community/i.test(event.message)) return "netnography";
  if (value === "desk" || /web|source|document/i.test(event.message)) return "desk";
  return "qualitative";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function pickString(value: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return undefined;
}

function basename(path: string): string {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).at(-1) ?? path;
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function derivePhaseStatus(input: {
  phaseId: StudioTracePhaseId;
  activePhaseId: StudioTracePhaseId | null;
  evidenceIds: string[];
  isRunning: boolean;
  hasSessionError: boolean;
}): StudioTraceStatus {
  if (input.evidenceIds.length === 0) return "queued";
  if (input.hasSessionError && input.activePhaseId === input.phaseId) return "failed";
  if (input.isRunning && input.activePhaseId === input.phaseId) return "running";
  return "completed";
}

function deriveTraceTasks(input: {
  phases: StudioTracePhase[];
  events: StudioTraceEventLike[];
  action: string | null;
  hasSessionError: boolean;
}): StudioTraceTask[] {
  const phase = (id: StudioTracePhaseId) => input.phases.find((candidate) => candidate.id === id);
  return [
    makeTask("design-exploration", "Design exploration", phase("design") ?? null),
    makeTask("component-suggestions", "Component suggestions", phase("spec") ?? null, (event) => /component|spec|file_change|artifact/i.test(`${event.type} ${event.message}`)),
    makeTask("token-alignment", "Token alignment", phase("handoff") ?? null, (event) => /token/i.test(`${event.type} ${event.message}`)),
    makeTask("accessibility-audit", "Accessibility audit", phase("analyze") ?? null, (event) => /accessibility|audit|wcag/i.test(`${input.action ?? ""} ${event.type} ${event.message}`), input.hasSessionError),
    makeTask("specs-handoff", "Specs & handoff prep", phase("spec") ?? null, (event) => /spec|handoff|result|artifact|file_change/i.test(`${event.type} ${event.message}`)),
  ].map((task) => withEventEvidence(task, input.events));
}

function makeTask(
  id: string,
  label: string,
  phase: StudioTracePhase | null,
  predicate?: (event: StudioTraceEventLike) => boolean,
  failWithPhase = false,
): StudioTraceTask & { predicate?: (event: StudioTraceEventLike) => boolean; failWithPhase?: boolean } {
  const status = failWithPhase && phase?.status === "failed" ? "failed" : phase?.status ?? "queued";
  return {
    id,
    label,
    status,
    progress: progressForStatus(status),
    evidenceIds: phase?.evidenceIds ?? [],
    predicate,
    failWithPhase,
  };
}

function withEventEvidence(
  task: StudioTraceTask & { predicate?: (event: StudioTraceEventLike) => boolean },
  events: StudioTraceEventLike[],
): StudioTraceTask {
  if (task.predicate) {
    const matchingIds = new Set(events.filter(task.predicate).map((event) => event.id));
    const evidenceIds = task.evidenceIds.filter((id) => matchingIds.has(id));
    const status = evidenceIds.length > 0 ? task.status : "queued";
    return {
      id: task.id,
      label: task.label,
      status,
      progress: progressForStatus(status),
      evidenceIds,
    };
  }
  return {
    id: task.id,
    label: task.label,
    status: task.status,
    progress: task.progress,
    evidenceIds: task.predicate ? task.evidenceIds.filter((id) => id) : task.evidenceIds,
  };
}

function progressForStatus(status: StudioTraceStatus): number {
  if (status === "completed") return 100;
  if (status === "running") return 72;
  return 0;
}
