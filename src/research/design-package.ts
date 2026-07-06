import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MermaidJamIntegration } from "../integrations/mermaid-jam.js";
import { resolveMermaidJamIntegration } from "../integrations/mermaid-jam.js";
import {
  ComponentSpecSchema,
  DataVizSpecSchema,
  DesignSpecSchema,
  IASpecSchema,
  PageSpecSchema,
  type AnySpec,
  type ComponentSpec,
  type DataVizSpec,
  type DesignSpec,
  type IASpec,
  type PageSpec,
} from "../specs/types.js";
import type { Registry } from "../engine/registry.js";
import type {
  ResearchContradiction,
  ResearchFinding,
  ResearchPersona,
  ResearchQuantitativeMetric,
  ResearchRisk,
  ResearchStore,
  ResearchTheme,
} from "./engine.js";
import type { SimulationReport } from "../simulation/types.js";

export type MermaidJamArtifactKind = "journey-map" | "ia-flow" | "evidence-map" | "simulation-timeline";
export type MermaidJamArtifactFormat = "mermaid" | "markdown";

export interface ResearchDesignBrief {
  audience: string[];
  vibePrinciples: string[];
  visualDirection: string[];
  interactionTone: string[];
  productMoments: string[];
  constraints: string[];
  openQuestions: string[];
}

export interface ResearchDesignPackageSpecs {
  design: DesignSpec[];
  ia: IASpec[];
  pages: PageSpec[];
  components: ComponentSpec[];
  dataviz: DataVizSpec[];
}

export interface ResearchDesignMermaidArtifact {
  id: string;
  title: string;
  format: MermaidJamArtifactFormat;
  kind: MermaidJamArtifactKind;
  source: string;
}

export interface ResearchDesignPackage {
  id: string;
  name: string;
  generatedAt: string;
  intent: string;
  hypothesis: string;
  sourceRunId?: string;
  brief: ResearchDesignBrief;
  evidenceIds: string[];
  specs: ResearchDesignPackageSpecs;
  mermaidArtifacts: ResearchDesignMermaidArtifact[];
  warnings: string[];
}

export interface BuildResearchDesignPackageOptions {
  intent?: string;
  hypothesis?: string;
  simulationReport?: SimulationReport | null;
  now?: () => Date;
}

export interface MermaidJamExport {
  id: string;
  title: string;
  format: MermaidJamArtifactFormat;
  kind: MermaidJamArtifactKind;
  source: string;
  outputPath: string;
  integration: MermaidJamIntegration;
  nextSteps: string[];
}

export interface WriteMermaidJamArtifactsOptions {
  projectRoot: string;
  integration?: MermaidJamIntegration;
}

export interface ResearchDesignSpecWriteResult {
  written: string[];
  count: number;
}

const DEFAULT_INTENT = "Design a research-backed product decision surface";
const DEFAULT_HYPOTHESIS = "Evidence-linked design improves product decision confidence";

export function buildResearchDesignPackage(
  research: ResearchStore,
  options: BuildResearchDesignPackageOptions = {},
): ResearchDesignPackage {
  const intent = options.intent?.trim() || DEFAULT_INTENT;
  const hypothesis = options.hypothesis?.trim() || options.simulationReport?.hypothesis || DEFAULT_HYPOTHESIS;
  const generatedAt = (options.now?.() ?? new Date()).toISOString();
  const findings = research.findings ?? [];
  const personas = research.personas ?? [];
  const themes = research.themes ?? [];
  const risks = research.risks ?? [];
  const contradictions = research.contradictions ?? [];
  const metrics = research.quantitativeMetrics ?? [];
  const report = options.simulationReport ?? null;
  const evidenceIds = unique([
    ...findings.map((finding) => finding.id),
    ...(personas.flatMap((persona) => persona.evidenceFindingIds ?? [])),
    ...(risks.flatMap((risk) => risk.evidenceFindingIds ?? [])),
    ...(contradictions.flatMap((item) => [...item.positiveFindingIds, ...item.negativeFindingIds])),
    ...(report?.evidenceFindingIds ?? []),
  ]).filter((id) => findings.some((finding) => finding.id === id) || report?.evidenceFindingIds.includes(id));
  const brief = buildBrief({ intent, hypothesis, findings, personas, themes, risks, contradictions, metrics, report });
  const specs = buildSpecs({ intent, hypothesis, evidenceIds, brief, findings, personas, themes, risks, metrics, report });
  const id = `research-design-${hashFor([intent, hypothesis, ...evidenceIds, report?.runId ?? ""])}`;
  const mermaidArtifacts = buildMermaidArtifacts({
    packageId: id,
    intent,
    hypothesis,
    findings,
    personas,
    risks,
    metrics,
    report,
  });

  return {
    id,
    name: "Research Vibe Design Package",
    generatedAt,
    intent,
    hypothesis,
    sourceRunId: report?.runId,
    brief,
    evidenceIds,
    specs,
    mermaidArtifacts,
    warnings: buildWarnings({ findings, personas, risks, contradictions, metrics, qualityScore: research.quality?.overallScore ?? null }),
  };
}

export async function writeMermaidJamArtifacts(
  designPackage: ResearchDesignPackage,
  options: WriteMermaidJamArtifactsOptions,
): Promise<MermaidJamExport[]> {
  const integration = options.integration ?? await resolveMermaidJamIntegration({ projectRoot: options.projectRoot });
  const outputDir = join(options.projectRoot, ".memoire", "mermaid-jam", designPackage.id);
  await mkdir(outputDir, { recursive: true });

  const exports: MermaidJamExport[] = [];
  for (const artifact of designPackage.mermaidArtifacts) {
    const extension = artifact.format === "markdown" ? "md" : "mmd";
    const outputPath = join(outputDir, `${slugify(artifact.title)}.${extension}`);
    await writeFile(outputPath, artifact.source, "utf-8");
    exports.push({
      ...artifact,
      outputPath,
      integration,
      nextSteps: [
        `Open Mermaid Jam in FigJam using ${integration.local.ready && integration.local.manifestPath ? integration.local.manifestPath : integration.communityUrl}.`,
        `paste the saved source from ${outputPath} into Mermaid Jam to create editable FigJam output.`,
      ],
    });
  }

  return exports;
}

export async function saveResearchDesignSpecs(
  designPackage: ResearchDesignPackage,
  registry: Pick<Registry, "saveSpec">,
): Promise<ResearchDesignSpecWriteResult> {
  const specs = allSpecs(designPackage);
  for (const spec of specs) await registry.saveSpec(spec);
  return { written: specs.map((spec) => spec.name), count: specs.length };
}

export function allResearchDesignSpecs(designPackage: ResearchDesignPackage): AnySpec[] {
  return allSpecs(designPackage);
}

function buildBrief(input: {
  intent: string;
  hypothesis: string;
  findings: ResearchFinding[];
  personas: ResearchPersona[];
  themes: ResearchTheme[];
  risks: ResearchRisk[];
  contradictions: ResearchContradiction[];
  metrics: ResearchQuantitativeMetric[];
  report: SimulationReport | null;
}): ResearchDesignBrief {
  const audience = input.personas.length
    ? input.personas.map((persona) => persona.role || persona.name)
    : ["Product team: turn research into a decision-ready spec"];
  const topFindings = input.findings.slice(0, 4).map((finding) => finding.statement);
  const topThemes = input.themes.slice(0, 3).map((theme) => theme.name);
  const recommendations = input.report?.recommendations.slice(0, 3) ?? [];

  return {
    audience,
    vibePrinciples: unique([
      "Evidence-first: every major requirement links to a finding id.",
      "Calm but decisive: prioritize scan-friendly choices over decorative storytelling.",
      "Agent-native: make assumptions, risks, and tool handoffs explicit.",
      ...topThemes.map((theme) => `Research theme: ${theme}`),
      ...recommendations.map((recommendation) => `Simulation recommendation: ${recommendation}`),
    ]),
    visualDirection: [
      "Use dense but organized workbench panels, clear hierarchy, and restrained color accents.",
      "Represent personas, evidence, risks, metrics, and outcomes as connected decision objects.",
      "Keep FigJam output editable: sections, cards, connectors, and labels should survive handoff.",
    ],
    interactionTone: [
      "Guide product people from evidence review to spec commitment without hiding uncertainty.",
      "Prefer reversible decisions, explicit review states, and visible confidence signals.",
    ],
    productMoments: [
      input.intent,
      input.hypothesis,
      ...topFindings,
      ...(input.report ? [input.report.summary] : []),
    ].filter(Boolean),
    constraints: [
      ...input.risks.slice(0, 3).map((risk) => risk.summary || risk.title),
      ...input.contradictions.slice(0, 3).map((item) => item.summary),
    ],
    openQuestions: input.contradictions.length
      ? input.contradictions.map((item) => `Resolve contradiction: ${item.topic}`)
      : ["Which evidence threshold is enough to move from design exploration to build handoff?"],
  };
}

function buildSpecs(input: {
  intent: string;
  hypothesis: string;
  evidenceIds: string[];
  brief: ResearchDesignBrief;
  findings: ResearchFinding[];
  personas: ResearchPersona[];
  themes: ResearchTheme[];
  risks: ResearchRisk[];
  metrics: ResearchQuantitativeMetric[];
  report: SimulationReport | null;
}): ResearchDesignPackageSpecs {
  const backing = input.evidenceIds;

  // Selective research backing: each component cites only the evidence that
  // actually backs its role, not a blanket stamp of every finding id. An
  // empty list is honest — it means "no research backs this yet", and the
  // traceability audit surfaces it instead of a fabricated citation hiding it.
  const validIds = new Set(input.evidenceIds);
  const keep = (ids: Array<string | undefined>) =>
    unique(ids.filter((id): id is string => Boolean(id) && validIds.has(id as string)));
  const findingBacking = keep(input.findings.map((finding) => finding.id));
  const personaBacking = keep(input.personas.flatMap((persona) => persona.evidenceFindingIds ?? []));
  const riskBacking = keep(input.risks.flatMap((risk) => risk.evidenceFindingIds));
  const reportBacking = keep(input.report?.evidenceFindingIds ?? []);
  const backingByComponent: Record<string, string[]> = {
    EvidenceCard: findingBacking,
    PersonaChip: personaBacking,
    AssumptionRow: riskBacking,
    MetricTile: reportBacking,
    ResearchHero: findingBacking.slice(0, 3),
    DecisionPanel: findingBacking,
    ScenarioTimeline: reportBacking,
    RiskReviewPanel: keep([...riskBacking, ...findingBacking.slice(0, 2)]),
    ProductDecisionTemplate: keep([...findingBacking, ...personaBacking, ...riskBacking, ...reportBacking]),
  };

  const design = [DesignSpecSchema.parse({
    name: "ResearchVibeDirection",
    type: "design",
    purpose: `Research-backed visual and interaction direction for ${input.intent}.`,
    notes: [
      ...input.brief.vibePrinciples,
      ...input.brief.visualDirection,
      ...input.brief.interactionTone,
    ],
    linkedSpecs: ["ProductDecisionPage", "ResearchBackedIA"],
    tags: ["research-vibe-design", "mermaid-jam"],
  })];

  const ia = [IASpecSchema.parse({
    name: "ResearchBackedIA",
    type: "ia",
    purpose: `Information architecture for ${input.hypothesis}.`,
    root: {
      id: "research-backed-product-decision",
      label: "Research-backed product decision",
      type: "page",
      linkedPageSpec: "ProductDecisionPage",
      children: [
        { id: "evidence-review", label: "Evidence review", type: "section", linkedPageSpec: "ProductDecisionPage", children: [], notes: input.findings[0]?.statement },
        { id: "decision-criteria", label: "Decision criteria", type: "section", children: [], notes: input.hypothesis },
        { id: "risk-review", label: "Risk review", type: "section", children: [], notes: input.risks[0]?.summary },
        { id: "spec-handoff", label: "Spec handoff", type: "section", children: [], notes: input.report?.summary },
      ],
    },
    flows: [
      { from: "evidence-review", to: "decision-criteria", label: "select evidence", trigger: "click" },
      { from: "decision-criteria", to: "risk-review", label: "check assumptions", trigger: "click" },
      { from: "risk-review", to: "spec-handoff", label: "approve handoff", trigger: "click" },
    ],
    entryPoints: ["evidence-review"],
    globals: [{ label: "Research", linkedPageSpec: "ProductDecisionPage" }],
    notes: input.brief.openQuestions,
    tags: ["research-vibe-design"],
  })];

  const components = componentSpecs(backingByComponent);
  const pages = [PageSpecSchema.parse({
    name: "ProductDecisionPage",
    type: "page",
    purpose: `Decision-ready page for ${input.intent}.`,
    researchBacking: backing,
    layout: "dashboard",
    sections: [
      { name: "Hero", component: "ResearchHero", repeat: 1, layout: "full-width", props: { evidenceIds: backing.slice(0, 3) } },
      { name: "Decision", component: "DecisionPanel", repeat: 1, layout: "grid-2", props: { hypothesis: input.hypothesis } },
      { name: "Timeline", component: "ScenarioTimeline", repeat: 1, layout: "full-width", props: { runId: input.report?.runId ?? null } },
      { name: "Risk Review", component: "RiskReviewPanel", repeat: 1, layout: "full-width", props: { risks: input.risks.map((risk) => risk.title) } },
    ],
    shadcnLayout: ["Card", "Tabs", "ScrollArea", "Badge"],
    meta: {
      title: "Research-backed product decision",
      description: input.hypothesis,
    },
    tags: ["research-vibe-design", "product-spec"],
  })];

  const dataviz = input.metrics.slice(0, 2).map((metric, index) => DataVizSpecSchema.parse({
    name: index === 0 ? "MetricTileSignal" : `MetricTileSignal${index + 1}`,
    type: "dataviz",
    purpose: `Show ${metric.label || metric.field} as a research-backed decision signal.`,
    chartType: metric.buckets?.length ? "bar" : "gauge",
    dataShape: { x: "label", y: metric.field, series: ["value"] },
    interactions: ["hover-tooltip"],
    sampleData: [{ label: metric.label || metric.field, value: metric.mean }],
    tags: ["research-vibe-design", metric.id],
  }));

  return { design, ia, pages, components, dataviz };
}

function componentSpecs(backingByComponent: Record<string, string[]>): ComponentSpec[] {
  const backingFor = (name: string): string[] => backingByComponent[name] ?? [];
  return [
    component("EvidenceCard", "atom", "Compact evidence citation card with finding id, confidence, and source cue.", backingFor("EvidenceCard")),
    component("PersonaChip", "atom", "Persona badge that keeps audience and pain point visible during design review.", backingFor("PersonaChip")),
    component("AssumptionRow", "atom", "Single unresolved assumption row with owner and decision state.", backingFor("AssumptionRow")),
    component("MetricTile", "atom", "Metric tile for confidence, adoption, risk, or quality signals.", backingFor("MetricTile")),
    component("ResearchHero", "molecule", "Research-backed hero summarizing audience, hypothesis, and strongest evidence.", backingFor("ResearchHero"), ["EvidenceCard", "PersonaChip"]),
    component("DecisionPanel", "organism", "Decision workspace for recommendations, acceptance criteria, and evidence links.", backingFor("DecisionPanel"), ["EvidenceCard", "AssumptionRow", "MetricTile"]),
    component("ScenarioTimeline", "organism", "Round-by-round model-swarm or local scenario timeline.", backingFor("ScenarioTimeline"), ["EvidenceCard", "MetricTile"]),
    component("RiskReviewPanel", "organism", "Risk and contradiction review panel before product-spec handoff.", backingFor("RiskReviewPanel"), ["AssumptionRow", "EvidenceCard"]),
    component("ProductDecisionTemplate", "template", "Page template for research-backed product decision work.", backingFor("ProductDecisionTemplate"), ["ResearchHero", "DecisionPanel", "ScenarioTimeline", "RiskReviewPanel"]),
  ];
}

function component(name: string, level: ComponentSpec["level"], purpose: string, researchBacking: string[], composesSpecs: string[] = []): ComponentSpec {
  return ComponentSpecSchema.parse({
    name,
    type: "component",
    level,
    purpose,
    researchBacking,
    variants: ["default", "selected", "review"],
    props: {
      evidenceIds: "string[]",
      confidence: "number | undefined",
      state: "\"default\" | \"selected\" | \"review\"",
    },
    shadcnBase: ["Card", "Badge", "Button"],
    composesSpecs,
    tags: ["research-vibe-design"],
  });
}

function buildMermaidArtifacts(input: {
  packageId: string;
  intent: string;
  hypothesis: string;
  findings: ResearchFinding[];
  personas: ResearchPersona[];
  risks: ResearchRisk[];
  metrics: ResearchQuantitativeMetric[];
  report: SimulationReport | null;
}): ResearchDesignMermaidArtifact[] {
  const artifacts: ResearchDesignMermaidArtifact[] = [
    {
      id: `${input.packageId}-journey`,
      title: "Research Journey Map",
      format: "mermaid",
      kind: "journey-map",
      source: journeyMapSource(input.personas, input.findings, input.risks),
    },
    {
      id: `${input.packageId}-ia-flow`,
      title: "Research Backed IA Flow",
      format: "mermaid",
      kind: "ia-flow",
      source: iaFlowSource(input.hypothesis),
    },
    {
      id: `${input.packageId}-evidence-map`,
      title: "Evidence To Spec Map",
      format: "mermaid",
      kind: "evidence-map",
      source: evidenceMapSource(input.findings, input.risks, input.metrics),
    },
  ];

  if (input.report) {
    artifacts.push({
      id: `${input.packageId}-timeline`,
      title: "Simulation Timeline",
      format: "mermaid",
      kind: "simulation-timeline",
      source: simulationTimelineSource(input.report),
    });
  }

  return artifacts;
}

function journeyMapSource(personas: ResearchPersona[], findings: ResearchFinding[], risks: ResearchRisk[]): string {
  const persona = personas[0];
  const actor = sanitizeMermaidText(persona?.name ?? persona?.role ?? "Product team");
  const finding = sanitizeMermaidText(findings[0]?.statement ?? "Review research evidence");
  const risk = sanitizeMermaidText(risks[0]?.title ?? "Check unresolved assumptions");
  return [
    "journey",
    "  title Research-backed product decision journey",
    "  section Discover",
    `    ${finding}: 4: ${actor}`,
    "  section Decide",
    `    Connect evidence to product requirement: 5: ${actor}`,
    "  section De-risk",
    `    ${risk}: 3: ${actor}`,
    "  section Handoff",
    `    Export specs and FigJam map: 5: ${actor}`,
  ].join("\n");
}

function iaFlowSource(hypothesis: string): string {
  return [
    "flowchart TD",
    `  start["${sanitizeMermaidText(hypothesis)}"]`,
    "  evidence[\"Evidence review\"]",
    "  criteria[\"Decision criteria\"]",
    "  risks[\"Risk review\"]",
    "  specs[\"Atomic specs\"]",
    "  figjam[\"Mermaid Jam FigJam export\"]",
    "  start --> evidence --> criteria --> risks --> specs --> figjam",
  ].join("\n");
}

function evidenceMapSource(findings: ResearchFinding[], risks: ResearchRisk[], metrics: ResearchQuantitativeMetric[]): string {
  const lines = [
    "flowchart TD",
    "  page[\"ProductDecisionPage\"]",
    "  template[\"ProductDecisionTemplate\"]",
    "  page --> template",
  ];
  for (const finding of findings.slice(0, 5)) {
    const id = mermaidId(finding.id);
    lines.push(`  ${id}["${sanitizeMermaidText(finding.id)}: ${sanitizeMermaidText(finding.statement)}"]`);
    lines.push(`  ${id} --> page`);
  }
  for (const risk of risks.slice(0, 3)) {
    const id = mermaidId(`risk-${risk.title}`);
    lines.push(`  ${id}["Risk: ${sanitizeMermaidText(risk.title)}"]`);
    lines.push(`  ${id} --> template`);
  }
  for (const metric of metrics.slice(0, 3)) {
    const id = mermaidId(metric.id);
    lines.push(`  ${id}["Metric: ${sanitizeMermaidText(metric.label || metric.field)}"]`);
    lines.push(`  ${id} --> metricTile["MetricTile"]`);
  }
  return lines.join("\n");
}

function simulationTimelineSource(report: SimulationReport): string {
  const lines = [
    "timeline",
    `  title ${sanitizeMermaidText(report.scenarioName)} design impact`,
  ];
  if (!report.rounds.length) {
    lines.push(`  ${sanitizeMermaidText(report.generatedAt)} : Report : ${sanitizeMermaidText(report.summary)}`);
  }
  for (const round of report.rounds.slice(0, 8)) {
    lines.push(`  Round ${round.index} : ${sanitizeMermaidText(round.phase)} : adoption ${Math.round(round.scorecard.adoption * 100)}%, risk ${Math.round(round.scorecard.risk * 100)}%`);
  }
  for (const recommendation of report.recommendations.slice(0, 4)) {
    lines.push(`  Recommendation : ${sanitizeMermaidText(recommendation)}`);
  }
  return lines.join("\n");
}

function buildWarnings(input: {
  findings: ResearchFinding[];
  personas: ResearchPersona[];
  risks: ResearchRisk[];
  contradictions: ResearchContradiction[];
  metrics: ResearchQuantitativeMetric[];
  qualityScore: number | null;
}): string[] {
  const warnings: string[] = [];
  if (!input.findings.length) warnings.push("No research findings were available; generated specs do not invent evidence citations.");
  if (!input.personas.length) warnings.push("No personas were available; audience defaults to product team.");
  if (input.findings.some((finding) => finding.confidence === "low")) warnings.push("Low-confidence findings were included as supporting context only.");
  if (input.contradictions.length) warnings.push(`${input.contradictions.length} contradiction${input.contradictions.length === 1 ? "" : "s"} should be resolved before final build handoff.`);
  if (!input.metrics.length) warnings.push("No quantitative metrics were available for dataviz specs.");
  if (input.qualityScore !== null && input.qualityScore < 60) warnings.push(`Research quality score is ${input.qualityScore}; treat generated specs as exploratory.`);
  return warnings;
}

function allSpecs(designPackage: ResearchDesignPackage): AnySpec[] {
  return [
    ...designPackage.specs.design,
    ...designPackage.specs.ia,
    ...designPackage.specs.pages,
    ...designPackage.specs.components,
    ...designPackage.specs.dataviz,
  ];
}

function hashFor(values: string[]): string {
  return createHash("sha1").update(values.join("\n")).digest("hex").slice(0, 10);
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "artifact";
}

function mermaidId(value: string): string {
  return slugify(value).replace(/-/g, "_");
}

function sanitizeMermaidText(value: string): string {
  return value.replace(/["\n\r]/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
}
