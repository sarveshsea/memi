import type { Command } from "commander";
import type { MemoireEngine } from "../engine/core.js";
import { ui } from "../tui/format.js";
import {
  buildAgentFileScaffoldPlan,
  markAgentFileScaffoldWritten,
  parseAgentFileScaffoldSection,
  type AgentFileScaffoldSection,
} from "../scaffold/agent-file-scaffold.js";

export function registerScaffoldCommand(program: Command, engine: MemoireEngine): void {
  const scaffold = program
    .command("scaffold")
    .description("Preview or write spec-first Atomic Design files for agent design CI");

  scaffold
    .command("component <name>")
    .description("Preview or write a component spec scaffold")
    .option("-l, --level <level>", "Atomic Design level: atom, molecule, organism, or template")
    .option("-p, --purpose <text>", "Component purpose")
    .option("--intent <text>", "Agent task or product intent behind the scaffold")
    .option("-b, --base <components...>", "shadcn base components", ["Card"])
    .option("--composes <specs...>", "Component specs this scaffold composes")
    .option("--write", "Write the spec file. Omit for a dry-run JSON plan.")
    .option("--json", "Output structured JSON")
    .action(async (name: string, opts: {
      level?: "atom" | "molecule" | "organism" | "template";
      purpose?: string;
      intent?: string;
      base?: string[];
      composes?: string[];
      write?: boolean;
      json?: boolean;
    }) => {
      await runScaffold({
        engine,
        json: Boolean(opts.json),
        build: () => buildAgentFileScaffoldPlan({
          projectRoot: engine.config.projectRoot,
          kind: "component",
          name,
          level: opts.level,
          purpose: opts.purpose,
          intent: opts.intent,
          shadcnBase: opts.base,
          composesSpecs: opts.composes,
          dryRun: !opts.write,
          approved: Boolean(opts.write),
        }),
        write: Boolean(opts.write),
      });
    });

  scaffold
    .command("page <name>")
    .description("Preview or write a page spec scaffold")
    .option("-l, --layout <layout>", "Page layout", "dashboard")
    .option("-p, --purpose <text>", "Page purpose")
    .option("--intent <text>", "Agent task or product intent behind the scaffold")
    .option("--section <section...>", "Section as Name:Component[:layout]")
    .option("--write", "Write the spec file. Omit for a dry-run JSON plan.")
    .option("--json", "Output structured JSON")
    .action(async (name: string, opts: {
      layout?: "sidebar-main" | "full-width" | "centered" | "split" | "dashboard" | "marketing";
      purpose?: string;
      intent?: string;
      section?: string[];
      write?: boolean;
      json?: boolean;
    }) => {
      await runScaffold({
        engine,
        json: Boolean(opts.json),
        build: () => buildAgentFileScaffoldPlan({
          projectRoot: engine.config.projectRoot,
          kind: "page",
          name,
          layout: opts.layout,
          purpose: opts.purpose,
          intent: opts.intent,
          sections: parseSections(opts.section ?? []),
          dryRun: !opts.write,
          approved: Boolean(opts.write),
        }),
        write: Boolean(opts.write),
      });
    });
}

async function runScaffold(input: {
  engine: MemoireEngine;
  json: boolean;
  write: boolean;
  build: () => ReturnType<typeof buildAgentFileScaffoldPlan>;
}): Promise<void> {
  try {
    await input.engine.init();
    const plan = input.build();
    const result = input.write
      ? markAgentFileScaffoldWritten(plan)
      : plan;

    if (input.write) {
      await input.engine.registry.saveSpec(plan.spec);
    }

    if (input.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log();
    console.log(input.write ? ui.ok("Scaffold written") : ui.section("SCAFFOLD DRY RUN"));
    console.log(ui.dots("spec", result.specPath));
    console.log(ui.dots("level", result.atomicLevel));
    console.log(ui.dots("next", result.generationCommand));
    console.log();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (input.json) {
      console.log(JSON.stringify({
        action: "scaffold_agent_design_files",
        status: "failed",
        error: { message },
      }, null, 2));
    } else {
      console.log(ui.fail(message));
    }
    process.exitCode = 1;
  }
}

function parseSections(values: string[]): AgentFileScaffoldSection[] {
  return values.map((value) => parseAgentFileScaffoldSection(value));
}
