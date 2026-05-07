import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Command } from "commander";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { registerMermaidJamCommand } from "../mermaid-jam.js";
import { captureLogs, lastLog } from "./test-helpers.js";

let projectRoot: string;
let fixtureRoot: string;

beforeEach(async () => {
  projectRoot = join(tmpdir(), `memoire-mermaid-jam-corpus-command-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fixtureRoot = join(projectRoot, "fixture-source");
  await mkdir(join(fixtureRoot, "docs"), { recursive: true });
  await writeFile(join(fixtureRoot, "README.md"), "# Checkout\n\n- Open cart\n- Review total\n- Pay\n", "utf-8");
  await writeFile(join(fixtureRoot, "docs", "journey.mdx"), "```mermaid\njourney\n  title Checkout\n```\n", "utf-8");
  await writeFile(join(fixtureRoot, "docs", "skip.ts"), "export {}\n", "utf-8");
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

describe("mermaid-jam corpus command", () => {
  it("sets up and reports the curated markdown corpus in JSON mode", async () => {
    const logs = captureLogs();
    const program = new Command();

    registerMermaidJamCommand(program, makeEngine(projectRoot) as never);
    await program.parseAsync(["mermaid-jam", "corpus", "sync", "--setup", "--json", "--fixture-source", fixtureRoot], { from: "user" });
    const synced = JSON.parse(lastLog(logs));

    await program.parseAsync(["mermaid-jam", "corpus", "status", "--json"], { from: "user" });
    const status = JSON.parse(lastLog(logs));

    expect(synced.status).toBe("ready");
    expect(status.status).toBe("ready");
    expect(status.repos[0]).toMatchObject({
      repo: "fixture/docs",
      license: "MIT",
      files: 2,
      skipped: 1,
    });
  });

  it("analyzes markdown for FigJam-ready candidates in JSON mode", async () => {
    const logs = captureLogs();
    const program = new Command();
    const sourcePath = join(projectRoot, "flow.md");
    await writeFile(sourcePath, "# Support flow\n\n- Triage issue\n- Assign owner\n- Resolve\n", "utf-8");

    registerMermaidJamCommand(program, makeEngine(projectRoot) as never);
    await program.parseAsync(["mermaid-jam", "analyze", sourcePath, "--json"], { from: "user" });

    const payload = JSON.parse(lastLog(logs));
    expect(payload.status).toBe("ready");
    expect(payload.candidates[0]).toMatchObject({
      title: "Support flow",
      sourcePath,
      kind: "checklist-to-flow",
    });
    expect(payload.candidates[0].cleanSource).toContain("flowchart TD");
  });
});

function makeEngine(root: string) {
  return {
    config: { projectRoot: root },
    async init() {},
  };
}
