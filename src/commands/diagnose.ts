import type { Command } from "commander";
import type { MemoireEngine } from "../engine/core.js";
import { diagnoseAppQuality, type AppQualityDiagnosis, type AppQualitySeverity, type AppQualityIssue } from "../app-quality/engine.js";
import { loadPolicy } from "../app-quality/policy.js";
import { filterWithBaseline, readBaseline } from "../app-quality/baseline.js";
import { ui } from "../tui/format.js";

interface DiagnoseOptions {
  json?: boolean;
  maxFiles?: string;
  noWrite?: boolean;
  failOn?: string;
  baseline?: boolean;
}

const SEVERITY_RANK: Record<AppQualitySeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const FAIL_ON_VALUES = new Set(["critical", "high", "medium", "low", "none"]);

/**
 * Exit non-zero when any gating issue meets the threshold. Runs in BOTH output
 * modes — the previous gate only ran in human mode and only on "critical", a
 * severity the engine never emits, so `memi diagnose` shipped a CI gate that
 * could mathematically never fail.
 */
function shouldFail(gatingIssues: AppQualityIssue[], failOn: string): boolean {
  if (failOn === "none") return false;
  const threshold = SEVERITY_RANK[failOn as AppQualitySeverity];
  return gatingIssues.some((issue) => SEVERITY_RANK[issue.severity] >= threshold);
}

export function registerDiagnoseCommand(program: Command, engine: MemoireEngine): void {
  program
    .command("diagnose [target]")
    .description("Diagnose design debt in an existing web app from code or URL")
    .option("--json", "Output the diagnosis as JSON")
    .option("--max-files <count>", "Maximum source files to scan", "500")
    .option("--no-write", "Do not write .memoire/app-quality reports")
    .option("--fail-on <severity>", "Exit non-zero when any issue is at or above this severity: critical, high, medium, low, or none. Defaults to the policy's gates.failOn (high without a policy).")
    .option("--baseline", "Gate only on findings NOT accepted in .memoire/baseline.json (suppressed counts always shown)")
    .action(async (target: string | undefined, opts: DiagnoseOptions) => {
      try {
        const policy = await loadPolicy(engine.config.projectRoot);
        // Precedence: explicit CLI flag > committed policy > built-in default.
        const failOn = (opts.failOn ?? policy.gates.failOn).toLowerCase();
        if (!FAIL_ON_VALUES.has(failOn)) {
          throw new Error(`Invalid --fail-on value "${opts.failOn}". Use one of: critical, high, medium, low, none.`);
        }
        const maxFiles = Number.parseInt(opts.maxFiles ?? "500", 10);
        const diagnosis = await diagnoseAppQuality({
          projectRoot: engine.config.projectRoot,
          target,
          maxFiles: Number.isFinite(maxFiles) ? maxFiles : 500,
          write: opts.noWrite ? false : true,
          policy,
        });

        let gatingIssues = diagnosis.issues;
        let suppressedCount = 0;
        if (opts.baseline) {
          const baseline = await readBaseline(engine.config.projectRoot);
          if (!baseline) {
            throw new Error("--baseline was passed but .memoire/baseline.json does not exist. Run `memi baseline accept` first.");
          }
          const filtered = filterWithBaseline(diagnosis.issues, baseline);
          gatingIssues = filtered.active;
          suppressedCount = filtered.suppressed.length;
        }

        const failed = shouldFail(gatingIssues, failOn);

        if (opts.json) {
          console.log(JSON.stringify({
            ...diagnosis,
            gate: { failOn, failed, baselineApplied: Boolean(opts.baseline), gatingIssues: gatingIssues.length, suppressedByBaseline: suppressedCount },
          }, null, 2));
          if (failed) process.exitCode = 1;
          return;
        }

        printDiagnosis(diagnosis, opts.noWrite !== true);
        if (suppressedCount > 0) {
          console.log(ui.dim(`  Baseline: ${suppressedCount} accepted finding(s) suppressed from gating (still counted above)`));
        }
        if (failed) {
          console.log(ui.fail(`Gate: at least one ${opts.baseline ? "new (non-baselined) " : ""}issue at or above "${failOn}" severity (--fail-on ${failOn})`));
          console.log();
          process.exitCode = 1;
        }
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

function printDiagnosis(diagnosis: AppQualityDiagnosis, wroteReports: boolean): void {
  console.log(ui.brand("Design CI for shadcn/Tailwind apps"));
  console.log(ui.dots("Target", diagnosis.target));
  console.log(ui.dots("Score", `${diagnosis.summary.score}/100`));
  console.log(ui.dots("Verdict", diagnosis.summary.verdict));
  console.log(ui.dots("Files", String(diagnosis.summary.scannedFiles)));
  if (diagnosis.summary.scanMs !== undefined || diagnosis.summary.analysisMs !== undefined) {
    console.log(ui.dots(
      "Scan",
      `${diagnosis.summary.scanMs ?? 0}ms scan · ${diagnosis.summary.analysisMs ?? 0}ms total`,
    ));
  }
  console.log(ui.dots("Routes", String(diagnosis.summary.routes)));
  console.log(ui.dots("Components", String(diagnosis.summary.components)));
  console.log(ui.dots("Tailwind classes", String(diagnosis.summary.tailwindClasses)));
  console.log();

  console.log(ui.section("Highest impact issues"));
  if (diagnosis.issues.length === 0) {
    console.log(ui.ok("No major app-quality issues detected"));
  } else {
    for (const issue of diagnosis.issues.slice(0, 6)) {
      const label = `${issue.severity.toUpperCase()} ${issue.category}`;
      console.log(`  [${label}] ${issue.title}`);
      console.log(`      ${issue.recommendation}`);
      if (issue.affectedFiles?.[0]) {
        const location = issue.evidenceLocations?.[0];
        console.log(ui.dim(`      evidence: ${location?.file ?? issue.affectedFiles[0]}${location?.line ? `:${location.line}` : ""}`));
      }
      if (issue.confidence !== undefined || issue.estimatedEffort) {
        const confidence = issue.confidence !== undefined ? `${Math.round(issue.confidence * 100)}% confidence` : "";
        const effort = issue.estimatedEffort ? `${issue.estimatedEffort} effort` : "";
        console.log(ui.dim(`      ${[confidence, effort, issue.fixCategory].filter(Boolean).join(" · ")}`));
      }
    }
  }

  console.log(ui.section("Design directions"));
  for (const direction of diagnosis.directions) {
    console.log(`  ${direction.id}  ${direction.name}`);
    console.log(`      ${direction.fit}`);
  }

  console.log(ui.section("Next"));
  console.log(ui.guide("memi diagnose --json", "use in CI or automation"));
  console.log(ui.guide("memi theme import", "bring in a stronger visual direction"));
  console.log(ui.guide("memi publish", "package the improved system as a registry"));
  if (wroteReports) {
    console.log();
    console.log(ui.dim("  Reports written to .memoire/app-quality/diagnosis.{json,md}"));
  }
  console.log();
}
