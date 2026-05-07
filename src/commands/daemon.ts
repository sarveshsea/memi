import type { Command } from "commander";
import type { MemoireEngine } from "../engine/core.js";

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { planAgentInstall } from "../agents/agent-kits.js";
import { loadStudioConfig } from "../studio/config.js";
import { listHarnesses } from "../studio/harnesses.js";
import { listKnowledgeStore, refreshKnowledgeStore } from "../studio/knowledge-store.js";
import { indexProjectMemory, refreshProjectMemory } from "../studio/project-memory.js";
import { StudioRuntimeServer } from "../studio/server.js";
import type { ProjectMemoryKind, StudioKnowledgeKind } from "../studio/types.js";
import { ui } from "../tui/format.js";

interface DaemonPhaseTimings {
  init: number;
  runtimeStart: number;
  warm: number;
  ready: number;
}

interface DaemonWarmState {
  knowledge: {
    total: number;
    counts: Partial<Record<StudioKnowledgeKind, number>>;
  };
  projectMemory: {
    total: number;
    counts: Partial<Record<ProjectMemoryKind, number>>;
  };
  harnesses: {
    total: number;
    installed: number;
    enabled: number;
  };
  agentKits: {
    plans: number;
  };
  suiteManifestPath: string;
}

interface DaemonStatus {
  pid: number;
  port: number;
  figmaPort: number;
  dashboardPort: number;
  runtimeUrl: string;
  projectRoot: string;
  startedAt: string;
  phases?: DaemonPhaseTimings;
  warm?: DaemonWarmState;
  pipeline?: {
    enabled: boolean;
    autoPull: boolean;
    autoSpec: boolean;
    autoGenerate: boolean;
  };
}

interface DaemonStatusPayload {
  action: "start" | "status" | "stop";
  status: "running" | "stopped" | "stale-cleaned" | "already-running" | "starting";
  reason?: "missing-status-file" | "stale-process";
  daemon: {
    pid: number;
    port: number;
    figmaPort: number;
    dashboardPort: number;
    runtimeUrl: string;
    projectRoot: string;
    startedAt: string;
    uptimeSeconds: number | null;
    uptimeHuman: string | null;
    alive: boolean;
    figmaConnected: boolean;
    previewUrl: string;
    phases: DaemonPhaseTimings | null;
    warm: DaemonWarmState | null;
  } | null;
  cleanup: {
    performed: boolean;
  };
}

function memoireDir(projectRoot: string): string {
  return join(resolve(projectRoot), ".memoire");
}

function pidPath(projectRoot: string): string {
  return join(memoireDir(projectRoot), "daemon.pid");
}

function statusPath(projectRoot: string): string {
  return join(memoireDir(projectRoot), "daemon.json");
}

function resolveProjectRoot(engine: MemoireEngine, project?: string): string {
  return resolve(project ?? engine.config.projectRoot);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readStatus(projectRoot: string): Promise<DaemonStatus | null> {
  try {
    const raw = await readFile(statusPath(projectRoot), "utf-8");
    return JSON.parse(raw) as DaemonStatus;
  } catch {
    return null;
  }
}

async function cleanupFiles(projectRoot: string): Promise<void> {
  for (const path of [pidPath(projectRoot), statusPath(projectRoot)]) {
    try {
      await unlink(path);
    } catch {
      // Already gone.
    }
  }
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

export function registerDaemonCommand(program: Command, engine: MemoireEngine): void {
  const daemon = program
    .command("daemon")
    .description("Manage the shared Memoire native runtime daemon");

  daemon
    .command("start")
    .description("Start the shared Memoire daemon for CLI, Studio, MCP, and agent adapters")
    .option("--project <path>", "Project/workspace root for daemon state")
    .option("-p, --port <port>", "Runtime API port or auto", "auto")
    .option("--host <host>", "Runtime host", "127.0.0.1")
    .option("--foreground", "Run in the foreground instead of spawning a background process")
    .option("--json", "Output daemon status as JSON")
    .option("--once", "Start, warm, print status, and stop immediately (test/helper mode)")
    .action(async (opts: { project?: string; port?: string; host?: string; foreground?: boolean; json?: boolean; once?: boolean }) => {
      const projectRoot = resolveProjectRoot(engine, opts.project);
      const existing = await readStatus(projectRoot);
      if (existing && isProcessAlive(existing.pid)) {
        const payload: DaemonStatusPayload = {
          action: "start",
          status: "already-running",
          daemon: serializeDaemonStatus(existing, true, figmaConnected(engine), uptimeSeconds(existing)),
          cleanup: { performed: false },
        };
        if (opts.json) console.log(JSON.stringify(payload, null, 2));
        else printRunning(existing, "Daemon already running");
        return;
      }

      if (!opts.foreground && !opts.once) {
        const started = await startBackgroundDaemon(projectRoot, opts);
        if (opts.json) console.log(JSON.stringify(started, null, 2));
        else if (started.daemon) printRunningStatus(started.daemon, "Daemon starting");
        return;
      }

      const t0 = Date.now();
      await mkdir(memoireDir(projectRoot), { recursive: true });
      const tInit = Date.now();

      const server = new StudioRuntimeServer({
        projectRoot,
        port: parsePort(opts.port ?? "auto"),
        host: opts.host ?? "127.0.0.1",
      });
      const runtime = await server.start();
      const tRuntime = Date.now();
      const warm = await warmNativeRuntime(projectRoot);
      const tWarm = Date.now();
      const phases: DaemonPhaseTimings = {
        init: tInit - t0,
        runtimeStart: tRuntime - tInit,
        warm: tWarm - tRuntime,
        ready: tWarm - t0,
      };
      const status: DaemonStatus = {
        pid: process.pid,
        port: runtime.port,
        figmaPort: 0,
        dashboardPort: runtime.port,
        runtimeUrl: runtime.url,
        projectRoot,
        startedAt: new Date().toISOString(),
        phases,
        warm,
        pipeline: {
          enabled: true,
          autoPull: false,
          autoSpec: false,
          autoGenerate: false,
        },
      };
      await writeFile(pidPath(projectRoot), String(process.pid), "utf-8");
      await writeFile(statusPath(projectRoot), JSON.stringify(status, null, 2) + "\n", "utf-8");

      const payload: DaemonStatusPayload = {
        action: "start",
        status: "running",
        daemon: serializeDaemonStatus(status, true, figmaConnected(engine), 0),
        cleanup: { performed: false },
      };

      if (opts.json) console.log(JSON.stringify(payload, null, 2));
      else printRunning(status, `Daemon ready in ${phases.ready}ms`);

      const shutdown = async () => {
        await server.stop();
        await cleanupFiles(projectRoot);
        process.exit(0);
      };
      process.once("SIGTERM", shutdown);
      process.once("SIGINT", shutdown);

      if (opts.once) {
        await server.stop();
        await cleanupFiles(projectRoot);
        return;
      }

      setInterval(() => {}, 60_000);
    });

  daemon
    .command("stop")
    .description("Stop the running Memoire daemon")
    .option("--project <path>", "Project/workspace root for daemon state")
    .option("--json", "Output daemon status as JSON")
    .action(async (opts: { project?: string; json?: boolean }) => {
      const projectRoot = resolveProjectRoot(engine, opts.project);
      const status = await readStatus(projectRoot);
      if (!status) {
        const payload: DaemonStatusPayload = {
          action: "stop",
          status: "stopped",
          reason: "missing-status-file",
          daemon: null,
          cleanup: { performed: false },
        };
        if (opts.json) console.log(JSON.stringify(payload, null, 2));
        else console.log("\n  No daemon PID file found. Is the daemon running?\n");
        return;
      }

      const alive = isProcessAlive(status.pid);
      if (alive) {
        process.kill(status.pid, "SIGTERM");
      }
      await cleanupFiles(projectRoot);
      const payload: DaemonStatusPayload = {
        action: "stop",
        status: "stopped",
        daemon: serializeDaemonStatus(status, alive, figmaConnected(engine), alive ? uptimeSeconds(status) : null),
        cleanup: { performed: true },
      };
      if (opts.json) console.log(JSON.stringify(payload, null, 2));
      else console.log("\n  Memoire daemon stopped.\n");
    });

  daemon
    .command("status")
    .description("Show the current daemon status")
    .option("--project <path>", "Project/workspace root for daemon state")
    .option("--json", "Output daemon status as JSON")
    .action(async (opts: { project?: string; json?: boolean }) => {
      const projectRoot = resolveProjectRoot(engine, opts.project);
      const status = await readStatus(projectRoot);
      const json = Boolean(opts.json);

      if (!status) {
        const payload: DaemonStatusPayload = {
          action: "status",
          status: "stopped",
          reason: "missing-status-file",
          daemon: null,
          cleanup: { performed: false },
        };
        if (json) console.log(JSON.stringify(payload, null, 2));
        else console.log(`\n  ${ui.pending("Daemon stopped " + ui.dim("(no status file)"))}\n`);
        return;
      }

      const alive = isProcessAlive(status.pid);
      const connected = figmaConnected(engine);
      if (!alive) {
        await cleanupFiles(projectRoot);
        const payload: DaemonStatusPayload = {
          action: "status",
          status: "stale-cleaned",
          reason: "stale-process",
          daemon: serializeDaemonStatus(status, false, false, null),
          cleanup: { performed: true },
        };
        if (json) console.log(JSON.stringify(payload, null, 2));
        else {
          console.log();
          console.log(ui.warn(`Daemon stopped unexpectedly (PID ${status.pid} gone) - restart with: memi daemon start`));
          console.log(ui.ok("Cleaned stale daemon files"));
          console.log();
        }
        return;
      }

      const payload: DaemonStatusPayload = {
        action: "status",
        status: "running",
        daemon: serializeDaemonStatus(status, true, connected, uptimeSeconds(status)),
        cleanup: { performed: false },
      };
      if (json) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }
      printRunning(status, "Daemon running");
    });
}

async function warmNativeRuntime(projectRoot: string): Promise<DaemonWarmState> {
  const [knowledge, projectMemory, config, agentKitPlans] = await Promise.all([
    refreshKnowledgeStore(projectRoot).catch(() => listKnowledgeStore(projectRoot)),
    refreshProjectMemory(projectRoot).catch(() => indexProjectMemory(projectRoot)),
    loadStudioConfig(projectRoot),
    planAgentInstall({ target: "all", projectRoot, dryRun: true }),
  ]);
  const harnesses = listHarnesses(config);
  return {
    knowledge: {
      total: knowledge.items.length,
      counts: knowledge.counts,
    },
    projectMemory: {
      total: projectMemory.items.length,
      counts: projectMemory.counts,
    },
    harnesses: {
      total: harnesses.length,
      installed: harnesses.filter((harness) => harness.installed).length,
      enabled: harnesses.filter((harness) => harness.enabled).length,
    },
    agentKits: {
      plans: agentKitPlans.length,
    },
    suiteManifestPath: join(projectRoot, "memoire.agent.yaml"),
  };
}

async function startBackgroundDaemon(
  projectRoot: string,
  opts: { port?: string; host?: string },
): Promise<DaemonStatusPayload> {
  const cliPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "index.js");
  if (!existsSync(cliPath)) {
    throw new Error("Background daemon start requires the built CLI. Run `npm run build` or use `memi daemon start --foreground`.");
  }
  const args = [
    cliPath,
    "daemon",
    "start",
    "--foreground",
    "--project",
    projectRoot,
    "--port",
    opts.port ?? "auto",
    "--host",
    opts.host ?? "127.0.0.1",
    "--json",
  ];
  const child = spawn(process.execPath, args, {
    detached: true,
    stdio: "ignore",
    env: { ...process.env },
  });
  child.unref();

  const startedAt = Date.now();
  while (Date.now() - startedAt < 5000) {
    await new Promise((resolvePoll) => setTimeout(resolvePoll, 150));
    const status = await readStatus(projectRoot);
    if (status && isProcessAlive(status.pid)) {
      return {
        action: "start",
        status: "running",
        daemon: serializeDaemonStatus(status, true, false, uptimeSeconds(status)),
        cleanup: { performed: false },
      };
    }
  }

  return {
    action: "start",
    status: "starting",
    daemon: null,
    cleanup: { performed: false },
  };
}

function serializeDaemonStatus(
  status: DaemonStatus,
  alive: boolean,
  figmaConnected: boolean,
  uptimeSecondsValue: number | null,
): NonNullable<DaemonStatusPayload["daemon"]> {
  return {
    pid: status.pid,
    port: status.port,
    figmaPort: status.figmaPort,
    dashboardPort: status.dashboardPort,
    runtimeUrl: status.runtimeUrl ?? `http://localhost:${status.port}`,
    projectRoot: status.projectRoot ?? "",
    startedAt: status.startedAt,
    uptimeSeconds: uptimeSecondsValue,
    uptimeHuman: uptimeSecondsValue === null ? null : formatUptime(uptimeSecondsValue),
    alive,
    figmaConnected,
    previewUrl: status.runtimeUrl ?? `http://localhost:${status.port}`,
    phases: status.phases ?? null,
    warm: status.warm ?? null,
  };
}

function uptimeSeconds(status: DaemonStatus): number {
  return Math.max(0, (Date.now() - new Date(status.startedAt).getTime()) / 1000);
}

function figmaConnected(engine: MemoireEngine): boolean {
  return Boolean(engine.figma?.wsServer?.connectedClients?.length);
}

function parsePort(value: string): number {
  if (value === "auto") return 0;
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}

function printRunning(status: DaemonStatus, label: string): void {
  console.log();
  console.log(ui.ok(label));
  console.log(ui.dots("PID", String(status.pid)));
  console.log(ui.dots("Project", status.projectRoot));
  console.log(ui.dots("Runtime", status.runtimeUrl ?? `http://localhost:${status.port}`));
  if (status.warm) {
    console.log(ui.dots("Knowledge", `${status.warm.knowledge.total} markdown/YAML/JSON sources`));
    console.log(ui.dots("Harnesses", `${status.warm.harnesses.installed}/${status.warm.harnesses.total} installed`));
    console.log(ui.dots("Agent kits", `${status.warm.agentKits.plans} planned targets`));
  }
  console.log();
}

function printRunningStatus(status: NonNullable<DaemonStatusPayload["daemon"]>, label: string): void {
  console.log();
  console.log(ui.ok(label));
  console.log(ui.dots("PID", String(status.pid)));
  console.log(ui.dots("Project", status.projectRoot));
  console.log(ui.dots("Runtime", status.runtimeUrl));
  console.log();
}
