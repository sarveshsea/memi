import type { Command } from "commander";
import type { MemoireEngine } from "../engine/core.js";
import {
  APPLE_DESIGN_BRIEF_DETAILS,
  APPLE_DESIGN_BRIEF_PLATFORMS,
  buildAppleDesignBrief,
  type AppleDesignBriefDetail,
  type AppleDesignBriefPlatform,
} from "../ios/apple-design-brief.js";
import {
  buildSwiftUiScaffoldPlan,
  SWIFTUI_ATOMIC_LEVELS,
  SWIFTUI_SCAFFOLD_KINDS,
  writeSwiftUiScaffold,
  type SwiftUiAtomicLevel,
  type SwiftUiScaffoldKind,
} from "../ios/swiftui-scaffold.js";
import { ui } from "../tui/format.js";

export function registerIosCommand(program: Command, engine: MemoireEngine): void {
  const ios = program.command("ios").description("Prepare and scaffold agent-verifiable SwiftUI workflows");

  ios.command("brief")
    .description("Prepare a compact Apple-platform design and verification brief")
    .option("--platform <platform>", `Platform: ${APPLE_DESIGN_BRIEF_PLATFORMS.join(" or ")}`, "ios")
    .option("--intent <text>", "Product or design intent")
    .option("--detail <detail>", `Detail: ${APPLE_DESIGN_BRIEF_DETAILS.join(", ")}`, "standard")
    .option("--json", "Output structured JSON")
    .action((opts: { platform: AppleDesignBriefPlatform; intent?: string; detail: AppleDesignBriefDetail; json?: boolean }) => {
      try {
        requireChoice(opts.platform, APPLE_DESIGN_BRIEF_PLATFORMS, "platform");
        requireChoice(opts.detail, APPLE_DESIGN_BRIEF_DETAILS, "detail");
        const brief = buildAppleDesignBrief({
          projectRoot: engine.config.projectRoot,
          platform: opts.platform,
          intent: opts.intent,
          detail: opts.detail,
        });
        if (opts.json) console.log(JSON.stringify(brief, null, 2));
        else {
          console.log();
          console.log(ui.section("APPLE DESIGN BRIEF"));
          console.log(ui.dots("platform", brief.platform));
          console.log(ui.dots("skills", brief.skillTriggers.join(", ")));
          console.log(ui.dots("first", brief.preflightCommands[0]));
          console.log();
        }
      } catch (error) {
        reportFailure("prepare_apple_design_brief", error, Boolean(opts.json));
      }
    });

  ios.command("scaffold <name>")
    .description("Preview or write SwiftUI spec, view, model, preview, and test files")
    .requiredOption("--module <name>", "Swift module imported by the generated test")
    .option("--kind <kind>", `Kind: ${SWIFTUI_SCAFFOLD_KINDS.join(" or ")}`, "screen")
    .option("--level <level>", `Component level: ${SWIFTUI_ATOMIC_LEVELS.join(", ")}`, "molecule")
    .option("--intent <text>", "Product or design intent")
    .option("--deployment-target <version>", "Minimum iOS deployment target", "17.0")
    .option("--output-root <path>", "Workspace-relative Swift source root", "Sources")
    .option("--tests-root <path>", "Workspace-relative Swift test root", "Tests")
    .option("--liquid-glass", "Include an iOS 26+ Liquid Glass path with fallback")
    .option("--write", "Write files. Omit for a dry-run plan.")
    .option("--json", "Output structured JSON")
    .action(async (name: string, opts: {
      module: string;
      kind: SwiftUiScaffoldKind;
      level: SwiftUiAtomicLevel;
      intent?: string;
      deploymentTarget: string;
      outputRoot: string;
      testsRoot: string;
      liquidGlass?: boolean;
      write?: boolean;
      json?: boolean;
    }) => {
      try {
        requireChoice(opts.kind, SWIFTUI_SCAFFOLD_KINDS, "kind");
        requireChoice(opts.level, SWIFTUI_ATOMIC_LEVELS, "level");
        const plan = buildSwiftUiScaffoldPlan({
          projectRoot: engine.config.projectRoot,
          name,
          kind: opts.kind,
          moduleName: opts.module,
          atomicLevel: opts.level,
          intent: opts.intent,
          deploymentTarget: opts.deploymentTarget,
          outputRoot: opts.outputRoot,
          testsRoot: opts.testsRoot,
          liquidGlass: Boolean(opts.liquidGlass),
          dryRun: !opts.write,
          approved: Boolean(opts.write),
        });
        const result = opts.write ? await writeSwiftUiScaffold(plan) : plan;
        if (opts.json) console.log(JSON.stringify(result, null, 2));
        else {
          console.log();
          console.log(opts.write ? ui.ok("SwiftUI scaffold written") : ui.section("SWIFTUI SCAFFOLD DRY RUN"));
          console.log(ui.dots("files", String(result.files.length)));
          console.log(ui.dots("level", result.atomicLevel));
          console.log(ui.dots("next", result.verificationCommands[0]));
          console.log();
        }
      } catch (error) {
        reportFailure("scaffold_swiftui_files", error, Boolean(opts.json));
      }
    });
}

function requireChoice<T extends string>(value: string, allowed: readonly T[], label: string): asserts value is T {
  if (!allowed.includes(value as T)) throw new Error(`Unknown ${label} "${value}". Use one of: ${allowed.join(", ")}.`);
}

function reportFailure(action: string, error: unknown, json: boolean): void {
  const message = error instanceof Error ? error.message : String(error);
  if (json) console.log(JSON.stringify({ action, status: "failed", error: { message } }, null, 2));
  else console.log(ui.fail(message));
  process.exitCode = 1;
}
