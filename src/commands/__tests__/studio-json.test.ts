import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { registerStudioCommand } from "../studio.js";
import { captureLogs, lastLog } from "./test-helpers.js";

let projectRoot: string;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), "memoire-studio-command-"));
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(projectRoot, { recursive: true, force: true });
});

describe("studio command JSON", () => {
  it("emits Studio status with config and harness metadata", async () => {
    const logs = captureLogs();
    const program = new Command();

    registerStudioCommand(program, makeEngine(projectRoot) as never);
    await program.parseAsync(["studio", "status", "--json"], { from: "user" });

    const payload = JSON.parse(lastLog(logs));
    expect(payload.status).toBe("ready");
    expect(payload.projectRoot).toBe(projectRoot);
    expect(payload.config.defaultHarness).toBe("codex");
    expect(payload.harnesses.map((harness: { id: string }) => harness.id)).toContain("claude-code");
  });

  it("prints serve runtime metadata in JSON mode", async () => {
    const logs = captureLogs();
    const program = new Command();

    registerStudioCommand(program, makeEngine(projectRoot) as never);
    await program.parseAsync(["studio", "serve", "--port", "0", "--json", "--once"], { from: "user" });

    const payload = JSON.parse(lastLog(logs));
    expect(payload.status).toBe("running");
    expect(payload.runtime.url).toMatch(/^http:\/\/127\.0\.0\.1:/);
  });

  it("accepts action-specific Studio runs", async () => {
    const program = new Command();

    registerStudioCommand(program, makeEngine(projectRoot) as never);
    const command = program.commands.find((candidate) => candidate.name() === "studio");
    const run = command?.commands.find((candidate) => candidate.name() === "run");

    expect(run?.options.map((option) => option.long)).toContain("--action");
  });

  it("creates a visual parity proof artifact set in JSON mode", async () => {
    const logs = captureLogs();
    const program = new Command();
    const outDir = join(projectRoot, "visual-proof");

    registerStudioCommand(program, makeEngine(projectRoot) as never);
    await program.parseAsync(["studio", "visual-parity", "--out", outDir, "--json"], { from: "user" });

    const payload = JSON.parse(lastLog(logs));
    expect(payload.status).toBe("completed");
    expect(payload.proof).toMatchObject({
      mode: "demo-fixture",
      liveHarness: false,
      outDir,
      grade: {
        passed: true,
        score: 100,
        missingCriteria: [],
      },
    });
    expect(payload.proof.previewUrl).toMatch(/^file:\/\//);
    await expect(readFile(join(outDir, "dashboard-preview.html"), "utf-8")).resolves.toContain("Growth operating room");
    await expect(readFile(join(outDir, "dashboard-screenshot.svg"), "utf-8")).resolves.toContain("<svg");
  });
});

function makeEngine(root: string) {
  return {
    config: { projectRoot: root },
    async init() {},
  };
}
