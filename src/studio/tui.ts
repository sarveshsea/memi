import type {
  StudioEvent,
  StudioFigmaStatus,
  StudioHarnessAuthStatus,
  StudioHarnessId,
} from "./types.js";
import type { StudioSessionIndexEntry } from "./session-store.js";
import { deriveStudioTrace } from "./view-model.js";

export interface StudioTuiHarnessRow {
  id: StudioHarnessId | string;
  label: string;
  installed: boolean;
  authStatus?: StudioHarnessAuthStatus;
}

export interface StudioTuiSnapshotInput {
  workspaceLabel: string;
  sessions: StudioSessionIndexEntry[];
  events: StudioEvent[];
  harnesses: StudioTuiHarnessRow[];
  figma: Pick<StudioFigmaStatus, "connectionState" | "clients" | "port">;
}

const WIDTH = 92;

export function renderStudioTuiSnapshot(input: StudioTuiSnapshotInput): string {
  const activeSession = input.sessions[0] ?? null;
  const trace = deriveStudioTrace({
    session: activeSession ? { id: activeSession.id, action: activeSession.action, status: activeSession.status } : null,
    events: input.events,
  });
  const harnessRows = input.harnesses
    .map((harness) => {
      const installed = harness.installed ? "ready" : "missing";
      const auth = harness.authStatus ? ` / ${harness.authStatus}` : "";
      return `  ${dot(harness.installed)} ${pad(harness.label, 18)} ${installed}${auth}`;
    })
    .slice(0, 8);
  const eventRows = input.events
    .slice(-12)
    .map((event) => `  ${time(event.timestamp)} ${pad(event.type, 22)} ${trim(event.message.replace(/\s+/g, " "), 52)}`);
  const phaseRows = trace.phases
    .map((phase) => `  ${pad(phase.label, 12)} ${phase.status}`)
    .slice(0, 6);
  const taskRows = trace.tasks
    .map((task) => `  ${pad(task.label, 24)} ${task.status} ${String(task.progress).padStart(3, " ")}%`)
    .slice(0, 5);

  return [
    rule("Mémoire Studio TUI"),
    `  Workspace     ${input.workspaceLabel}`,
    `  Figma         ${figmaLabel(input.figma)}`,
    `  Active        ${activeSession ? `${activeSession.harness} / ${activeSession.status}` : "no session"}`,
    "",
    subrule("Trace"),
    ...(phaseRows.length > 0 ? phaseRows : ["  no trace"]),
    "",
    subrule("Agent Tasks"),
    ...(taskRows.length > 0 ? taskRows : ["  no tasks"]),
    "",
    subrule("Harnesses"),
    ...(harnessRows.length > 0 ? harnessRows : ["  no harnesses"]),
    "",
    subrule("Live log"),
    ...(eventRows.length > 0 ? eventRows : ["  no events"]),
    "",
    "  Keys: q quit · r refresh · c cancel selected · / filter",
  ].join("\n");
}

function figmaLabel(figma: Pick<StudioFigmaStatus, "connectionState" | "clients" | "port">): string {
  const clientCount = figma.clients.length;
  return `Figma ${figma.connectionState}${figma.port ? ` on ${figma.port}` : ""} · ${clientCount} client${clientCount === 1 ? "" : "s"}`;
}

function rule(label: string): string {
  return `┌─ ${label} ${"─".repeat(Math.max(0, WIDTH - label.length - 5))}┐`;
}

function subrule(label: string): string {
  return `${label.toUpperCase()} ${"─".repeat(Math.max(0, WIDTH - label.length - 1))}`;
}

function dot(active: boolean): string {
  return active ? "●" : "○";
}

function time(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function pad(value: string, width: number): string {
  return trim(value, width).padEnd(width, " ");
}

function trim(value: string, width: number): string {
  return value.length <= width ? value : `${value.slice(0, Math.max(0, width - 1))}…`;
}
