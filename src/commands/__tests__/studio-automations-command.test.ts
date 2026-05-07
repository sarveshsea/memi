import { Command } from "commander";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerStudioCommand } from "../studio.js";
import { StudioAutomationStore, createAutomationFromTemplate } from "../../studio/automations.js";

const logs: string[] = [];
let originalLog: typeof console.log;

beforeEach(() => {
  logs.length = 0;
  originalLog = console.log;
  console.log = vi.fn((...args: unknown[]) => {
    logs.push(args.join(" "));
  }) as typeof console.log;
});

afterEach(() => {
  console.log = originalLog;
});

describe("studio automations CLI", () => {
  it("lists automations as JSON and reports scheduler status", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-studio-automation-cli-"));
    try {
      const store = new StudioAutomationStore(root);
      const automation = await store.create(createAutomationFromTemplate({
        templateId: "design-system-audit",
        cwd: root,
        timezone: "America/Chicago",
      }));

      const program = new Command();
      registerStudioCommand(program, makeEngine(root) as never);
      await program.parseAsync(["studio", "automations", "list", "--project", root, "--json"], { from: "user" });

      expect(JSON.parse(logs.join("\n"))).toMatchObject({
        automations: [expect.objectContaining({ id: automation.id, harness: "codex" })],
      });

      logs.length = 0;
      await program.parseAsync(["studio", "automations", "scheduler", "status", "--project", root, "--json"], { from: "user" });
      expect(JSON.parse(logs.join("\n"))).toMatchObject({
        scheduler: {
          label: expect.stringContaining("cv.memoire.studio.automations"),
          installed: expect.any(Boolean),
        },
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

function makeEngine(projectRoot: string) {
  return {
    config: { projectRoot },
    async init() {},
  };
}
