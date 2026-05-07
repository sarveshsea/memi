import type { Command } from "commander";
import type { MemoireEngine } from "../engine/core.js";
import {
  openMermaidJamTarget,
  resolveMermaidJamIntegration,
  type MermaidJamOpenTarget,
} from "../integrations/mermaid-jam.js";
import {
  analyzeMarkdownForFigJam,
  getMarkdownCorpusStatus,
  setupMarkdownCorpus,
  type MarkdownCorpusRepo,
} from "../integrations/markdown-corpus.js";
import { buildResearchDesignPackage, writeMermaidJamArtifacts } from "../research/design-package.js";
import { FileSimulationStore, LocalSimulationAdapter, ModelSwarmSimulationAdapter } from "../simulation/index.js";
import type { ResearchStore } from "../research/engine.js";
import { ui } from "../tui/format.js";

export function registerMermaidJamCommand(program: Command, engine: MemoireEngine): void {
  const mermaidJam = program
    .command("mermaid-jam")
    .alias("mermaid")
    .description("Open and inspect the native Mermaid Jam FigJam integration");

  mermaidJam
    .command("status")
    .description("Show Mermaid Jam install links, local manifest path, and FigJam readiness")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      await engine.init("minimal");
      const integration = await resolveMermaidJamIntegration({ projectRoot: engine.config.projectRoot });
      const payload = { status: statusFor(integration), integration };

      if (opts.json) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }

      console.log();
      console.log(ui.section("MERMAID JAM"));
      console.log(ui.dots("Status", payload.status));
      console.log(ui.dots("Community", integration.communityUrl));
      console.log(ui.dots("Repository", integration.repositoryUrl));
      console.log(ui.dots("Local manifest", integration.local.manifestPath ?? "not found"));
      for (const step of integration.install.nextSteps) console.log(`  ${ui.promptPrefix()} ${step}`);
      console.log();
    });

  mermaidJam
    .command("export")
    .description("Write research-backed Mermaid Jam source artifacts for FigJam")
    .option("--from <source>", "research or simulation run id", "research")
    .option("--intent <text>", "Design intent for generated FigJam source")
    .option("--hypothesis <text>", "Hypothesis for generated FigJam source")
    .option("--open", "Open Mermaid Jam after writing source artifacts")
    .option("--json", "Output as JSON")
    .action(async (opts: { from?: string; intent?: string; hypothesis?: string; open?: boolean; json?: boolean }) => {
      await engine.init("minimal");
      const integration = await resolveMermaidJamIntegration({ projectRoot: engine.config.projectRoot });
      const source = opts.from ?? "research";
      const research = await loadResearchStore(engine);
      const report = source === "research" ? null : await loadSimulationReport(engine.config.projectRoot, source);
      const designPackage = buildResearchDesignPackage(research, {
        intent: opts.intent,
        hypothesis: opts.hypothesis,
        simulationReport: report,
      });
      const exports = await writeMermaidJamArtifacts(designPackage, {
        projectRoot: engine.config.projectRoot,
        integration,
      });
      const opened = opts.open
        ? await openMermaidJamTarget(integration, integration.local.ready ? "local-manifest" : "community")
        : null;
      const payload = { status: "exported", source, package: designPackage, exports, opened, integration };

      if (opts.json) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }

      console.log();
      console.log(ui.ok(`Exported ${exports.length} Mermaid Jam source artifact${exports.length === 1 ? "" : "s"}`));
      for (const item of exports) console.log(ui.dots(item.title, item.outputPath));
      console.log();
    });

  mermaidJam
    .command("open")
    .description("Open Mermaid Jam on Figma Community, GitHub, or the local manifest")
    .option("--target <target>", "community, repository, or local-manifest", "community")
    .option("--json", "Output as JSON")
    .action(async (opts: { target?: MermaidJamOpenTarget; json?: boolean }) => {
      await engine.init("minimal");
      const target = parseTarget(opts.target ?? "community");
      const integration = await resolveMermaidJamIntegration({ projectRoot: engine.config.projectRoot });
      const result = await openMermaidJamTarget(integration, target);
      const payload = { status: "opened", result, integration };

      if (opts.json) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }

      console.log();
      console.log(ui.ok(`Opened ${result.opened}`));
      console.log();
    });

  const corpus = mermaidJam
    .command("corpus")
    .description("Manage the local markdown-only corpus used by Mermaid Jam and FigJam sync");

  corpus
    .command("status")
    .description("Show local markdown corpus size, freshness, and repository errors")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      await engine.init("minimal");
      const payload = await getMarkdownCorpusStatus(engine.config.projectRoot);
      if (opts.json) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }

      console.log();
      console.log(ui.section("MARKDOWN CORPUS"));
      console.log(ui.dots("Status", payload.status));
      console.log(ui.dots("Repos", String(payload.repos.length)));
      console.log(ui.dots("Files", String(payload.repos.reduce((sum, repo) => sum + repo.files, 0))));
      console.log(ui.dots("Bytes", String(payload.repos.reduce((sum, repo) => sum + repo.bytes, 0))));
      console.log();
    });

  corpus
    .command("sync")
    .description("Download and index the curated markdown corpus")
    .option("--setup", "Download/index the corpus now")
    .option("--json", "Output as JSON")
    .option("--fixture-source <path>", "Test-only fixture source for deterministic corpus setup")
    .action(async (opts: { setup?: boolean; json?: boolean; fixtureSource?: string }) => {
      await engine.init("minimal");
      const catalog = opts.fixtureSource ? fixtureCatalog(opts.fixtureSource) : undefined;
      const payload = opts.setup
        ? await setupMarkdownCorpus({ projectRoot: engine.config.projectRoot, catalog })
        : await getMarkdownCorpusStatus(engine.config.projectRoot);
      if (opts.json) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }

      console.log();
      console.log(ui.section("MARKDOWN CORPUS"));
      console.log(ui.dots("Status", payload.status));
      for (const repo of payload.repos) {
        console.log(`  ${ui.promptPrefix()} ${repo.repo}: ${repo.files} files / ${repo.skipped} skipped`);
      }
      console.log();
    });

  mermaidJam
    .command("analyze")
    .argument("<path>", "Markdown or MDX file to analyze for editable FigJam candidates")
    .description("Analyze markdown and Mermaid source for FigJam-ready diagram candidates")
    .option("--json", "Output as JSON")
    .action(async (path: string, opts: { json?: boolean }) => {
      await engine.init("minimal");
      const report = await analyzeMarkdownForFigJam({ projectRoot: engine.config.projectRoot, sourcePath: path });
      const payload = { status: report.status, candidates: report.candidates, summary: report.summary };
      if (opts.json) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }

      console.log();
      console.log(ui.section("MARKDOWN ANALYSIS"));
      console.log(ui.dots("Candidates", String(payload.candidates.length)));
      for (const candidate of payload.candidates) {
        console.log(`  ${ui.promptPrefix()} ${candidate.kind}: ${candidate.title} (${candidate.confidence})`);
      }
      console.log();
    });
}

function fixtureCatalog(source: string): MarkdownCorpusRepo[] {
  return [
    { owner: "fixture", repo: "docs", license: "MIT", branch: "main", policy: "download", localSource: source },
  ];
}

function statusFor(integration: Awaited<ReturnType<typeof resolveMermaidJamIntegration>>): "ready" | "needs-build" | "available" {
  if (integration.local.ready) return "ready";
  if (integration.local.found) return "needs-build";
  return "available";
}

function parseTarget(value: string): MermaidJamOpenTarget {
  if (value === "community" || value === "repository" || value === "local-manifest") return value;
  throw Object.assign(new Error(`Unsupported Mermaid Jam target: ${value}`), { statusCode: 400 });
}

async function loadResearchStore(engine: MemoireEngine): Promise<ResearchStore> {
  if (engine.research && typeof engine.research.load === "function") {
    await engine.research.load();
    return engine.research.getStore();
  }
  return {
    version: 2,
    sources: [],
    observations: [],
    highlights: [],
    codebook: [],
    findings: [],
    themes: [],
    evidenceLinks: [],
    personas: [],
    quantitativeMetrics: [],
    opportunities: [],
    risks: [],
    contradictions: [],
    reports: [],
    quality: { overallScore: 0, sampleSize: 0, completenessScore: 0, sourceDiversityScore: 0, triangulationScore: 0, structureScore: 0, notes: [], generatedAt: new Date().toISOString() },
    methods: { analysisMode: "decision-grade", quantitativeApproach: "", qualitativeApproach: "", limitations: [] },
  };
}

async function loadSimulationReport(projectRoot: string, runId: string) {
  const store = new FileSimulationStore(projectRoot);
  const run = await store.loadRun(runId);
  if (!run) return null;
  const adapter = run.adapter === "model-swarm"
    ? new ModelSwarmSimulationAdapter({ store })
    : new LocalSimulationAdapter({ store });
  return adapter.exportReport(runId);
}
