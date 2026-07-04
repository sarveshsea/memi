import type { Command } from "commander";
import { stat } from "node:fs/promises";
import type { MemoireEngine } from "../engine/core.js";
import { diagnoseAppQuality } from "../app-quality/engine.js";
import {
  buildInterfaceCraftReport,
  writeInterfaceCraftReport,
  type InterfaceCraftReport,
} from "../ux/interface-craft.js";
import { ui } from "../tui/format.js";

interface CraftAuditOptions {
  json?: boolean;
  maxFiles?: string;
  screenshot?: string;
  noWrite?: boolean;
}

export function registerCraftCommand(program: Command, engine: MemoireEngine): void {
  const craft = program
    .command("craft")
    .description("Audit interface design craft from app-quality evidence or screenshot artifacts");

  craft
    .command("audit [target]")
    .description("Audit visual design, interface design, conventions, and user-context craft")
    .option("--json", "Output stable JSON")
    .option("--max-files <count>", "Maximum source files to scan", "500")
    .option("--screenshot <path>", "Screenshot artifact path to include in the craft audit")
    .option("--no-write", "Do not write .memoire/app-quality/interface-craft reports")
    .action(async (target: string | undefined, opts: CraftAuditOptions) => {
      try {
        const maxFiles = Number.parseInt(opts.maxFiles ?? "500", 10);
        const report = await createInterfaceCraftReport({
          projectRoot: engine.config.projectRoot,
          target,
          screenshot: opts.screenshot,
          maxFiles: Number.isFinite(maxFiles) ? maxFiles : 500,
        });

        if (!opts.noWrite) await writeInterfaceCraftReport(engine.config.projectRoot, report);

        if (opts.json) {
          console.log(JSON.stringify(report, null, 2));
          return;
        }

        printInterfaceCraftAudit(report, opts.noWrite !== true);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (opts.json) {
          console.log(JSON.stringify({ status: "failed", error: message }));
        } else {
          console.log(ui.fail(message));
        }
        process.exitCode = 1;
      }
    });
}

async function createInterfaceCraftReport(options: {
  projectRoot: string;
  target?: string;
  screenshot?: string;
  maxFiles: number;
}): Promise<InterfaceCraftReport> {
  if (options.screenshot) await assertReadableScreenshot(options.screenshot);

  if (options.screenshot && !options.target) {
    return buildInterfaceCraftReport({
      target: "screenshot",
      artifactPath: options.screenshot,
      source: "screenshot",
    });
  }

  const diagnosis = await diagnoseAppQuality({
    projectRoot: options.projectRoot,
    target: options.target,
    maxFiles: options.maxFiles,
    write: false,
  });

  return buildInterfaceCraftReport({
    target: diagnosis.target,
    issues: diagnosis.issues,
    appQualityScore: diagnosis.summary.score,
    artifactPath: options.screenshot,
    source: options.screenshot ? "screenshot" : "app-quality",
  });
}

async function assertReadableScreenshot(path: string): Promise<void> {
  const info = await stat(path).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Screenshot artifact is not readable: ${path}. ${message}`);
  });
  if (!info.isFile()) {
    throw new Error(`Screenshot artifact is not a file: ${path}`);
  }
}

function printInterfaceCraftAudit(report: InterfaceCraftReport, wroteReports: boolean): void {
  console.log(ui.brand("Memoire Interface Craft"));
  console.log(ui.dots("Target", report.target));
  console.log(ui.dots("Score", `${report.score}/100`));
  if (report.artifactPath) console.log(ui.dots("Artifact", report.artifactPath));
  console.log();

  const dimensions = report.dimensions.filter((dimension) => dimension.status !== "strong").slice(0, 8);
  console.log(ui.section("Craft dimensions"));
  if (dimensions.length === 0) {
    console.log(ui.ok("No major craft dimension risk detected from local evidence"));
  } else {
    for (const dimension of dimensions) {
      console.log(`  [${dimension.status.toUpperCase()}] ${dimension.name}`);
      console.log(ui.dim(`      ${dimension.notes[0] ?? dimension.lens}`));
    }
  }

  console.log(ui.section("Top opportunities"));
  for (const opportunity of report.topOpportunities.slice(0, 6)) {
    console.log(`  ${opportunity}`);
  }
  if (report.topOpportunities.length === 0) {
    console.log(ui.ok("Preserve the current craft baseline and collect screenshot evidence for final polish"));
  }
  if (wroteReports) {
    console.log();
    console.log(ui.dim("  Reports written to .memoire/app-quality/interface-craft.{json,md}"));
  }
  console.log();
}
