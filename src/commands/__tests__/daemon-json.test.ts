import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { Command } from "commander";
import { registerDaemonCommand } from "../daemon.js";
import { captureLogs, lastLog } from "./test-helpers.js";

let projectRoot: string;

beforeEach(async () => {
  projectRoot = join(tmpdir(), `memoire-daemon-json-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(join(projectRoot, ".memoire"), { recursive: true });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(projectRoot, { recursive: true, force: true });
});

describe("daemon status --json", () => {
  it("emits a stopped payload when no status file exists", async () => {
    const logs = captureLogs();
    const program = new Command();

    registerDaemonCommand(program, makeDaemonEngine(projectRoot) as never);
    await program.parseAsync(["daemon", "status", "--json"], { from: "user" });

    const payload = JSON.parse(lastLog(logs));
    expect(payload).toEqual({
      action: "status",
      status: "stopped",
      reason: "missing-status-file",
      daemon: null,
      cleanup: { performed: false },
    });
  });

  it("emits runtime details for a live daemon", async () => {
    const logs = captureLogs();
    const program = new Command();
    const startedAt = "2026-03-27T18:00:00.000Z";

    await writeFile(
      join(projectRoot, ".memoire", "daemon.json"),
      JSON.stringify({
        pid: 12345,
        port: 5173,
        figmaPort: 9223,
        dashboardPort: 0,
        startedAt,
      }, null, 2),
      "utf-8",
    );

    vi.spyOn(process, "kill").mockImplementation(((pid: number, signal?: number | NodeJS.Signals) => {
      if (pid === 12345 && signal === 0) return true;
      throw new Error("unexpected kill");
    }) as typeof process.kill);
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-03-27T18:01:05.000Z").getTime());

    registerDaemonCommand(program, makeDaemonEngine(projectRoot, 2) as never);
    await program.parseAsync(["daemon", "status", "--json"], { from: "user" });

    const payload = JSON.parse(lastLog(logs));
    expect(payload).toMatchObject({
      action: "status",
      status: "running",
      cleanup: { performed: false },
      daemon: {
        pid: 12345,
        port: 5173,
        figmaPort: 9223,
        dashboardPort: 0,
        startedAt,
        alive: true,
        figmaConnected: true,
        previewUrl: "http://localhost:5173",
        uptimeHuman: "1m 5s",
      },
    });
    expect(payload.daemon.uptimeSeconds).toBeCloseTo(65, 3);
  });

  it("cleans up stale daemon state and reports it", async () => {
    const logs = captureLogs();
    const program = new Command();

    await writeFile(
      join(projectRoot, ".memoire", "daemon.json"),
      JSON.stringify({
        pid: 99999,
        port: 5173,
        figmaPort: 9223,
        dashboardPort: 0,
        startedAt: "2026-03-27T18:00:00.000Z",
      }, null, 2),
      "utf-8",
    );

    vi.spyOn(process, "kill").mockImplementation(((pid: number, signal?: number | NodeJS.Signals) => {
      if (pid === 99999 && signal === 0) {
        throw new Error("ESRCH");
      }
      throw new Error("unexpected kill");
    }) as typeof process.kill);

    registerDaemonCommand(program, makeDaemonEngine(projectRoot) as never);
    await program.parseAsync(["daemon", "status", "--json"], { from: "user" });

    const payload = JSON.parse(lastLog(logs));
    expect(payload).toMatchObject({
      action: "status",
      status: "stale-cleaned",
      reason: "stale-process",
      cleanup: { performed: true },
      daemon: {
        pid: 99999,
        alive: false,
        figmaConnected: false,
        previewUrl: "http://localhost:5173",
      },
    });

    await expect(stat(join(projectRoot, ".memoire", "daemon.json"))).rejects.toThrow();
  });

  it("stops a live daemon and removes state", async () => {
    const logs = captureLogs();
    const program = new Command();
    const startedAt = "2026-03-27T18:00:00.000Z";

    await writeFile(
      join(projectRoot, ".memoire", "daemon.json"),
      JSON.stringify({
        pid: 54321,
        port: 5173,
        figmaPort: 9223,
        dashboardPort: 0,
        runtimeUrl: "http://localhost:5173",
        projectRoot,
        startedAt,
      }, null, 2),
      "utf-8",
    );

    const kill = vi.spyOn(process, "kill").mockImplementation(((pid: number, signal?: number | NodeJS.Signals) => {
      if (pid === 54321 && signal === "SIGTERM") return true;
      if (pid === 54321 && signal === 0) return true;
      throw new Error("unexpected kill");
    }) as typeof process.kill);

    registerDaemonCommand(program, makeDaemonEngine(projectRoot) as never);
    await program.parseAsync(["daemon", "stop", "--json"], { from: "user" });

    const payload = JSON.parse(lastLog(logs));
    expect(payload).toMatchObject({
      action: "stop",
      status: "stopped",
      cleanup: { performed: true },
      daemon: {
        pid: 54321,
        alive: true,
        runtimeUrl: "http://localhost:5173",
        projectRoot,
      },
    });
    expect(kill).toHaveBeenCalledWith(54321, "SIGTERM");
    await expect(stat(join(projectRoot, ".memoire", "daemon.json"))).rejects.toThrow();
  });
});

function makeDaemonEngine(projectRootPath: string, connectedClients = 0) {
  return {
    config: { projectRoot: projectRootPath },
    figma: {
      wsServer: {
        connectedClients: Array.from({ length: connectedClients }, () => ({})),
      },
    },
  };
}
