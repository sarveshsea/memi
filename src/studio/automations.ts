import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  StudioAutomationDefinition,
  StudioAutomationRun,
  StudioAutomationSchedulerStatus,
  StudioAutomationTemplate,
  StudioAutomationMutationPolicy,
  StudioCodexConfig,
  StudioConfig,
  StudioHarnessId,
  StudioRunAction,
  StudioChatMode,
  StudioPermissionMode,
} from "./types.js";

const DEFAULT_TIMEZONE = "America/Chicago";
const DEFAULT_SCHEDULER_INTERVAL_SECONDS = 300;
const DEFAULT_CODEX_AUTOMATION_CONFIG: Partial<StudioCodexConfig> = {
  model: "gpt-5.5",
  reasoningEffort: "xhigh",
  approvalPolicy: "on-request",
  webSearch: false,
  skipGitRepoCheck: true,
  includeMemoireCommands: true,
  includeCodexCommands: true,
  planModeDefault: true,
};

export const DESIGN_AUTOMATION_TEMPLATES: StudioAutomationTemplate[] = [
  {
    id: "design-system-audit",
    name: "Design System Audit",
    description: "Scheduled Codex review of design-system drift, tokens, specs, and acceptance criteria.",
    kind: "cron",
    rrule: "FREQ=DAILY;BYHOUR=9;BYMINUTE=0;BYSECOND=0",
    harness: "codex",
    action: "audit",
    chatMode: "review",
    permissionMode: "plan",
    mutationPolicy: "review",
    prompt: "Run a Mémoire design-system audit for this workspace. Inspect specs, tokens, generated registries, Figma bridge state if available, and recent design artifacts. Produce findings, risks, and acceptance criteria without editing files or Figma canvas.",
  },
  {
    id: "figma-token-component-pull",
    name: "Figma Token and Component Pull",
    description: "Scheduled Figma bridge inspection for token/component changes and pull recommendations.",
    kind: "cron",
    rrule: "FREQ=DAILY;BYHOUR=10;BYMINUTE=0;BYSECOND=0",
    harness: "codex",
    action: "audit",
    chatMode: "review",
    permissionMode: "plan",
    mutationPolicy: "review",
    prompt: "Inspect the Mémoire Figma bridge and design-system sources. If Figma is connected, review token, component, style, and sticky changes. Report what should be pulled or synced and what needs human review. Do not mutate Figma or files.",
  },
  {
    id: "codex-app-build-review",
    name: "Codex App Build Review",
    description: "Scheduled Codex app-build review with Mémoire project memory and design harness context.",
    kind: "cron",
    rrule: "FREQ=DAILY;BYHOUR=15;BYMINUTE=0;BYSECOND=0",
    harness: "codex",
    action: "app-build",
    chatMode: "review",
    permissionMode: "plan",
    mutationPolicy: "review",
    prompt: "Review the app-build surface through the Mémoire design harness. Identify UI, UX, accessibility, shadcn/Tailwind, and Atomic Design issues. Return a concise implementation plan and verification checklist without editing.",
  },
  {
    id: "research-reference-refresh",
    name: "Research and Reference Refresh",
    description: "Scheduled refresh of research notes, references, marketplace notes, and reusable design decisions.",
    kind: "cron",
    rrule: "FREQ=DAILY;BYHOUR=11;BYMINUTE=30;BYSECOND=0",
    harness: "codex",
    action: "research",
    chatMode: "research",
    permissionMode: "plan",
    mutationPolicy: "review",
    prompt: "Refresh Mémoire research and reference context for this workspace. Inspect project memory, knowledge items, notes, specs, and recent artifacts. Summarize new or stale references and produce research_note/design_decision candidates without editing.",
  },
];

export interface CreateAutomationFromTemplateInput {
  templateId: string;
  cwd: string;
  timezone?: string;
  sourceSessionId?: string | null;
}

export function createAutomationFromTemplate(input: CreateAutomationFromTemplateInput): Omit<StudioAutomationDefinition, "id" | "createdAt" | "updatedAt"> {
  const template = DESIGN_AUTOMATION_TEMPLATES.find((candidate) => candidate.id === input.templateId);
  if (!template) throw new Error(`Unknown automation template: ${input.templateId}`);
  return {
    schemaVersion: 1,
    kind: template.kind,
    name: template.name,
    prompt: template.prompt,
    status: "ACTIVE",
    rrule: template.rrule,
    timezone: input.timezone ?? DEFAULT_TIMEZONE,
    harness: template.harness,
    action: template.action,
    chatMode: template.chatMode,
    permissionMode: template.permissionMode,
    mutationPolicy: template.mutationPolicy,
    codex: { ...DEFAULT_CODEX_AUTOMATION_CONFIG },
    cwd: resolve(input.cwd),
    templateId: template.id,
    sourceSessionId: input.sourceSessionId ?? null,
    lastRunAt: null,
    nextRunAt: nextRunFromRRule(template.rrule, new Date().toISOString(), input.timezone ?? DEFAULT_TIMEZONE),
  };
}

export class StudioAutomationStore {
  private readonly root: string;

  constructor(projectRoot: string) {
    this.root = join(resolve(projectRoot), ".memoire", "studio", "automations");
  }

  async create(input: Partial<StudioAutomationDefinition>): Promise<StudioAutomationDefinition> {
    const now = new Date().toISOString();
    const id = input.id ? slug(input.id) : `${slug(input.name ?? input.templateId ?? "automation")}-${randomUUID().slice(0, 8)}`;
    const definition = normalizeAutomation({
      schemaVersion: 1,
      id,
      kind: input.kind ?? "cron",
      name: input.name ?? "Studio Automation",
      prompt: input.prompt ?? "",
      status: input.status ?? "ACTIVE",
      rrule: input.rrule ?? "FREQ=DAILY;BYHOUR=9;BYMINUTE=0;BYSECOND=0",
      timezone: input.timezone ?? DEFAULT_TIMEZONE,
      harness: input.harness ?? "codex",
      action: input.action ?? "audit",
      chatMode: input.chatMode ?? "review",
      permissionMode: input.permissionMode ?? "plan",
      mutationPolicy: input.mutationPolicy ?? "review",
      codex: input.codex ?? { ...DEFAULT_CODEX_AUTOMATION_CONFIG },
      cwd: resolve(input.cwd ?? process.cwd()),
      templateId: input.templateId,
      sourceSessionId: input.sourceSessionId ?? null,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
      lastRunAt: input.lastRunAt ?? null,
      nextRunAt: input.nextRunAt ?? nextRunFromRRule(input.rrule ?? "FREQ=DAILY;BYHOUR=9;BYMINUTE=0;BYSECOND=0", now, input.timezone ?? DEFAULT_TIMEZONE),
    });
    await this.write(definition);
    return definition;
  }

  async list(): Promise<StudioAutomationDefinition[]> {
    await mkdir(this.root, { recursive: true });
    const entries = await safeReadDir(this.root);
    const automations: StudioAutomationDefinition[] = [];
    for (const entry of entries) {
      try {
        const raw = await readFile(this.definitionPath(entry), "utf-8");
        automations.push(normalizeAutomation(JSON.parse(raw) as StudioAutomationDefinition));
      } catch {
        // Ignore partial or unrelated directories.
      }
    }
    return automations.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async get(id: string): Promise<StudioAutomationDefinition | null> {
    try {
      const raw = await readFile(this.definitionPath(slug(id)), "utf-8");
      return normalizeAutomation(JSON.parse(raw) as StudioAutomationDefinition);
    } catch {
      return null;
    }
  }

  async update(id: string, patch: Partial<StudioAutomationDefinition>): Promise<StudioAutomationDefinition> {
    const current = await this.get(id);
    if (!current) throw Object.assign(new Error(`Unknown automation: ${id}`), { statusCode: 404 });
    const updated = normalizeAutomation({
      ...current,
      ...patch,
      id: current.id,
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      nextRunAt: patch.nextRunAt === undefined && (patch.rrule || patch.timezone || patch.status === "ACTIVE")
        ? nextRunFromRRule(patch.rrule ?? current.rrule, new Date().toISOString(), patch.timezone ?? current.timezone)
        : patch.nextRunAt ?? current.nextRunAt,
    });
    await this.write(updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const automation = await this.get(id);
    if (!automation) return false;
    await rm(this.automationDir(automation.id), { recursive: true, force: true });
    return true;
  }

  async claimDue(nowIso = new Date().toISOString()): Promise<StudioAutomationDefinition[]> {
    return this.withLock(async () => {
      const due: StudioAutomationDefinition[] = [];
      for (const automation of await this.list()) {
        if (automation.status !== "ACTIVE") continue;
        if (!automation.nextRunAt || automation.nextRunAt > nowIso) continue;
        const claimed = normalizeAutomation({
          ...automation,
          lastRunAt: nowIso,
          nextRunAt: nextRunFromRRule(automation.rrule, nowIso, automation.timezone),
          updatedAt: new Date().toISOString(),
        });
        await this.write(claimed);
        due.push(claimed);
      }
      return due;
    });
  }

  async appendRun(automationId: string, run: StudioAutomationRun): Promise<void> {
    const automation = await this.get(automationId);
    if (!automation) throw Object.assign(new Error(`Unknown automation: ${automationId}`), { statusCode: 404 });
    await mkdir(this.automationDir(automation.id), { recursive: true });
    await appendFile(this.runsPath(automation.id), `${JSON.stringify(run)}\n`, "utf-8");
    await this.write({
      ...automation,
      lastRunAt: automation.lastRunAt ?? run.startedAt,
      updatedAt: new Date().toISOString(),
    });
  }

  async listRuns(automationId: string): Promise<StudioAutomationRun[]> {
    const automation = await this.get(automationId);
    if (!automation) throw Object.assign(new Error(`Unknown automation: ${automationId}`), { statusCode: 404 });
    try {
      const raw = await readFile(this.runsPath(automation.id), "utf-8");
      return raw
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line) as StudioAutomationRun)
        .reverse();
    } catch {
      return [];
    }
  }

  private async write(definition: StudioAutomationDefinition): Promise<void> {
    await mkdir(this.automationDir(definition.id), { recursive: true });
    await writeFile(this.definitionPath(definition.id), `${JSON.stringify(definition, null, 2)}\n`, "utf-8");
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await mkdir(this.root, { recursive: true });
    const lockPath = join(this.root, ".run.lock");
    try {
      await writeFile(lockPath, `${process.pid}\n${new Date().toISOString()}\n`, { flag: "wx" });
    } catch {
      return [] as T;
    }
    try {
      return await fn();
    } finally {
      await rm(lockPath, { force: true });
    }
  }

  private automationDir(id: string): string {
    return join(this.root, slug(id));
  }

  private definitionPath(id: string): string {
    return join(this.automationDir(id), "automation.json");
  }

  private runsPath(id: string): string {
    return join(this.automationDir(id), "runs.jsonl");
  }
}

export function buildAutomationPrompt(automation: StudioAutomationDefinition, config: StudioConfig): string {
  const codex = {
    ...config.codex,
    ...(automation.codex ?? {}),
  };
  const writeBoundary = automation.mutationPolicy === "allow_writes"
    ? "This automation explicitly allows writes when the selected permission mode permits them. Keep every mutation traceable."
    : "Do not mutate files or Figma canvas unless this automation explicitly allows writes.";
  return [
    "# Mémoire Studio automation",
    "",
    `Automation: ${automation.name}`,
    `Automation id: ${automation.id}`,
    `Template: ${automation.templateId ?? "custom"}`,
    `Mutation policy: ${automation.mutationPolicy}`,
    `Harness: ${automation.harness}`,
    `Action: ${automation.action}`,
    `Chat mode: ${automation.chatMode}`,
    `Permission mode: ${automation.permissionMode}`,
    automation.harness === "codex" ? `Codex model: ${codex.model}` : "",
    automation.harness === "codex" ? `model_reasoning_effort: ${codex.reasoningEffort}` : "",
    automation.harness === "codex" ? `approval_policy: ${codex.approvalPolicy}` : "",
    "",
    "## Automation boundary",
    "- This run came from Mémoire Studio Automations.",
    `- ${writeBoundary}`,
    "- Produce research_note, design_decision, artifact, acceptance_statement, and session_result sections when useful.",
    "- End with the next human-review step and exact verification commands.",
    "",
    "## Scheduled task",
    automation.prompt.trim(),
  ].filter(Boolean).join("\n");
}

export function nextRunFromRRule(rrule: string, afterIso: string, timezone = DEFAULT_TIMEZONE): string | null {
  const parts = parseRRule(rrule);
  const freq = parts.FREQ ?? "DAILY";
  const after = new Date(afterIso);
  if (Number.isNaN(after.getTime())) throw new Error(`Invalid after date: ${afterIso}`);
  if (freq === "MINUTELY") {
    const interval = Number(parts.INTERVAL ?? "1");
    const minutes = Number.isFinite(interval) && interval > 0 ? interval : 1;
    const next = new Date(after.getTime());
    next.setUTCSeconds(0, 0);
    next.setUTCMinutes(next.getUTCMinutes() + minutes - (next.getUTCMinutes() % minutes));
    if (next <= after) next.setUTCMinutes(next.getUTCMinutes() + minutes);
    return next.toISOString();
  }

  const targetHour = Number(parts.BYHOUR ?? "9");
  const targetMinute = Number(parts.BYMINUTE ?? "0");
  const targetSecond = Number(parts.BYSECOND ?? "0");
  const days = new Set((parts.BYDAY ?? "").split(",").filter(Boolean));
  const maxMinutes = 370 * 24 * 60;
  const candidate = new Date(after.getTime() + 60_000);
  candidate.setUTCSeconds(0, 0);

  for (let i = 0; i < maxMinutes; i += 1) {
    const local = zonedParts(candidate, timezone);
    const dayMatches = freq === "WEEKLY" ? days.size === 0 || days.has(local.weekday) : true;
    if (
      dayMatches
      && local.hour === targetHour
      && local.minute === targetMinute
      && local.second === targetSecond
    ) {
      return candidate.toISOString();
    }
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }
  return null;
}

export function buildLaunchAgentPlist(input: {
  label: string;
  runtimeBinary: string;
  projectRoot: string;
  intervalSeconds?: number;
  logPath: string;
}): string {
  const interval = input.intervalSeconds ?? DEFAULT_SCHEDULER_INTERVAL_SECONDS;
  const args = [
    input.runtimeBinary,
    "studio",
    "automations",
    "run-due",
    "--project",
    input.projectRoot,
    "--json",
  ];
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">`,
    `<plist version="1.0">`,
    `<dict>`,
    `  <key>Label</key>`,
    `  <string>${escapeXml(input.label)}</string>`,
    `  <key>ProgramArguments</key>`,
    `  <array>`,
    ...args.map((arg) => `    <string>${escapeXml(arg)}</string>`),
    `  </array>`,
    `  <key>StartInterval</key>`,
    `  <integer>${interval}</integer>`,
    `  <key>RunAtLoad</key>`,
    `  <true/>`,
    `  <key>StandardOutPath</key>`,
    `  <string>${escapeXml(input.logPath)}</string>`,
    `  <key>StandardErrorPath</key>`,
    `  <string>${escapeXml(input.logPath)}</string>`,
    `</dict>`,
    `</plist>`,
    ``,
  ].join("\n");
}

export function schedulerStatus(projectRoot: string, runtimeBinary = process.execPath): StudioAutomationSchedulerStatus {
  const resolvedRoot = resolve(projectRoot);
  const label = schedulerLabel(resolvedRoot);
  const plistPath = schedulerPlistPath(label);
  const logPath = join(resolvedRoot, ".memoire", "studio", "automations", "scheduler.log");
  return {
    label,
    installed: existsSync(plistPath),
    plistPath,
    projectRoot: resolvedRoot,
    runtimeBinary,
    intervalSeconds: DEFAULT_SCHEDULER_INTERVAL_SECONDS,
    logPath,
    message: existsSync(plistPath) ? "LaunchAgent installed" : "LaunchAgent not installed",
  };
}

export async function installScheduler(projectRoot: string, runtimeBinary = process.execPath): Promise<StudioAutomationSchedulerStatus> {
  const status = schedulerStatus(projectRoot, runtimeBinary);
  await mkdir(dirname(status.logPath), { recursive: true });
  await mkdir(dirname(status.plistPath), { recursive: true });
  await writeFile(status.plistPath, buildLaunchAgentPlist(status), "utf-8");
  if (process.platform === "darwin") {
    spawnSync("launchctl", ["bootout", `gui/${process.getuid?.() ?? ""}`, status.plistPath], { stdio: "ignore" });
    spawnSync("launchctl", ["bootstrap", `gui/${process.getuid?.() ?? ""}`, status.plistPath], { stdio: "ignore" });
  }
  return schedulerStatus(projectRoot, runtimeBinary);
}

export async function uninstallScheduler(projectRoot: string, runtimeBinary = process.execPath): Promise<StudioAutomationSchedulerStatus> {
  const status = schedulerStatus(projectRoot, runtimeBinary);
  if (process.platform === "darwin") {
    spawnSync("launchctl", ["bootout", `gui/${process.getuid?.() ?? ""}`, status.plistPath], { stdio: "ignore" });
  }
  await rm(status.plistPath, { force: true });
  return schedulerStatus(projectRoot, runtimeBinary);
}

function normalizeAutomation(input: StudioAutomationDefinition): StudioAutomationDefinition {
  if (!input.prompt.trim()) throw new Error("Automation prompt is required");
  if (!input.name.trim()) throw new Error("Automation name is required");
  const mutationPolicy = input.mutationPolicy ?? "review";
  return {
    ...input,
    schemaVersion: 1,
    id: slug(input.id),
    status: input.status === "PAUSED" ? "PAUSED" : "ACTIVE",
    kind: input.kind === "heartbeat" ? "heartbeat" : "cron",
    timezone: input.timezone || DEFAULT_TIMEZONE,
    cwd: resolve(input.cwd),
    mutationPolicy,
    permissionMode: permissionForMutationPolicy(mutationPolicy, input.permissionMode),
    codex: input.harness === "codex" ? { ...DEFAULT_CODEX_AUTOMATION_CONFIG, ...(input.codex ?? {}) } : input.codex,
  };
}

function permissionForMutationPolicy(policy: StudioAutomationMutationPolicy, permissionMode: StudioPermissionMode): StudioPermissionMode {
  if (policy === "read_only") return "plan";
  if (policy === "review" && permissionMode === "full_access") return "plan";
  return permissionMode;
}

function parseRRule(rrule: string): Record<string, string> {
  return Object.fromEntries(
    rrule.split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [key, ...rest] = part.split("=");
        return [key.toUpperCase(), rest.join("=").toUpperCase()];
      }),
  );
}

function zonedParts(date: Date, timezone: string): { hour: number; minute: number; second: number; weekday: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  return {
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: weekdayToRRule(get("weekday")),
  };
}

function weekdayToRRule(value: string): string {
  return ({ Sun: "SU", Mon: "MO", Tue: "TU", Wed: "WE", Thu: "TH", Fri: "FR", Sat: "SA" } as Record<string, string>)[value] ?? value.toUpperCase();
}

async function safeReadDir(path: string): Promise<string[]> {
  try {
    return await readdir(path);
  } catch {
    return [];
  }
}

function schedulerLabel(projectRoot: string): string {
  return `cv.memoire.studio.automations.${slug(basename(projectRoot))}`;
}

function schedulerPlistPath(label: string): string {
  return join(homedir(), "Library", "LaunchAgents", `${label}.plist`);
}

function slug(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return normalized || "automation";
}

function escapeXml(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
