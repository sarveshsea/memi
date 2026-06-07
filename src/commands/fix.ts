import type { Command } from "commander";
import type { MemoireEngine } from "../engine/core.js";
import { applyUiFixPlan, buildUiFixPlan, type ApplyUiFixResult, type UiFixPlan } from "../app-quality/fix-plan.js";
import { ui } from "../tui/format.js";

interface FixPlanOptions {
  json?: boolean;
  maxFiles?: string;
  noWrite?: boolean;
}

export function registerFixCommand(program: Command, engine: MemoireEngine): void {
  const fix = program
    .command("fix")
    .description("Plan and apply safe UI quality fixes")
    .addHelpText("after", [
      "",
      "Examples:",
      "  memi fix plan",
      "  memi fix plan ./src --json",
      "  memi fix apply --yes",
    ].join("\n"));

  fix
    .command("plan [target]")
    .description("Generate a dry-run UI fix plan without modifying source files")
    .option("--json", "Output stable JSON")
    .option("--max-files <count>", "Maximum source files to scan", "500")
    .option("--no-write", "Do not write .memoire/app-quality/fix-plan reports")
    .action(async (target: string | undefined, opts: FixPlanOptions) => {
      const maxFiles = Number.parseInt(opts.maxFiles ?? "500", 10);
      const plan = await buildUiFixPlan({
        projectRoot: engine.config.projectRoot,
        target,
        maxFiles: Number.isFinite(maxFiles) ? maxFiles : 500,
        write: opts.noWrite ? false : true,
      });

      if (opts.json) {
        console.log(JSON.stringify(plan, null, 2));
        return;
      }

      printFixPlan(plan, opts.noWrite !== true);
    });

  fix
    .command("apply [target]")
    .description("Apply only safe mechanical UI fixes")
    .option("--yes", "Confirm source-file writes")
    .option("--json", "Output stable JSON")
    .option("--max-files <count>", "Maximum source files to scan", "500")
    .action(async (target: string | undefined, opts: { yes?: boolean; json?: boolean; maxFiles?: string }) => {
      const maxFiles = Number.parseInt(opts.maxFiles ?? "500", 10);
      const result = await applyUiFixPlan({
        projectRoot: engine.config.projectRoot,
        target,
        maxFiles: Number.isFinite(maxFiles) ? maxFiles : 500,
        yes: opts.yes,
      });

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      printApplyResult(result);
      if (result.status === "blocked") process.exitCode = 1;
    });
}

function printFixPlan(plan: UiFixPlan, wroteReports: boolean): void {
  console.log(ui.brand("Memoire UI Fix Plan"));
  console.log(ui.dots("Target", plan.target));
  console.log(ui.dots("Patches", String(plan.summary.patchCount)));
  console.log(ui.dots("Safe", String(plan.summary.safePatchCount)));
  console.log(ui.dots("Review", String(plan.summary.reviewPatchCount)));
  console.log(ui.dots("Manual", String(plan.summary.manualPatchCount)));
  console.log(ui.dots("UX", `${plan.ux.score}/100`));
  console.log();

  if (plan.patches.length === 0) {
    console.log(ui.ok("No fix plan generated from the current diagnosis."));
  } else {
    for (const patch of plan.patches.slice(0, 8)) {
      console.log(`  [${patch.risk.toUpperCase()} ${patch.category}] ${patch.title}`);
      console.log(ui.dim(`      ${patch.rationale}`));
      if (patch.affectedFiles[0]) console.log(ui.dim(`      file: ${patch.affectedFiles[0]}`));
    }
  }

  console.log();
  console.log(ui.guide("memi fix apply --yes", "apply only writeSafe mechanical patches"));
  if (wroteReports) {
    console.log(ui.dim("  Reports written to .memoire/app-quality/fix-plan.{json,md}"));
  }
  console.log();
}

function printApplyResult(result: ApplyUiFixResult): void {
  console.log(ui.brand("Memoire UI Fix Apply"));
  console.log(ui.dots("Status", result.status));
  console.log(ui.dots("Applied patches", String(result.appliedPatches.length)));
  console.log(ui.dots("Files changed", String(result.filesChanged.length)));
  console.log();
  if (result.status === "blocked") {
    console.log(ui.fail("No files were changed. Re-run with --yes to confirm safe mechanical writes."));
    console.log();
    return;
  }
  for (const file of result.filesChanged) {
    console.log(ui.ok(file));
  }
  if (result.skippedPatches.length > 0) {
    console.log();
    console.log(ui.dim(`  Skipped review/manual patches: ${result.skippedPatches.join(", ")}`));
  }
  console.log();
}
