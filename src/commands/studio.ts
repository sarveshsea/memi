import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import type { MemoireEngine } from "../engine/core.js";
import { loadStudioConfig } from "../studio/config.js";
import { StudioBrowserAdapter } from "../studio/browser-adapter.js";
import {
  StudioAutomationStore,
  installScheduler,
  schedulerStatus,
  uninstallScheduler,
} from "../studio/automations.js";
import { listHarnesses } from "../studio/harnesses.js";
import { StudioRuntimeServer } from "../studio/server.js";
import { StudioSessionStore } from "../studio/session-store.js";
import { renderStudioTuiSnapshot } from "../studio/tui.js";
import { createVisualParityProof } from "../studio/visual-parity.js";
import type { StudioEvent, StudioHarnessId, StudioRunAction, StudioSession, StudioSessionMode } from "../studio/types.js";
import { ui } from "../tui/format.js";

export function registerStudioCommand(program: Command, engine: MemoireEngine): void {
  const studio = program
    .command("studio")
    .description("Run Mémoire Studio: desktop/web agent design shell runtime");

  studio
    .command("status")
    .description("Show Studio config, harnesses, and runtime readiness")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      await engine.init("minimal");
      const config = await loadStudioConfig(engine.config.projectRoot);
      const harnesses = listHarnesses(config);
      const payload = {
        status: "ready",
        projectRoot: engine.config.projectRoot,
        config,
        harnesses,
      };

      if (opts.json) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }

      console.log();
      console.log(ui.section("MÉMOIRE STUDIO"));
      console.log(ui.dots("Project", engine.config.projectRoot));
      console.log(ui.dots("Default harness", config.defaultHarness));
      console.log(ui.dots("Harnesses", `${harnesses.filter((harness) => harness.installed).length}/${harnesses.length} installed`));
      console.log();
    });

  studio
    .command("serve")
    .description("Start the localhost-only Studio JSON/SSE runtime")
    .option("-p, --port <port>", "Studio runtime port", "8765")
    .option("--json", "Output runtime metadata as JSON")
    .option("--once", "Start and stop immediately after printing metadata (test/helper mode)")
    .action(async (opts: { port?: string; json?: boolean; once?: boolean }) => {
      await engine.init("minimal");
      const server = new StudioRuntimeServer({
        projectRoot: engine.config.projectRoot,
        port: parsePort(opts.port ?? "8765"),
      });
      const runtime = await server.start();
      const payload = { status: "running", runtime, projectRoot: engine.config.projectRoot };

      if (opts.json) {
        console.log(JSON.stringify(payload, null, 2));
      } else {
        console.log();
        console.log(ui.ok(`Mémoire Studio runtime listening at ${runtime.url}`));
        console.log(ui.dots("Status", `${runtime.url}/api/status`));
        console.log(ui.dots("Harnesses", `${runtime.url}/api/harnesses`));
        console.log();
      }

      if (opts.once) {
        await server.stop();
        return;
      }

      process.once("SIGINT", () => {
        void server.stop().finally(() => process.exit(0));
      });
      process.once("SIGTERM", () => {
        void server.stop().finally(() => process.exit(0));
      });
    });

  studio
    .command("run")
    .description("Run a Studio harness once and stream normalized events")
    .requiredOption("--prompt <text>", "Prompt for the harness")
    .option("--harness <id>", "Harness id")
    .option("--action <action>", "Studio action: compose, design-doc, audit, references, video, raw, app-build, self-design, research, fix, browser-audit, handoff", "compose")
    .option("--mode <mode>", "Execution mode: delegate or brokered", "delegate")
    .option("--cwd <path>", "Working directory")
    .option("--json", "Output final session as JSON")
    .action(async (opts: { prompt: string; harness?: StudioHarnessId; action?: StudioRunAction; mode?: StudioSessionMode; cwd?: string; json?: boolean }) => {
      await engine.init("minimal");
      const config = await loadStudioConfig(engine.config.projectRoot);
      const server = new StudioRuntimeServer({ projectRoot: engine.config.projectRoot, port: 0 });
      await server.start();

      try {
        const session = await server.startSession({
          harness: opts.harness ?? config.defaultHarness,
          cwd: opts.cwd ?? engine.config.projectRoot,
          prompt: opts.prompt,
          action: opts.action ?? "compose",
          mode: opts.mode ?? "delegate",
        });
        const finalSession = await waitForSession(server, session.id);
        if (opts.json) {
          console.log(JSON.stringify(finalSession, null, 2));
          return;
        }
        for (const event of finalSession.events) {
          if (event.type === "stdout" || event.type === "stderr") process.stdout.write(event.message);
        }
        console.log();
        console.log(finalSession.status === "completed" ? ui.ok("Studio run completed") : ui.fail(`Studio run ${finalSession.status}`));
      } finally {
        await server.stop();
      }
    });

  studio
    .command("visual-parity")
    .description("DEMO: write a canned dashboard fixture and grade it against the artifact checklist (not a rendering-quality measurement)")
    .option("--out <path>", "Output directory for preview, screenshot, spec, code, tokens, and handoff artifacts")
    .option("--json", "Output proof metadata as JSON")
    .action(async (opts: { out?: string; json?: boolean }) => {
      await engine.init("minimal");
      const proof = await createVisualParityProof({
        projectRoot: engine.config.projectRoot,
        outDir: opts.out,
      });
      const payload = {
        status: proof.grade.passed ? "completed" : "failed",
        proof,
      };

      if (opts.json) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }

      console.log(proof.grade.passed ? ui.ok("Visual parity demo fixture created") : ui.fail("Visual parity demo fixture incomplete"));
      console.log(ui.dim(`  ${proof.demoDisclaimer}`));
      console.log(ui.dots("Checklist score", `${proof.grade.score}/100`));
      console.log(ui.dots("Preview", proof.previewUrl));
      console.log(ui.dots("Artifacts", proof.outDir));
      if (proof.grade.missingCriteria.length > 0) {
        console.log(ui.warn(`Missing: ${proof.grade.missingCriteria.join(", ")}`));
      }
    });

  const browser = studio
    .command("browser")
    .description("Browser automation commands for the Studio Autonomous Lab");

  browser
    .command("status")
    .description("Show local Playwright browser adapter status")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      await engine.init("minimal");
      const config = await loadStudioConfig(engine.config.projectRoot);
      const adapter = new StudioBrowserAdapter({ projectRoot: engine.config.projectRoot });
      const status = await adapter.status(config.enabledTools.browser);
      if (opts.json) {
        console.log(JSON.stringify(status, null, 2));
        return;
      }
      console.log(ui.section("STUDIO BROWSER"));
      console.log(ui.dots("Enabled", String(status.enabled)));
      console.log(ui.dots("Playwright", status.installed ? "ready" : "missing"));
      console.log(ui.dots("Sessions", String(status.activeSessions)));
      console.log(ui.dim(status.message));
    });

  browser
    .command("open <url>")
    .description("Open a URL in a local Playwright browser session")
    .option("--json", "Output as JSON")
    .action(async (url: string, opts: { json?: boolean }) => {
      await engine.init("minimal");
      const config = await loadStudioConfig(engine.config.projectRoot);
      if (!config.enabledTools.browser) throw new Error("Browser tools are disabled in Studio config");
      const adapter = new StudioBrowserAdapter({ projectRoot: engine.config.projectRoot });
      const session = await adapter.createSession({ url });
      if (opts.json) {
        console.log(JSON.stringify({ session }, null, 2));
        return;
      }
      console.log(ui.ok(`Browser session ${session.id}`));
      console.log(ui.dots("URL", session.url));
      await adapter.closeAll();
    });

  studio
    .command("logs")
    .description("Read persisted Studio session logs from .memoire/studio/sessions")
    .option("--session <id>", "Session id to read")
    .option("--limit <count>", "Limit events for a session")
    .option("--follow", "Keep polling for new events")
    .option("--json", "Output logs as JSON")
    .action(async (opts: { session?: string; limit?: string; follow?: boolean; json?: boolean }) => {
      await engine.init("minimal");
      const store = new StudioSessionStore(engine.config.projectRoot);
      store.init();
      const limit = parseOptionalInt(opts.limit);

      if (!opts.session) {
        const payload = { sessions: store.listSessions() };
        if (opts.json) console.log(JSON.stringify(payload, null, 2));
        else printSessionList(payload.sessions);
        return;
      }

      const session = store.getSession(opts.session);
      const payload = {
        session,
        events: store.readSessionEvents(opts.session, { limit }),
      };
      if (opts.json) {
        console.log(JSON.stringify(payload, null, 2));
      } else {
        if (!session) console.log(ui.warn(`No indexed session for ${opts.session}`));
        printEvents(payload.events);
      }
      if (opts.follow) await followSessionLogs(store, opts.session, payload.events.length);
    });

  studio
    .command("tui")
    .description("Open the Mémoire Studio terminal dashboard")
    .option("--runtime <url>", "Attach to a running Studio runtime URL")
    .option("--session <id>", "Session id to focus")
    .option("--once", "Render one snapshot and exit")
    .action(async (opts: { runtime?: string; session?: string; once?: boolean }) => {
      await engine.init("minimal");
      if (opts.runtime) {
        const snapshot = await remoteTuiSnapshot(opts.runtime, opts.session);
        console.log(snapshot);
        return;
      }

      const render = async () => {
        const store = new StudioSessionStore(engine.config.projectRoot);
        store.init();
        const config = await loadStudioConfig(engine.config.projectRoot);
        const harnesses = listHarnesses(config);
        const sessions = store.listSessions();
        const selectedSession = opts.session ?? sessions[0]?.id;
        return renderStudioTuiSnapshot({
          workspaceLabel: "Memoire workspace",
          sessions,
          events: selectedSession ? store.readSessionEvents(selectedSession, { limit: 80 }) : [],
          harnesses,
          figma: { connectionState: "disconnected", clients: [], port: config.figma?.preferredPort ?? null },
        });
      };

      console.log(await render());
      if (opts.once || !process.stdin.isTTY) return;
      const timer = setInterval(() => {
        process.stdout.write("\x1b[2J\x1b[H");
        void render().then((snapshot) => process.stdout.write(`${snapshot}\n`));
      }, 2000);
      process.stdin.setRawMode?.(true);
      process.stdin.resume();
      process.stdin.on("data", (chunk: Buffer) => {
        if (chunk.toString("utf-8") === "q" || chunk[0] === 3) {
          clearInterval(timer);
          process.stdin.setRawMode?.(false);
          process.exit(0);
        }
      });
    });

  const automations = studio
    .command("automations")
    .description("Create and run Mémoire Studio design-harness automations");

  automations
    .command("list")
    .description("List Studio automations")
    .option("--project <path>", "Workspace root")
    .option("--json", "Output as JSON")
    .action(async (opts: { project?: string; json?: boolean }) => {
      await engine.init("minimal");
      const projectRoot = opts.project ?? engine.config.projectRoot;
      const store = new StudioAutomationStore(projectRoot);
      const automations = await store.list();
      if (opts.json) {
        console.log(JSON.stringify({ automations }, null, 2));
        return;
      }
      console.log(ui.section("STUDIO AUTOMATIONS"));
      if (automations.length === 0) {
        console.log(ui.skip("No automations configured"));
        return;
      }
      for (const automation of automations) {
        console.log(ui.dots(`${automation.name} (${automation.status})`, `${automation.id} / next ${automation.nextRunAt ?? "none"}`));
      }
    });

  automations
    .command("run <id>")
    .description("Run one Studio automation now")
    .option("--project <path>", "Workspace root")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: { project?: string; json?: boolean }) => {
      await engine.init("minimal");
      const projectRoot = opts.project ?? engine.config.projectRoot;
      const server = new StudioRuntimeServer({ projectRoot, port: 0 });
      await server.start();
      try {
        const run = await server.runAutomation(id);
        if (opts.json) {
          console.log(JSON.stringify({ run }, null, 2));
          return;
        }
        console.log(ui.ok(`Automation run ${run.status}`));
        console.log(ui.dots("Automation", run.automationId));
        console.log(ui.dots("Session", run.sessionId ?? "none"));
      } finally {
        await server.stop();
      }
    });

  automations
    .command("run-due")
    .description("Run all due Studio automations once")
    .option("--project <path>", "Workspace root")
    .option("--now <iso>", "Override current time for deterministic checks")
    .option("--json", "Output as JSON")
    .action(async (opts: { project?: string; now?: string; json?: boolean }) => {
      await engine.init("minimal");
      const projectRoot = opts.project ?? engine.config.projectRoot;
      const server = new StudioRuntimeServer({ projectRoot, port: 0 });
      await server.start();
      try {
        const runs = await server.runDueAutomations(opts.now);
        if (opts.json) {
          console.log(JSON.stringify({ runs }, null, 2));
          return;
        }
        console.log(ui.ok(`Ran ${runs.length} due automation${runs.length === 1 ? "" : "s"}`));
        for (const run of runs) console.log(ui.dots(run.automationId, run.status));
      } finally {
        await server.stop();
      }
    });

  const scheduler = automations
    .command("scheduler")
    .description("Manage the macOS user LaunchAgent for Studio automations");

  scheduler
    .command("status")
    .description("Show Studio automation scheduler status")
    .option("--project <path>", "Workspace root")
    .option("--runtime <path>", "Runtime binary path")
    .option("--json", "Output as JSON")
    .action(async (opts: { project?: string; runtime?: string; json?: boolean }) => {
      await engine.init("minimal");
      const status = schedulerStatus(opts.project ?? engine.config.projectRoot, opts.runtime ?? process.execPath);
      if (opts.json) {
        console.log(JSON.stringify({ scheduler: status }, null, 2));
        return;
      }
      console.log(ui.section("STUDIO AUTOMATION SCHEDULER"));
      console.log(ui.dots("Label", status.label));
      console.log(ui.dots("Installed", String(status.installed)));
      console.log(ui.dots("Plist", status.plistPath));
    });

  scheduler
    .command("install")
    .description("Install the macOS user LaunchAgent for Studio automations")
    .option("--project <path>", "Workspace root")
    .option("--runtime <path>", "Runtime binary path")
    .option("--json", "Output as JSON")
    .action(async (opts: { project?: string; runtime?: string; json?: boolean }) => {
      await engine.init("minimal");
      const status = await installScheduler(opts.project ?? engine.config.projectRoot, opts.runtime ?? process.execPath);
      if (opts.json) {
        console.log(JSON.stringify({ scheduler: status }, null, 2));
        return;
      }
      console.log(ui.ok(`Installed ${status.label}`));
      console.log(ui.dots("Plist", status.plistPath));
    });

  scheduler
    .command("uninstall")
    .description("Uninstall the macOS user LaunchAgent for Studio automations")
    .option("--project <path>", "Workspace root")
    .option("--runtime <path>", "Runtime binary path")
    .option("--json", "Output as JSON")
    .action(async (opts: { project?: string; runtime?: string; json?: boolean }) => {
      await engine.init("minimal");
      const status = await uninstallScheduler(opts.project ?? engine.config.projectRoot, opts.runtime ?? process.execPath);
      if (opts.json) {
        console.log(JSON.stringify({ scheduler: status }, null, 2));
        return;
      }
      console.log(ui.ok(`Uninstalled ${status.label}`));
    });

  studio
    .command("web")
    .description("Start the Studio web trial UI backed by the local runtime")
    .option("-p, --port <port>", "Studio web UI port", "1420")
    .option("--runtime-port <port>", "Studio runtime API port", "8765")
    .action(async (opts: { port?: string; runtimePort?: string }) => {
      await engine.init("minimal");
      const appDir = join(engine.config.projectRoot, "apps", "studio");

      if (!existsSync(join(appDir, "package.json"))) {
        await servePackagedStudioWeb(engine.config.projectRoot, opts);
        return;
      }

      const runtime = new StudioRuntimeServer({
        projectRoot: engine.config.projectRoot,
        port: parsePort(opts.runtimePort ?? "8765"),
      });
      const runtimeInfo = await runtime.start();

      console.log(ui.ok(`Studio runtime listening at ${runtimeInfo.url}`));
      console.log(ui.active("Starting Studio web trial..."));
      const child = spawn("npm", ["--prefix", appDir, "run", "dev", "--", "--host", "127.0.0.1", "--port", String(parsePort(opts.port ?? "1420"))], {
        stdio: "inherit",
        env: { ...process.env, VITE_MEMOIRE_STUDIO_RUNTIME: runtimeInfo.url },
        shell: false,
      });

      const shutdown = () => {
        child.kill("SIGTERM");
        void runtime.stop().finally(() => process.exit(0));
      };
      process.once("SIGINT", shutdown);
      process.once("SIGTERM", shutdown);
      child.on("exit", () => {
        void runtime.stop().finally(() => process.exit(0));
      });
    });
}

async function servePackagedStudioWeb(projectRoot: string, opts: { port?: string; runtimePort?: string }): Promise<void> {
  const server = new StudioRuntimeServer({
    projectRoot,
    port: parsePort(opts.port ?? opts.runtimePort ?? "1420"),
  });
  const runtime = await server.start();

  console.log(ui.ok(`Studio web trial available at ${runtime.url}`));
  console.log(ui.dots("Mode", "packaged static app"));
  console.log(ui.dots("Runtime", `${runtime.url}/api/status`));

  process.once("SIGINT", () => {
    void server.stop().finally(() => process.exit(0));
  });
  process.once("SIGTERM", () => {
    void server.stop().finally(() => process.exit(0));
  });
}

function parsePort(value: string): number {
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}

async function waitForSession(server: StudioRuntimeServer, sessionId: string): Promise<StudioSession> {
  for (;;) {
    const session = server.getSession(sessionId);
    if (!session) throw new Error(`Unknown Studio session: ${sessionId}`);
    if (session.status !== "running") return session;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function parseOptionalInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function printSessionList(sessions: ReturnType<StudioSessionStore["listSessions"]>): void {
  console.log(ui.section("STUDIO LOGS"));
  if (sessions.length === 0) {
    console.log(ui.skip("No Studio sessions indexed"));
    return;
  }
  for (const session of sessions.slice(0, 20)) {
    console.log(ui.dots(`${session.harness} / ${session.action}`, `${session.id} (${session.status})`));
  }
}

function printEvents(events: StudioEvent[]): void {
  for (const event of events) {
    const symbol = event.type === "session_error" || event.type === "stderr" ? "x" : event.type === "session_done" ? "+" : "·";
    console.log(ui.event(symbol, event.type, event.message.replace(/\s+/g, " ").trim()));
  }
}

async function followSessionLogs(store: StudioSessionStore, sessionId: string, offset: number): Promise<void> {
  let seen = offset;
  await new Promise<void>((resolveFollow) => {
    const timer = setInterval(() => {
      const events = store.readSessionEvents(sessionId);
      const next = events.slice(seen);
      seen = events.length;
      printEvents(next);
    }, 1000);
    process.once("SIGINT", () => {
      clearInterval(timer);
      resolveFollow();
    });
    process.once("SIGTERM", () => {
      clearInterval(timer);
      resolveFollow();
    });
  });
}

async function remoteTuiSnapshot(runtimeUrl: string, sessionId?: string): Promise<string> {
  const base = runtimeUrl.replace(/\/$/, "");
  const [status, harnesses, logs] = await Promise.all([
    fetch(`${base}/api/status`).then((res) => res.json()),
    fetch(`${base}/api/harnesses`).then((res) => res.json()),
    fetch(`${base}/api/logs`).then((res) => res.json()),
  ]);
  const selectedSession = sessionId ?? logs.sessions?.[0]?.id;
  const detail = selectedSession
    ? await fetch(`${base}/api/logs/${encodeURIComponent(selectedSession)}?limit=80`).then((res) => res.ok ? res.json() : { events: [] })
    : { events: [] };
  return renderStudioTuiSnapshot({
    workspaceLabel: "Memoire workspace",
    sessions: logs.sessions ?? [],
    events: detail.events ?? [],
    harnesses: harnesses.harnesses ?? [],
    figma: {
      connectionState: status.config?.figma ? "disconnected" : "disconnected",
      clients: [],
      port: status.config?.figma?.preferredPort ?? null,
    },
  });
}
