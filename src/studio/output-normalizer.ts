import type { StudioEventType, StudioOutputParser } from "./types.js";

export interface StudioNormalizedOutputEvent {
  type: StudioEventType;
  message: string;
  data?: unknown;
}

export interface StudioOutputNormalizerState {
  parser: StudioOutputParser;
  stdoutBuffer: string;
}

const STRUCTURED_EVENT_TYPES = new Set<StudioEventType>([
  "chat_message",
  "package_log",
  "harness_log",
  "auth_status",
  "auth_state",
  "terminal_command",
  "terminal_output",
  "tool_call",
  "tool_result",
  "approval_request",
  "approval_resolved",
  "artifact",
  "design_system_artifact",
  "file_change",
  "screenshot",
  "browser_snapshot",
  "mcp_call",
  "design_artifact",
  "design_preview",
  "preview_ready",
  "figma_candidate",
  "spec_reference",
  "handoff_bundle",
  "research_capture",
  "research_code",
  "research_theme",
  "research_metric",
  "research_note",
  "design_decision",
  "acceptance_statement",
  "marketplace_download",
  "token_usage",
  "session_result",
  "video_project_created",
  "video_render_started",
  "video_render_completed",
  "video_render_failed",
]);

export function createStudioOutputNormalizer(parser: StudioOutputParser): StudioOutputNormalizerState {
  return { parser, stdoutBuffer: "" };
}

export function normalizeStudioOutputChunk(
  state: StudioOutputNormalizerState,
  stream: "stdout" | "stderr",
  chunk: string,
): StudioNormalizedOutputEvent[] {
  if (stream === "stderr") {
    const message = stripKnownStderrNoise(state.parser, chunk);
    return message.trim() ? [{ type: "stderr", message }] : [];
  }
  if (state.parser === "hermes-text") {
    state.stdoutBuffer += chunk;
    return [];
  }
  if (state.parser !== "memoire-jsonl" && state.parser !== "claude-stream-json" && state.parser !== "codex-jsonl") {
    return chunk ? [{ type: "stdout", message: chunk }] : [];
  }

  state.stdoutBuffer += chunk;
  return drainStructuredBuffer(state, false);
}

function stripKnownStderrNoise(parser: StudioOutputParser, chunk: string): string {
  if (parser !== "codex-jsonl") return chunk;
  return chunk
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "Reading additional input from stdin...")
    .join("\n");
}

export function flushStudioOutputNormalizer(state: StudioOutputNormalizerState): StudioNormalizedOutputEvent[] {
  if (!state.stdoutBuffer.trim()) {
    state.stdoutBuffer = "";
    return [];
  }
  if (state.parser === "hermes-text") {
    const message = state.stdoutBuffer.trim();
    state.stdoutBuffer = "";
    return message ? eventsFromModelTextResult(message, { result: message, parser: "hermes-text" }) : [];
  }
  if (state.parser !== "memoire-jsonl" && state.parser !== "claude-stream-json" && state.parser !== "codex-jsonl") {
    const message = state.stdoutBuffer;
    state.stdoutBuffer = "";
    return [{ type: "stdout", message }];
  }
  return drainStructuredBuffer(state, true);
}

function drainStructuredBuffer(state: StudioOutputNormalizerState, force: boolean): StudioNormalizedOutputEvent[] {
  const raw = state.stdoutBuffer;
  const trimmed = raw.trim();
  if (!trimmed) {
    state.stdoutBuffer = "";
    return [];
  }

  const parsedWhole = parseJSON(trimmed);
  if (parsedWhole && state.parser === "memoire-jsonl") {
    state.stdoutBuffer = "";
    return [eventFromParsedMemoirePayload(parsedWhole)];
  }

  const lineEvents = parseCompleteJSONLines(raw, (parsed) => eventsFromParsedPayload(state.parser, parsed));
  if (lineEvents.events.length > 0) {
    state.stdoutBuffer = lineEvents.remainder;
    return lineEvents.events;
  }

  if (looksLikePendingJSON(trimmed) && !force) return [];

  state.stdoutBuffer = "";
  return [{ type: "stdout", message: raw }];
}

function parseCompleteJSONLines(
  raw: string,
  mapParsed: (parsed: unknown) => StudioNormalizedOutputEvent[],
): { events: StudioNormalizedOutputEvent[]; remainder: string } {
  const lines = raw.split(/\r?\n/);
  const hasTrailingNewline = /\r?\n$/.test(raw);
  const completeLines = hasTrailingNewline ? lines.filter((line) => line.length > 0) : lines.slice(0, -1);
  const remainder = hasTrailingNewline ? "" : (lines.at(-1) ?? "");
  const events: StudioNormalizedOutputEvent[] = [];

  for (const line of completeLines) {
    const parsed = parseJSON(line.trim());
    if (!parsed) return { events: [], remainder: raw };
    events.push(...mapParsed(parsed));
  }
  return { events, remainder };
}

function eventsFromParsedPayload(parser: StudioOutputParser, parsed: unknown): StudioNormalizedOutputEvent[] {
  if (parser === "claude-stream-json") return eventsFromClaudePayload(parsed);
  if (parser === "codex-jsonl") return eventsFromCodexPayload(parsed);
  return [eventFromParsedMemoirePayload(parsed)];
}

function eventFromParsedMemoirePayload(parsed: unknown): StudioNormalizedOutputEvent {
  if (isRecord(parsed) && typeof parsed.type === "string" && STRUCTURED_EVENT_TYPES.has(parsed.type as StudioEventType)) {
    return {
      type: parsed.type as StudioEventType,
      message: stringField(parsed.message) ?? stringField(parsed.path) ?? parsed.type,
      data: isRecord(parsed.data) ? parsed.data : parsed,
    };
  }

  return {
    type: "session_result",
    message: summarizeMemoireResult(parsed),
    data: parsed,
  };
}

function eventsFromClaudePayload(parsed: unknown): StudioNormalizedOutputEvent[] {
  if (!isRecord(parsed)) return [{ type: "stdout", message: JSON.stringify(parsed) }];
  const type = stringField(parsed.type);
  if (type === "tool_result") return [eventFromClaudeToolResult(parsed)];
  const structured = structuredEventFromPayload(parsed, type);
  if (structured) return [structured];
  if (type === "assistant") {
    const message = isRecord(parsed.message) ? parsed.message : parsed;
    const content = Array.isArray(message.content) ? message.content : [];
    const events: StudioNormalizedOutputEvent[] = [];
    for (const part of content) {
      if (!isRecord(part)) continue;
      if (part.type === "text" && typeof part.text === "string" && part.text.trim()) {
        events.push({ type: "reasoning", message: part.text, data: part });
      }
      if (part.type === "tool_use") {
        const name = stringField(part.name) ?? "tool";
        events.push({ type: "tool_call", message: name, data: part });
      }
      if (part.type === "tool_result") {
        events.push(eventFromClaudeToolResult(part));
      }
    }
    return events.length > 0 ? events : [{ type: "stdout", message: JSON.stringify(parsed) }];
  }
  if (type === "user") {
    const message = isRecord(parsed.message) ? parsed.message : parsed;
    const content = Array.isArray(message.content) ? message.content : [];
    const events = content
      .filter((part): part is Record<string, unknown> => isRecord(part) && part.type === "tool_result")
      .map((part) => eventFromClaudeToolResult(part));
    return events.length > 0 ? events : [];
  }
  if (type === "result") {
    const result = stringField(parsed.result) ?? stringField(parsed.message) ?? "Claude result";
    return eventsFromModelTextResult(result, parsed, stringField(parsed.id));
  }
  if (type === "tool_use") {
    const name = stringField(parsed.name) ?? "tool";
    return [{ type: "tool_call", message: name, data: parsed }];
  }
  if (type === "error") {
    return [{ type: "session_error", message: stringField(parsed.message) ?? "Claude error", data: parsed }];
  }
  return [];
}

function eventsFromCodexPayload(parsed: unknown): StudioNormalizedOutputEvent[] {
  if (!isRecord(parsed)) return [{ type: "stdout", message: JSON.stringify(parsed) }];
  const type = stringField(parsed.type);
  if (type === "tool_result" || type === "function_call_output" || type === "function_call_result") return [eventFromCodexToolResult(parsed)];
  const structured = structuredEventFromPayload(parsed, type);
  if (structured) return [structured];
  const item = isRecord(parsed.item) ? parsed.item : null;

  if (item && (item.type === "function_call" || item.type === "tool_call")) {
    const name = stringField(item.name) ?? stringField(item.tool_name) ?? "tool";
    return [{ type: "tool_call", message: name, data: item }];
  }

  if (item && (item.type === "function_call_output" || item.type === "tool_result" || item.type === "function_call_result")) {
    return [eventFromCodexToolResult(item)];
  }

  if (item && item.type === "command_execution") {
    return eventsFromCodexCommandExecution(item);
  }

  if (item && (item.type === "agent_message" || item.type === "message")) {
    const message = extractCodexItemText(item);
    return message ? eventsFromModelTextResult(message, parsed, stringField(item.id) ?? stringField(parsed.id)) : [];
  }

  if (type === "agent_message" || type === "message") {
    const message = stringField(parsed.message) ?? stringField(parsed.text) ?? extractCodexItemText(item) ?? "Codex result";
    return eventsFromModelTextResult(message, parsed, stringField(parsed.id));
  }

  if (type === "turn.completed") {
    return [{ type: "token_usage", message: "Token usage", data: parsed }];
  }

  if (type === "token_count" || type === "token_usage") {
    return [{ type: "token_usage", message: "Token usage", data: parsed }];
  }

  if (type === "error" || type === "turn.failed") {
    return [{ type: "session_error", message: stringField(parsed.message) ?? "Codex error", data: parsed }];
  }

  return [];
}

function eventFromClaudeToolResult(part: Record<string, unknown>): StudioNormalizedOutputEvent {
  const id = stringField(part.tool_use_id) ?? stringField(part.toolUseId) ?? stringField(part.id);
  const content = stringField(part.content) ?? stringField(part.text) ?? stringField(part.result) ?? "tool result";
  return {
    type: "tool_result",
    message: content,
    data: {
      ...part,
      ...(id ? { id, toolUseId: id } : {}),
      output: content,
    },
  };
}

function eventFromCodexToolResult(item: Record<string, unknown>): StudioNormalizedOutputEvent {
  const id = stringField(item.call_id) ?? stringField(item.callId) ?? stringField(item.id);
  const output = stringField(item.output) ?? stringField(item.result) ?? extractCodexItemText(item) ?? "tool result";
  return {
    type: "tool_result",
    message: output,
    data: {
      ...item,
      ...(id ? { id, callId: id } : {}),
      output,
    },
  };
}

const MODEL_SECTION_TYPES = new Set<StudioEventType>([
  "research_note",
  "design_decision",
  "design_system_artifact",
  "tool_call",
  "artifact",
  "session_result",
  "acceptance_statement",
]);

function eventsFromModelTextResult(
  message: string,
  data: unknown,
  sourceEventId?: string | null,
): StudioNormalizedOutputEvent[] {
  const sections = splitLabeledModelSections(message);
  if (sections.length === 0) return [{ type: "session_result", message, data }];
  return sections.map((section) => ({
    type: section.type,
    message: section.message,
    data: {
      ...(sourceEventId ? { sourceEventId } : {}),
      sectionLabel: section.type,
      rawResult: message,
      rawPayload: data,
    },
  }));
}

function splitLabeledModelSections(message: string): Array<{ type: StudioEventType; message: string }> {
  const sections: Array<{ type: StudioEventType; lines: string[] }> = [];
  const labelPattern = /^\s*(?:[-*]\s*)?(?:#{1,6}\s*)?(?:\*\*)?([A-Za-z][A-Za-z0-9 _/-]{2,64})(?:\*\*)?\s*:?\s*(.*)$/;
  for (const line of message.split(/\r?\n/)) {
    const match = line.match(labelPattern);
    const sectionType = match ? normalizeModelSectionType(match[1]) : null;
    if (match && sectionType && isExplicitModelSectionLine(line, match[1])) {
      sections.push({ type: sectionType, lines: match[2]?.trim() ? [match[2].trim()] : [] });
      continue;
    }
    sections.at(-1)?.lines.push(line);
  }
  return sections
    .map((section) => ({ type: section.type, message: section.lines.join("\n").trim() }))
    .filter((section) => section.message.length > 0);
}

function isExplicitModelSectionLine(line: string, label: string): boolean {
  if (/^\s*(?:[-*]\s*)?(?:#{1,6}\s+|\*\*)/.test(line)) return true;
  return MODEL_SECTION_TYPES.has(label.trim().toLowerCase() as StudioEventType);
}

function normalizeModelSectionType(label: string): StudioEventType | null {
  const normalized = label
    .trim()
    .replace(/[*`]/g, "")
    .replace(/[_/-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
  const exact = normalized.replaceAll(" ", "_") as StudioEventType;
  if (MODEL_SECTION_TYPES.has(exact)) return exact;
  if (/^(research|research notes?|research findings?|findings|evidence|evidence summary|user research|market research)$/.test(normalized)) {
    return "research_note";
  }
  if (/^(design decisions?|decisions?|recommendations?|design rationale|rationale)$/.test(normalized)) {
    return "design_decision";
  }
  if (/^(commands?|commands run|command log|tools?|tool calls?|tool usage|memoire commands|codex commands)$/.test(normalized)) {
    return "tool_call";
  }
  if (/^(artifacts?|files changed|outputs?|deliverables?|patches?|generated files?)$/.test(normalized)) {
    return "artifact";
  }
  if (/^(acceptance|acceptance criteria|acceptance statement|verification|verification plan|checks?)$/.test(normalized)) {
    return "acceptance_statement";
  }
  if (/^(summary|result|session result|final result|next steps|handoff)$/.test(normalized)) {
    return "session_result";
  }
  if (/^(design system artifact|design system artifacts)$/.test(normalized)) {
    return "design_system_artifact";
  }
  return null;
}

function eventsFromCodexCommandExecution(item: Record<string, unknown>): StudioNormalizedOutputEvent[] {
  const command = stringField(item.command) ?? stringField(item.name) ?? "command";
  const events: StudioNormalizedOutputEvent[] = [
    { type: "terminal_command", message: command, data: item },
  ];
  const output = stringField(item.aggregated_output) ?? stringField(item.output);
  if (output) {
    events.push({ type: "terminal_output", message: output, data: item });
  }
  return events;
}

function structuredEventFromPayload(
  parsed: Record<string, unknown>,
  type: string | null,
): StudioNormalizedOutputEvent | null {
  if (!type || !STRUCTURED_EVENT_TYPES.has(type as StudioEventType)) return null;
  return {
    type: type as StudioEventType,
    message: stringField(parsed.message) ?? stringField(parsed.title) ?? stringField(parsed.path) ?? type,
    data: isRecord(parsed.data) ? parsed.data : parsed,
  };
}

function extractCodexItemText(item: Record<string, unknown> | null): string | null {
  if (!item) return null;
  if (typeof item.text === "string") return item.text;
  if (typeof item.message === "string") return item.message;
  const content = item.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;
  const text = content
    .map((part) => isRecord(part) ? stringField(part.text) ?? stringField(part.content) : null)
    .filter((part): part is string => Boolean(part))
    .join("\n")
    .trim();
  return text || null;
}

function summarizeMemoireResult(parsed: unknown): string {
  if (!isRecord(parsed)) return "Memoire result";
  const category = stringField(parsed.category) ?? stringField(parsed.status) ?? "Memoire";
  const execution = isRecord(parsed.execution) ? parsed.execution : null;
  const resultStatus = execution ? stringField(execution.status) : stringField(parsed.status);
  const completedTasks = execution && typeof execution.completedTasks === "number" ? execution.completedTasks : null;
  const totalTasks = execution && typeof execution.totalTasks === "number" ? execution.totalTasks : null;
  if (resultStatus && completedTasks !== null && totalTasks !== null) {
    return `${category} ${resultStatus}: ${completedTasks}/${totalTasks} tasks`;
  }
  if (resultStatus) return `${category} ${resultStatus}`;
  if (typeof parsed.intent === "string") return parsed.intent;
  return "Memoire result";
}

function parseJSON(value: string): unknown | null {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function looksLikePendingJSON(value: string): boolean {
  return value.startsWith("{") || value.startsWith("[");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
