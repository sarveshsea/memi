/**
 * `memi baseline` — accept current findings as team debt so gates only fail
 * on NEW findings, and inspect what the baseline currently suppresses.
 *
 * Acceptance is loud by design: the accept command prints exactly how much
 * debt was accepted, and status always shows suppressed counts — a baseline
 * must never quietly hide problems.
 */

import type { Command } from "commander";
import type { MemoireEngine } from "../engine/core.js";
import { diagnoseAppQuality } from "../app-quality/engine.js";
import { loadPolicy } from "../app-quality/policy.js";
import {
  buildBaseline,
  filterWithBaseline,
  readBaseline,
  writeBaseline,
  BASELINE_FILE_RELATIVE,
} from "../app-quality/baseline.js";
import { ui } from "../tui/format.js";

export function registerBaselineCommand(program: Command, engine: MemoireEngine): void {
  const baseline = program
    .command("baseline")
    .description("Accept current findings as baseline debt, or inspect what the baseline suppresses");

  baseline
    .command("accept [target]")
    .description("Scan and accept ALL current findings — after this, only new findings gate")
    .option("--json", "Output the written baseline as JSON")
    .option("--max-files <count>", "Maximum source files to scan", "500")
    .option("--note <text>", "Note stored on every accepted entry (e.g. a ticket reference)")
    .action(async (target: string | undefined, opts: { json?: boolean; maxFiles?: string; note?: string }) => {
      try {
        const policy = await loadPolicy(engine.config.projectRoot);
        const maxFiles = Number.parseInt(opts.maxFiles ?? "500", 10);
        const diagnosis = await diagnoseAppQuality({
          projectRoot: engine.config.projectRoot,
          target,
          maxFiles: Number.isFinite(maxFiles) ? maxFiles : 500,
          write: false,
          policy,
        });

        const file = buildBaseline(diagnosis.issues, {
          policyHash: policy.policyHash,
          note: opts.note,
        });
        const path = await writeBaseline(engine.config.projectRoot, file);

        if (opts.json) {
          console.log(JSON.stringify({ status: "accepted", path, acceptedFindings: diagnosis.issues.length, acceptedFingerprints: file.entries.length, policyHash: policy.policyHash }, null, 2));
          return;
        }

        console.log(ui.brand("Memoire Baseline"));
        console.log(ui.warn(`Accepted existing debt: ${diagnosis.issues.length} finding(s) → ${file.entries.length} fingerprint(s)`));
        console.log(ui.dots("Written", path));
        console.log(ui.dots("Policy hash", policy.policyHash));
        console.log(ui.dim("  Commit this file. Gated runs (--baseline) will now only fail on NEW findings;"));
        console.log(ui.dim("  suppressed counts stay visible in every report. Burn the accepted debt down over time."));
        console.log();
      } catch (err) {
        fail(err, opts.json);
      }
    });

  baseline
    .command("status [target]")
    .description("Show what the committed baseline currently suppresses, and stale entries safe to prune")
    .option("--json", "Output status as JSON")
    .option("--max-files <count>", "Maximum source files to scan", "500")
    .action(async (target: string | undefined, opts: { json?: boolean; maxFiles?: string }) => {
      try {
        const existing = await readBaseline(engine.config.projectRoot);
        if (!existing) {
          if (opts.json) {
            console.log(JSON.stringify({ status: "missing", hint: "Run `memi baseline accept` to create one." }, null, 2));
          } else {
            console.log(ui.pending(`No ${BASELINE_FILE_RELATIVE} found. Run \`memi baseline accept\` to create one.`));
          }
          return;
        }

        const policy = await loadPolicy(engine.config.projectRoot);
        const maxFiles = Number.parseInt(opts.maxFiles ?? "500", 10);
        const diagnosis = await diagnoseAppQuality({
          projectRoot: engine.config.projectRoot,
          target,
          maxFiles: Number.isFinite(maxFiles) ? maxFiles : 500,
          write: false,
          policy,
        });
        const result = filterWithBaseline(diagnosis.issues, existing);
        const policyDrift = existing.policyHash !== undefined && existing.policyHash !== policy.policyHash;

        if (opts.json) {
          console.log(JSON.stringify({
            status: "ok",
            acceptedAt: existing.acceptedAt,
            acceptedFingerprints: existing.entries.length,
            suppressedNow: result.suppressed.length,
            activeNow: result.active.length,
            staleFingerprints: result.staleFingerprints.length,
            policyDrift,
            baselinePolicyHash: existing.policyHash,
            activePolicyHash: policy.policyHash,
          }, null, 2));
          return;
        }

        console.log(ui.brand("Memoire Baseline Status"));
        console.log(ui.dots("Accepted at", existing.acceptedAt));
        console.log(ui.dots("Accepted fingerprints", String(existing.entries.length)));
        console.log(ui.dots("Suppressed right now", `${result.suppressed.length} finding(s)`));
        console.log(ui.dots("Active (would gate)", `${result.active.length} finding(s)`));
        if (result.staleFingerprints.length > 0) {
          console.log(ui.dots("Stale entries", `${result.staleFingerprints.length} no longer occur — re-run \`memi baseline accept\` to prune`));
        }
        if (policyDrift) {
          console.log(ui.warn(`Policy drift: baseline was accepted under policy ${existing.policyHash}, active policy is ${policy.policyHash} — re-accept to realign.`));
        }
        console.log();
      } catch (err) {
        fail(err, opts.json);
      }
    });
}

function fail(err: unknown, json?: boolean): void {
  const message = err instanceof Error ? err.message : String(err);
  if (json) {
    console.log(JSON.stringify({ status: "failed", error: message }));
  } else {
    console.log(ui.fail(message));
  }
  process.exitCode = 1;
}
