import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerSimulateCommand } from "../simulate.js";
import { captureLogs, lastLog } from "./test-helpers.js";

describe("simulate --json", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("plans, runs, interviews, reports, and exports specs from the local adapter", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-simulate-"));
    try {
      await writeResearchStore(root);

      const planLogs = captureLogs();
      const planProgram = new Command();
      registerSimulateCommand(planProgram, makeEngine(root) as never);
      await planProgram.parseAsync(["simulate", "plan", "--name", "Pricing lab", "--hypothesis", "Earlier fees reduce abandonment", "--json"], { from: "user" });
      const planPayload = JSON.parse(lastLog(planLogs));
      expect(planPayload).toMatchObject({
        action: "plan",
        status: "completed",
        scenario: {
          name: "Pricing lab",
          adapter: "local",
          hypothesis: "Earlier fees reduce abandonment",
        },
      });

      const runLogs = captureLogs();
      const runProgram = new Command();
      registerSimulateCommand(runProgram, makeEngine(root) as never);
      await runProgram.parseAsync(["simulate", "run", planPayload.scenario.id, "--json"], { from: "user" });
      const runPayload = JSON.parse(lastLog(runLogs));
      expect(runPayload).toMatchObject({
        action: "run",
        status: "completed",
        run: { status: "completed" },
      });

      const interviewLogs = captureLogs();
      const interviewProgram = new Command();
      registerSimulateCommand(interviewProgram, makeEngine(root) as never);
      await interviewProgram.parseAsync(["simulate", "interview", runPayload.run.id, "--agent", planPayload.scenario.agents[0].id, "--prompt", "What changed?", "--json"], { from: "user" });
      expect(JSON.parse(lastLog(interviewLogs))).toMatchObject({
        action: "interview",
        status: "completed",
        interview: { agentName: "Growth PM" },
      });

      const reportLogs = captureLogs();
      const reportProgram = new Command();
      registerSimulateCommand(reportProgram, makeEngine(root) as never);
      await reportProgram.parseAsync(["simulate", "report", runPayload.run.id, "--json"], { from: "user" });
      expect(JSON.parse(lastLog(reportLogs))).toMatchObject({
        action: "report",
        status: "completed",
        report: { runId: runPayload.run.id },
      });

      const specLogs = captureLogs();
      const specProgram = new Command();
      registerSimulateCommand(specProgram, makeEngine(root) as never);
      await specProgram.parseAsync(["simulate", "export-spec", runPayload.run.id, "--json"], { from: "user" });
      expect(JSON.parse(lastLog(specLogs))).toMatchObject({
        action: "export-spec",
        status: "completed",
        spec: { title: "Pricing lab Spec Impact" },
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("exposes model-swarm planning, matrix runs, streams, transcripts, comparisons, and costs", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-simulate-swarm-"));
    try {
      await writeResearchStore(root);

      const modelsLogs = captureLogs();
      const modelsProgram = new Command();
      registerSimulateCommand(modelsProgram, makeEngine(root) as never);
      await modelsProgram.parseAsync(["simulate", "models", "--json"], { from: "user" });
      expect(JSON.parse(lastLog(modelsLogs))).toMatchObject({
        action: "models",
        profiles: expect.arrayContaining([expect.objectContaining({ provider: "codex" })]),
      });

      const agentsLogs = captureLogs();
      const agentsProgram = new Command();
      registerSimulateCommand(agentsProgram, makeEngine(root) as never);
      await agentsProgram.parseAsync(["simulate", "generate-agents", "--adapter", "model-swarm", "--count", "24", "--json"], { from: "user" });
      const agentsPayload = JSON.parse(lastLog(agentsLogs));
      expect(agentsPayload).toMatchObject({
        action: "generate-agents",
        status: "completed",
        adapter: "model-swarm",
      });
      expect(agentsPayload.agents).toHaveLength(24);

      const planLogs = captureLogs();
      const planProgram = new Command();
      registerSimulateCommand(planProgram, makeEngine(root) as never);
      await planProgram.parseAsync(["simulate", "plan", "--adapter", "model-swarm", "--name", "Swarm lab", "--hypothesis", "Agent debate improves specs", "--json"], { from: "user" });
      const planPayload = JSON.parse(lastLog(planLogs));
      expect(planPayload.scenario).toMatchObject({ adapter: "model-swarm", name: "Swarm lab" });

      const runLogs = captureLogs();
      const runProgram = new Command();
      registerSimulateCommand(runProgram, makeEngine(root) as never);
      await runProgram.parseAsync(["simulate", "run", planPayload.scenario.id, "--adapter", "model-swarm", "--max-agents", "20", "--rounds", "2", "--json"], { from: "user" });
      const runPayload = JSON.parse(lastLog(runLogs));
      expect(runPayload.run).toMatchObject({
        adapter: "model-swarm",
        rounds: expect.arrayContaining([expect.objectContaining({ index: 1 })]),
        transcripts: expect.arrayContaining([expect.objectContaining({ response: expect.any(String) })]),
      });

      const transcriptLogs = captureLogs();
      const transcriptProgram = new Command();
      registerSimulateCommand(transcriptProgram, makeEngine(root) as never);
      await transcriptProgram.parseAsync(["simulate", "transcript", runPayload.run.id, "--json"], { from: "user" });
      expect(JSON.parse(lastLog(transcriptLogs))).toMatchObject({
        action: "transcript",
        transcripts: expect.arrayContaining([expect.objectContaining({ modelProfileId: expect.any(String) })]),
      });

      const streamLogs = captureLogs();
      const streamProgram = new Command();
      registerSimulateCommand(streamProgram, makeEngine(root) as never);
      await streamProgram.parseAsync(["simulate", "stream", runPayload.run.id, "--json"], { from: "user" });
      expect(JSON.parse(lastLog(streamLogs))).toMatchObject({
        action: "stream",
        events: expect.arrayContaining([expect.objectContaining({ kind: "model-response" })]),
      });

      const costsLogs = captureLogs();
      const costsProgram = new Command();
      registerSimulateCommand(costsProgram, makeEngine(root) as never);
      await costsProgram.parseAsync(["simulate", "costs", runPayload.run.id, "--json"], { from: "user" });
      expect(JSON.parse(lastLog(costsLogs))).toMatchObject({
        action: "costs",
        costs: { estimatedCostUsd: 0 },
      });

      const compareLogs = captureLogs();
      const compareProgram = new Command();
      registerSimulateCommand(compareProgram, makeEngine(root) as never);
      await compareProgram.parseAsync(["simulate", "compare", runPayload.run.id, runPayload.run.id, "--json"], { from: "user" });
      expect(JSON.parse(lastLog(compareLogs))).toMatchObject({
        action: "compare",
        runs: expect.arrayContaining([expect.objectContaining({ runId: runPayload.run.id })]),
      });

      const matrixLogs = captureLogs();
      const matrixProgram = new Command();
      registerSimulateCommand(matrixProgram, makeEngine(root) as never);
      await matrixProgram.parseAsync([
        "simulate",
        "run-matrix",
        "--adapter",
        "model-swarm",
        "--hypothesis",
        "Agent debate improves specs",
        "--hypothesis",
        "Evidence trace improves specs",
        "--max-agents",
        "20",
        "--rounds",
        "1",
        "--json",
      ], { from: "user" });
      expect(JSON.parse(lastLog(matrixLogs))).toMatchObject({
        action: "run-matrix",
        runs: expect.arrayContaining([expect.objectContaining({ run: expect.objectContaining({ adapter: "model-swarm" }) })]),
        comparison: expect.objectContaining({ winnerRunId: expect.any(String) }),
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

function makeEngine(projectRoot: string) {
  return {
    config: { projectRoot },
    async init() {},
    research: {
      async load() {},
      getStore() {
        return {
          version: 2,
          sources: [{ id: "source", name: "research.csv", type: "csv", processedAt: "2026-05-07T00:00:00.000Z" }],
          observations: [],
          highlights: [],
          codebook: [],
          findings: [{
            id: "finding-1",
            statement: "Checkout friction is concentrated around pricing disclosure.",
            category: "conversion",
            confidence: "high",
            themeIds: ["theme-1"],
            evidenceObservationIds: [],
            evidenceSourceIds: ["source"],
            sourceTypeCount: 1,
            method: "mixed",
            caveats: [],
            tags: ["checkout"],
            entities: ["Checkout"],
            signalTags: ["checkout"],
            createdAt: "2026-05-07T00:00:00.000Z",
          }],
          themes: [{ id: "theme-1", name: "Pricing clarity", description: "Fees need to be visible.", findingIds: ["finding-1"], frequency: 3, sourceCount: 1, sourceTypeCount: 1, confidence: "high", signalTags: ["pricing"], positiveCount: 0, negativeCount: 3 }],
          evidenceLinks: [],
          personas: [{ name: "Growth PM", role: "Product manager", goals: ["Increase conversion"], painPoints: ["Pricing visibility"], behaviors: ["Reads funnels"], source: "research.csv", evidenceFindingIds: ["finding-1"] }],
          quantitativeMetrics: [],
          opportunities: [{ title: "Move fees earlier", summary: "Expose fee estimates in step one.", theme: "Pricing clarity", priority: "high", confidence: "high", evidenceFindingIds: ["finding-1"], sourceCount: 1 }],
          risks: [],
          contradictions: [],
          reports: [],
          quality: { overallScore: 80, sampleSize: 8, completenessScore: 80, sourceDiversityScore: 60, triangulationScore: 70, structureScore: 80, notes: [], generatedAt: "2026-05-07T00:00:00.000Z" },
          methods: { analysisMode: "decision-grade", quantitativeApproach: "", qualitativeApproach: "", limitations: [] },
        };
      },
    },
  };
}

async function writeResearchStore(root: string): Promise<void> {
  await mkdir(join(root, "research"), { recursive: true });
  await writeFile(join(root, "research", "store.v2.json"), JSON.stringify({ version: 2 }), "utf-8");
}
