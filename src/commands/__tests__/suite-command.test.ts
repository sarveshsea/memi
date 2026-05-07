import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Command } from "commander";
import { registerSuiteCommand } from "../suite.js";
import { captureLogs, lastLog } from "./test-helpers.js";

let projectRoot: string;

beforeEach(async () => {
  projectRoot = join(tmpdir(), `memoire-suite-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(projectRoot, { recursive: true });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(projectRoot, { recursive: true, force: true });
});

describe("suite command", () => {
  it("writes memoire.agent.yaml with native runtime recipes", async () => {
    const logs = captureLogs();
    const program = new Command();
    registerSuiteCommand(program, makeSuiteEngine(projectRoot) as never);

    await program.parseAsync(["suite", "init", "--project", projectRoot, "--json"], { from: "user" });

    const payload = JSON.parse(lastLog(logs));
    expect(payload).toMatchObject({
      action: "init",
      status: "created",
      manifestPath: join(projectRoot, "memoire.agent.yaml"),
      recipes: ["design-audit", "tailwind-cleanup", "product-handoff", "research-vibe-design"],
    });
    const manifest = await readFile(join(projectRoot, "memoire.agent.yaml"), "utf-8");
    expect(manifest).toContain("schemaVersion: 1");
    expect(manifest).toContain("harnesses:");
    expect(manifest).toContain("memi daemon status --json");
    expect(manifest).toContain("research-vibe-design");
  });

  it("doctors an initialized suite manifest", async () => {
    const initProgram = new Command();
    registerSuiteCommand(initProgram, makeSuiteEngine(projectRoot) as never);
    await initProgram.parseAsync(["suite", "init", "--project", projectRoot, "--json"], { from: "user" });

    vi.restoreAllMocks();
    const logs = captureLogs();
    const doctorProgram = new Command();
    registerSuiteCommand(doctorProgram, makeSuiteEngine(projectRoot) as never);
    await doctorProgram.parseAsync(["suite", "doctor", "--project", projectRoot, "--json"], { from: "user" });

    const payload = JSON.parse(lastLog(logs));
    expect(payload).toMatchObject({
      status: "ready",
      recipes: ["design-audit", "tailwind-cleanup", "product-handoff", "research-vibe-design"],
    });
    expect(payload.checks.every((check: { status: string }) => check.status === "pass")).toBe(true);
  });

  it("prints a suite recipe payload for agent execution", async () => {
    const initProgram = new Command();
    registerSuiteCommand(initProgram, makeSuiteEngine(projectRoot) as never);
    await initProgram.parseAsync(["suite", "init", "--project", projectRoot, "--json"], { from: "user" });

    vi.restoreAllMocks();
    const logs = captureLogs();
    const runProgram = new Command();
    registerSuiteCommand(runProgram, makeSuiteEngine(projectRoot) as never);
    await runProgram.parseAsync(["suite", "run", "design-audit", "--project", projectRoot, "--json"], { from: "user" });

    const payload = JSON.parse(lastLog(logs));
    expect(payload).toMatchObject({
      action: "run",
      status: "ready",
      recipe: {
        id: "design-audit",
        title: "Design Audit",
      },
    });
    expect(payload.recipe.commands).toContain("memi daemon status --json");
  });
});

function makeSuiteEngine(projectRootPath: string) {
  return {
    config: { projectRoot: projectRootPath },
  };
}
