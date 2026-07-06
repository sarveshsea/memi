/**
 * Research Traceability — Bidirectional links between findings and specs.
 *
 * Maintains a reverse index: finding ID -> spec names[].
 * Updated on every spec save. Queryable for coverage and orphan detection.
 */

import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { createLogger } from "../engine/logger.js";
import type { AnySpec } from "../specs/types.js";
import type { ResearchFinding } from "./engine.js";

const log = createLogger("traceability");

export interface TraceabilityIndex {
  findingToSpecs: Record<string, string[]>;
  specToFindings: Record<string, string[]>;
  updatedAt: string;
}

export class ResearchTraceability {
  private index: TraceabilityIndex = { findingToSpecs: {}, specToFindings: {}, updatedAt: "" };
  private indexPath: string;

  constructor(memoireDir: string) {
    this.indexPath = join(memoireDir, "research", "spec-index.json");
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.indexPath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<TraceabilityIndex> & {
        insightToSpecs?: Record<string, string[]>;
        specToInsights?: Record<string, string[]>;
      };
      this.index = {
        findingToSpecs: parsed.findingToSpecs ?? parsed.insightToSpecs ?? {},
        specToFindings: parsed.specToFindings ?? parsed.specToInsights ?? {},
        updatedAt: parsed.updatedAt ?? "",
      };
    } catch {
      this.index = { findingToSpecs: {}, specToFindings: {}, updatedAt: "" };
    }
  }

  async save(): Promise<void> {
    this.index.updatedAt = new Date().toISOString();
    await mkdir(dirname(this.indexPath), { recursive: true });
    await writeFile(this.indexPath, JSON.stringify(this.index, null, 2));
  }

  async onSpecSaved(spec: AnySpec): Promise<void> {
    const backing = "researchBacking" in spec ? (spec as { researchBacking: string[] }).researchBacking : [];
    if (!Array.isArray(backing)) return;

    const oldFindings = this.index.specToFindings[spec.name] ?? [];
    for (const findingId of oldFindings) {
      const specs = this.index.findingToSpecs[findingId];
      if (!specs) continue;
      this.index.findingToSpecs[findingId] = specs.filter((name) => name !== spec.name);
      if (this.index.findingToSpecs[findingId].length === 0) {
        delete this.index.findingToSpecs[findingId];
      }
    }

    this.index.specToFindings[spec.name] = backing;
    for (const findingId of backing) {
      if (!this.index.findingToSpecs[findingId]) {
        this.index.findingToSpecs[findingId] = [];
      }
      if (!this.index.findingToSpecs[findingId].includes(spec.name)) {
        this.index.findingToSpecs[findingId].push(spec.name);
      }
    }

    await this.save();
    log.debug({ spec: spec.name, findings: backing.length }, "Traceability index updated");
  }

  async onSpecRemoved(specName: string): Promise<void> {
    const findingIds = this.index.specToFindings[specName] ?? [];
    for (const findingId of findingIds) {
      const specs = this.index.findingToSpecs[findingId];
      if (!specs) continue;
      this.index.findingToSpecs[findingId] = specs.filter((name) => name !== specName);
      if (this.index.findingToSpecs[findingId].length === 0) {
        delete this.index.findingToSpecs[findingId];
      }
    }

    delete this.index.specToFindings[specName];
    await this.save();
  }

  getSpecsForFinding(findingId: string): string[] {
    return this.index.findingToSpecs[findingId] ?? [];
  }

  getFindingsForSpec(specName: string): string[] {
    return this.index.specToFindings[specName] ?? [];
  }

  getOrphanedFindings(allFindings: ResearchFinding[]): ResearchFinding[] {
    return allFindings.filter((finding) => !this.index.findingToSpecs[finding.id] || this.index.findingToSpecs[finding.id].length === 0);
  }

  getCoverage(specNames: string[]): { covered: number; total: number; ratio: number } {
    const covered = specNames.filter((name) => {
      const findings = this.index.specToFindings[name];
      return findings && findings.length > 0;
    }).length;

    return {
      covered,
      total: specNames.length,
      ratio: specNames.length > 0 ? covered / specNames.length : 1,
    };
  }

  getIndex(): TraceabilityIndex {
    return this.index;
  }
}

// ── Citation validation report ─────────────────────────────────
//
// The index above tracks WHICH findings a spec cites; the report below asks
// whether those citations still RESOLVE. Three honest states per spec:
//   backed   — at least one citation resolves to a live finding
//   unbacked — the spec cites nothing (design happened without research)
//   stale    — cited ids no longer exist (evidence purged/re-ingested;
//              the citation is a dead link, not proof)

export interface SpecTraceEntry {
  spec: string;
  type: string;
  cited: string[];
  resolved: Array<{ id: string; statement: string; confidence: string }>;
  unresolved: string[];
  backed: boolean;
}

export interface TraceabilityReport {
  generatedAt: string;
  /** Specs that can carry researchBacking (components + pages). */
  totalSpecs: number;
  backedSpecs: number;
  unbackedSpecs: number;
  /** Citations pointing at finding ids that no longer exist in the store. */
  staleCitations: number;
  /** backedSpecs / totalSpecs as 0-100; null when there is nothing to measure. */
  coverage: number | null;
  storeAvailable: boolean;
  entries: SpecTraceEntry[];
}

export function buildTraceabilityReport(specs: AnySpec[], findings: ResearchFinding[] | null): TraceabilityReport {
  const findingById = new Map<string, ResearchFinding>((findings ?? []).map((finding) => [finding.id, finding]));

  const entries: SpecTraceEntry[] = [];
  for (const spec of specs) {
    if (!("researchBacking" in spec) || !Array.isArray((spec as { researchBacking?: unknown }).researchBacking)) continue;
    const cited = (spec as { researchBacking: string[] }).researchBacking;

    const resolved: SpecTraceEntry["resolved"] = [];
    const unresolved: string[] = [];
    for (const id of cited) {
      const finding = findingById.get(id);
      if (finding) {
        resolved.push({ id, statement: finding.statement, confidence: finding.confidence });
      } else {
        unresolved.push(id);
      }
    }

    entries.push({ spec: spec.name, type: spec.type, cited, resolved, unresolved, backed: resolved.length > 0 });
  }

  const backedSpecs = entries.filter((entry) => entry.backed).length;
  const staleCitations = entries.reduce((sum, entry) => sum + entry.unresolved.length, 0);

  return {
    generatedAt: new Date().toISOString(),
    totalSpecs: entries.length,
    backedSpecs,
    unbackedSpecs: entries.length - backedSpecs,
    staleCitations,
    coverage: entries.length > 0 ? Math.round((backedSpecs / entries.length) * 100) : null,
    storeAvailable: findings !== null,
    entries,
  };
}
