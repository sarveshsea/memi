import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { ResearchTraceability, buildTraceabilityReport } from "../traceability.js";
import type { ResearchFinding } from "../engine.js";

let testDir: string;
let trace: ResearchTraceability;

beforeEach(async () => {
  testDir = join(tmpdir(), `memoire-trace-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(join(testDir, "research"), { recursive: true });
  trace = new ResearchTraceability(testDir);
  await trace.load();
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

function makeSpec(name: string, backing: string[] = []) {
  return { name, type: "component" as const, researchBacking: backing } as any;
}

describe("ResearchTraceability", () => {
  it("starts empty", () => {
    expect(trace.getSpecsForFinding("any")).toHaveLength(0);
    expect(trace.getFindingsForSpec("any")).toHaveLength(0);
  });

  it("indexes spec -> finding on save", async () => {
    await trace.onSpecSaved(makeSpec("Button", ["finding-1", "finding-2"]));
    expect(trace.getFindingsForSpec("Button")).toEqual(["finding-1", "finding-2"]);
    expect(trace.getSpecsForFinding("finding-1")).toEqual(["Button"]);
    expect(trace.getSpecsForFinding("finding-2")).toEqual(["Button"]);
  });

  it("updates index when spec is re-saved with different findings", async () => {
    await trace.onSpecSaved(makeSpec("Card", ["finding-1"]));
    expect(trace.getSpecsForFinding("finding-1")).toEqual(["Card"]);

    await trace.onSpecSaved(makeSpec("Card", ["finding-2"]));
    expect(trace.getSpecsForFinding("finding-1")).toHaveLength(0);
    expect(trace.getSpecsForFinding("finding-2")).toEqual(["Card"]);
  });

  it("handles multiple specs referencing same finding", async () => {
    await trace.onSpecSaved(makeSpec("Button", ["finding-1"]));
    await trace.onSpecSaved(makeSpec("Card", ["finding-1"]));
    expect(trace.getSpecsForFinding("finding-1")).toEqual(["Button", "Card"]);
  });

  it("removes spec from index", async () => {
    await trace.onSpecSaved(makeSpec("Button", ["finding-1"]));
    await trace.onSpecRemoved("Button");
    expect(trace.getSpecsForFinding("finding-1")).toHaveLength(0);
    expect(trace.getFindingsForSpec("Button")).toHaveLength(0);
  });

  it("persists and reloads from disk", async () => {
    await trace.onSpecSaved(makeSpec("Button", ["finding-1"]));

    const trace2 = new ResearchTraceability(testDir);
    await trace2.load();
    expect(trace2.getSpecsForFinding("finding-1")).toEqual(["Button"]);
  });

  it("computes coverage", async () => {
    await trace.onSpecSaved(makeSpec("Button", ["finding-1"]));
    await trace.onSpecSaved(makeSpec("Card", []));

    const cov = trace.getCoverage(["Button", "Card", "Input"]);
    expect(cov.covered).toBe(1);
    expect(cov.total).toBe(3);
    expect(cov.ratio).toBeCloseTo(1 / 3, 2);
  });

  it("finds orphaned findings", async () => {
    await trace.onSpecSaved(makeSpec("Button", ["finding-1"]));

    const findings: ResearchFinding[] = [
      {
        id: "finding-1",
        statement: "Linked",
        category: "general",
        confidence: "high",
        themeIds: [],
        evidenceObservationIds: [],
        evidenceSourceIds: [],
        sourceTypeCount: 1,
        method: "qualitative",
        caveats: [],
        tags: [],
        entities: [],
        signalTags: [],
        createdAt: "",
      },
      {
        id: "finding-2",
        statement: "Orphaned",
        category: "general",
        confidence: "high",
        themeIds: [],
        evidenceObservationIds: [],
        evidenceSourceIds: [],
        sourceTypeCount: 1,
        method: "qualitative",
        caveats: [],
        tags: [],
        entities: [],
        signalTags: [],
        createdAt: "",
      },
    ];

    const orphaned = trace.getOrphanedFindings(findings);
    expect(orphaned).toHaveLength(1);
    expect(orphaned[0].id).toBe("finding-2");
  });
});

describe("buildTraceabilityReport", () => {
  const liveFinding: ResearchFinding = {
    id: "finding-live",
    statement: "Users abandon checkout when shipping cost appears late.",
    category: "general",
    confidence: "high",
    themeIds: [],
    evidenceObservationIds: [],
    evidenceSourceIds: [],
    sourceTypeCount: 1,
    method: "qualitative",
    caveats: [],
    tags: [],
    entities: [],
    signalTags: [],
    createdAt: "",
  };

  it("classifies backed, unbacked, and stale specs honestly", () => {
    const report = buildTraceabilityReport([
      makeSpec("BackedCard", ["finding-live"]),
      makeSpec("UnbackedCard", []),
      makeSpec("StaleCard", ["finding-purged"]),
      { name: "NoBackingField", type: "design" } as any, // cannot carry researchBacking → excluded
    ], [liveFinding]);

    expect(report.totalSpecs).toBe(3);
    expect(report.backedSpecs).toBe(1);
    expect(report.unbackedSpecs).toBe(2);
    expect(report.staleCitations).toBe(1);
    expect(report.coverage).toBe(33);

    const stale = report.entries.find((entry) => entry.spec === "StaleCard");
    expect(stale?.backed).toBe(false);
    expect(stale?.unresolved).toEqual(["finding-purged"]);
    const backed = report.entries.find((entry) => entry.spec === "BackedCard");
    expect(backed?.resolved[0]).toMatchObject({ id: "finding-live", confidence: "high" });
  });

  it("returns null coverage when no spec can carry researchBacking", () => {
    const report = buildTraceabilityReport([{ name: "OnlyDesign", type: "design" } as any], []);
    expect(report.totalSpecs).toBe(0);
    expect(report.coverage).toBeNull();
  });

  it("resolves a mixed citation list partially — spec counts as backed but stale ids stay visible", () => {
    const report = buildTraceabilityReport([
      makeSpec("Mixed", ["finding-live", "finding-gone"]),
    ], [liveFinding]);
    const entry = report.entries[0];
    expect(entry.backed).toBe(true);
    expect(entry.resolved).toHaveLength(1);
    expect(entry.unresolved).toEqual(["finding-gone"]);
    expect(report.staleCitations).toBe(1);
  });
});
