import { afterEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerScaffoldCommand } from "../scaffold.js";
import { captureLogs, lastLog } from "./test-helpers.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("scaffold command", () => {
  it("emits a dry-run JSON component scaffold plan by default", async () => {
    const logs = captureLogs();
    const program = new Command();

    registerScaffoldCommand(program, makeScaffoldEngine() as never);
    await program.parseAsync([
      "scaffold",
      "component",
      "RevenueCard",
      "--level",
      "organism",
      "--purpose",
      "Show revenue evidence",
      "--base",
      "Card",
      "Badge",
      "--composes",
      "MetricValue",
      "--json",
    ], { from: "user" });

    const payload = JSON.parse(lastLog(logs));
    expect(payload).toMatchObject({
      action: "scaffold_agent_design_files",
      status: "planned",
      dryRun: true,
      approved: false,
      specPath: "specs/components/RevenueCard.json",
      generationCommand: "memi generate RevenueCard --preview --json",
    });
    expect(payload.spec.shadcnBase).toEqual(["Card", "Badge"]);
  });

  it("writes the scaffolded spec only when --write is present", async () => {
    const logs = captureLogs();
    const saved: unknown[] = [];
    const program = new Command();

    registerScaffoldCommand(program, makeScaffoldEngine(saved) as never);
    await program.parseAsync([
      "scaffold",
      "page",
      "DesignCiPage",
      "--layout",
      "dashboard",
      "--section",
      "Hero:AgentCiHero:full-width",
      "--write",
      "--json",
    ], { from: "user" });

    const payload = JSON.parse(lastLog(logs));
    expect(payload.status).toBe("written");
    expect(payload.dryRun).toBe(false);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      type: "page",
      name: "DesignCiPage",
      sections: [{ name: "Hero", component: "AgentCiHero", layout: "full-width" }],
    });
  });
});

function makeScaffoldEngine(saved: unknown[] = []) {
  return {
    config: {
      projectRoot: "/repo",
    },
    async init() {},
    registry: {
      async saveSpec(spec: unknown) {
        saved.push(spec);
      },
    },
  };
}
