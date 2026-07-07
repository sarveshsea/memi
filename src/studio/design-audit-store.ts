// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 Humyn LLC

// Studio sidecar wiring for memi's own design-quality audit engine: run a
// scan, read the last cached result without rescanning, and accept the
// current findings as a baseline. Thin wrappers only — all engine logic
// (scanning, scoring, baseline fingerprinting, score history) already
// exists in src/app-quality/*; this module just composes it for the
// Studio HTTP API.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { diagnoseAppQuality, type AppQualityDiagnosis, type AppQualityIssue } from "../app-quality/engine.js";
import { loadPolicy } from "../app-quality/policy.js";
import { readBaseline, writeBaseline, buildBaseline, filterWithBaseline, type BaselineFile } from "../app-quality/baseline.js";
import { readHistory, type HistoryEntry } from "../app-quality/history.js";

export interface StudioDesignAuditResult {
  diagnosis: AppQualityDiagnosis;
  active: AppQualityIssue[];
  suppressed: AppQualityIssue[];
  baselineExists: boolean;
  history: HistoryEntry[];
}

async function readDiagnosis(projectRoot: string): Promise<AppQualityDiagnosis | null> {
  try {
    const raw = await readFile(join(projectRoot, ".memoire", "app-quality", "diagnosis.json"), "utf-8");
    return JSON.parse(raw) as AppQualityDiagnosis;
  } catch {
    return null;
  }
}

async function splitByBaseline(
  projectRoot: string,
  diagnosis: AppQualityDiagnosis,
): Promise<{ active: AppQualityIssue[]; suppressed: AppQualityIssue[]; baselineExists: boolean }> {
  const baseline = await readBaseline(projectRoot);
  if (!baseline) return { active: diagnosis.issues, suppressed: [], baselineExists: false };
  const { active, suppressed } = filterWithBaseline(diagnosis.issues, baseline);
  return { active, suppressed, baselineExists: true };
}

export async function runDesignAudit(projectRoot: string, opts: { maxFiles?: number } = {}): Promise<StudioDesignAuditResult> {
  const policy = await loadPolicy(projectRoot);
  // write: true (the default) already appends to the score-history ledger
  // internally (engine.ts's writeDiagnosis) — do not append a second time here.
  const diagnosis = await diagnoseAppQuality({ projectRoot, maxFiles: opts.maxFiles, write: true, policy });
  const { active, suppressed, baselineExists } = await splitByBaseline(projectRoot, diagnosis);
  const history = await readHistory(projectRoot);
  return { diagnosis, active, suppressed, baselineExists, history };
}

export async function getLatestDesignAudit(projectRoot: string): Promise<StudioDesignAuditResult | null> {
  const diagnosis = await readDiagnosis(projectRoot);
  if (!diagnosis) return null;
  const { active, suppressed, baselineExists } = await splitByBaseline(projectRoot, diagnosis);
  const history = await readHistory(projectRoot);
  return { diagnosis, active, suppressed, baselineExists, history };
}

export async function acceptDesignAuditBaseline(projectRoot: string): Promise<BaselineFile> {
  const diagnosis = await readDiagnosis(projectRoot);
  if (!diagnosis) throw new Error("No design audit has been run yet.");
  const baseline = buildBaseline(diagnosis.issues, { policyHash: diagnosis.policy?.hash, note: "accepted via Studio UI" });
  await writeBaseline(projectRoot, baseline);
  return baseline;
}
