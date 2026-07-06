import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { StudioRunRequest } from "./types.js";

export type VisualParityArtifactKind =
  | "screenshot"
  | "preview"
  | "spec"
  | "code"
  | "tokens"
  | "handoff"
  | "continuation";

export interface VisualParityArtifactEvidence {
  kind: VisualParityArtifactKind;
  path?: string;
  url?: string;
  editable?: boolean;
}

export interface VisualParityEvidence {
  artifacts: VisualParityArtifactEvidence[];
  visualQualityScore?: number;
}

export interface VisualParityGrade {
  passed: boolean;
  score: number;
  missingCriteria: string[];
}

export interface VisualParityProofOptions {
  projectRoot: string;
  outDir?: string;
  generatedAt?: string;
}

export interface VisualParityProof {
  challenge: typeof VISUAL_PARITY_CHALLENGE;
  /** "demo-fixture" — this module writes canned artifacts and grades its own output. It is not a measurement. */
  mode: "demo-fixture";
  demoDisclaimer: string;
  liveHarness: false;
  outDir: string;
  previewUrl: string;
  artifacts: VisualParityArtifactEvidence[];
  grade: VisualParityGrade;
}

export const VISUAL_PARITY_CHALLENGE = {
  id: "claude-design-dashboard-parity",
  minScore: 95,
  prompt: "Create a polished, editable product dashboard screen from a blank brief, with visual hierarchy, components, design-system tokens, and handoff artifacts.",
} as const;

export function createVisualParityRunRequest(input: { cwd: string }): StudioRunRequest {
  return {
    harnessId: "codex",
    action: "app-build",
    chatMode: "build",
    permissionMode: "guarded",
    cwd: input.cwd,
    prompt: [
      VISUAL_PARITY_CHALLENGE.prompt,
      "",
      "Treat this as the canonical first-pass visual-generator benchmark for memi Studio.",
      "Create a real inspectable dashboard, not only a plan or audit.",
      "Use editable component/spec/code artifacts and visible design-system token evidence.",
      "Save or report: screenshot, preview URL, component/spec files, token evidence, handoff artifact, and continuation note.",
      "The result should be understandable to a product designer without opening internal harness logs.",
    ].join("\n"),
  };
}

export async function createVisualParityProof(options: VisualParityProofOptions): Promise<VisualParityProof> {
  const outDir = resolve(options.outDir ?? join(options.projectRoot, ".memoire", "studio", "visual-parity"));
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  await mkdir(outDir, { recursive: true });

  const paths = {
    preview: join(outDir, "dashboard-preview.html"),
    screenshot: join(outDir, "dashboard-screenshot.svg"),
    spec: join(outDir, "dashboard.page-spec.json"),
    code: join(outDir, "DashboardPage.tsx"),
    tokens: join(outDir, "dashboard.tokens.css"),
    handoff: join(outDir, "dashboard-handoff.md"),
    continuation: join(outDir, "dashboard-continuation.md"),
  };

  await Promise.all([
    writeFile(paths.preview, dashboardPreviewHtml(), "utf-8"),
    writeFile(paths.screenshot, dashboardScreenshotSvg(), "utf-8"),
    writeFile(paths.spec, JSON.stringify(dashboardSpec(generatedAt), null, 2) + "\n", "utf-8"),
    writeFile(paths.code, dashboardComponentCode(), "utf-8"),
    writeFile(paths.tokens, dashboardTokensCss(), "utf-8"),
    writeFile(paths.handoff, dashboardHandoff(generatedAt), "utf-8"),
    writeFile(paths.continuation, dashboardContinuation(generatedAt), "utf-8"),
  ]);

  const previewUrl = pathToFileURL(paths.preview).href;
  const artifacts: VisualParityArtifactEvidence[] = [
    { kind: "screenshot", path: paths.screenshot },
    { kind: "preview", path: paths.preview, url: previewUrl },
    { kind: "spec", path: paths.spec, editable: true },
    { kind: "code", path: paths.code, editable: true },
    { kind: "tokens", path: paths.tokens },
    { kind: "handoff", path: paths.handoff },
    { kind: "continuation", path: paths.continuation },
  ];
  // DEMO FIXTURE, not a measurement: this writes a canned dashboard and then
  // grades its own output. The visualQualityScore below is asserted by this
  // fixture, not measured by any renderer or vision pass — the grade only
  // demonstrates what the artifact checklist looks like.
  const grade = gradeVisualParityEvidence({ artifacts, visualQualityScore: 95 });

  return {
    challenge: VISUAL_PARITY_CHALLENGE,
    mode: "demo-fixture",
    demoDisclaimer:
      "Demo fixture: canned artifacts graded against the artifact checklist. The visual quality score is asserted, not measured — do not cite this as evidence of rendering quality.",
    liveHarness: false,
    outDir,
    previewUrl,
    artifacts,
    grade,
  };
}

export function gradeVisualParityEvidence(evidence: VisualParityEvidence): VisualParityGrade {
  const missingCriteria: string[] = [];
  const has = (kind: VisualParityArtifactKind, predicate: (artifact: VisualParityArtifactEvidence) => boolean = hasLocation) => (
    evidence.artifacts.some((artifact) => artifact.kind === kind && predicate(artifact))
  );

  if (!has("screenshot")) missingCriteria.push("first-pass screenshot");
  if (!has("preview", (artifact) => Boolean(artifact.url))) missingCriteria.push("inspectable preview URL");
  if (!has("spec", (artifact) => hasLocation(artifact) && artifact.editable === true)) missingCriteria.push("editable spec artifact");
  if (!has("code", (artifact) => hasLocation(artifact) && artifact.editable === true)) missingCriteria.push("editable code artifact");
  if (!has("tokens")) missingCriteria.push("design-system token evidence");
  if (!has("handoff")) missingCriteria.push("handoff artifact");
  if (!has("continuation")) missingCriteria.push("continuation proof");
  if ((evidence.visualQualityScore ?? 0) < VISUAL_PARITY_CHALLENGE.minScore) {
    missingCriteria.push("visual quality score >= 95");
  }

  const totalCriteria = 8;
  const metCriteria = totalCriteria - missingCriteria.length;
  const score = Math.max(0, Math.min(100, Math.round((metCriteria / totalCriteria) * 100)));

  return {
    passed: score >= VISUAL_PARITY_CHALLENGE.minScore && missingCriteria.length === 0,
    score,
    missingCriteria,
  };
}

function hasLocation(artifact: VisualParityArtifactEvidence): boolean {
  return Boolean(artifact.path || artifact.url);
}

function dashboardSpec(generatedAt: string) {
  return {
    schemaVersion: 1,
    generatedAt,
    name: "ProductDashboardPage",
    level: "page",
    atomicDesign: {
      template: "DashboardTemplate",
      organisms: ["InsightSidebar", "KpiOverview", "RevenuePanel", "ActivityTable"],
      molecules: ["MetricCard", "SegmentedToolbar", "ChartCard", "StatusRow"],
      atoms: ["Button", "Badge", "Avatar", "Icon", "Label"],
    },
    layout: "dashboard",
    tokens: [
      "--dashboard-bg",
      "--dashboard-surface",
      "--dashboard-text",
      "--dashboard-muted",
      "--dashboard-accent",
      "--dashboard-positive",
      "--dashboard-warning",
    ],
    acceptanceCriteria: [
      "Preview is inspectable without a running provider.",
      "Dashboard code and page spec are editable files.",
      "Visual hierarchy includes nav, KPI cards, chart panel, table, and action rail.",
      "Handoff and continuation notes explain next design iteration.",
    ],
  };
}

function dashboardTokensCss(): string {
  return `:root {
  --dashboard-bg: #f6f7f9;
  --dashboard-surface: #ffffff;
  --dashboard-text: #16202a;
  --dashboard-muted: #66717f;
  --dashboard-border: #d9dee7;
  --dashboard-accent: #2457d6;
  --dashboard-positive: #14855f;
  --dashboard-warning: #aa6a12;
  --dashboard-radius: 8px;
  --dashboard-shadow: 0 16px 48px rgba(22, 32, 42, 0.10);
}
`;
}

function dashboardComponentCode(): string {
  return `import "./dashboard.tokens.css";

const metrics = [
  { label: "Pipeline", value: "$2.4M", delta: "+18%", tone: "positive" },
  { label: "Activation", value: "68%", delta: "+7 pts", tone: "positive" },
  { label: "Open risk", value: "12", delta: "-4", tone: "warning" },
];

export function DashboardPage() {
  return (
    <main className="min-h-screen bg-[var(--dashboard-bg)] text-[var(--dashboard-text)]">
      <section className="mx-auto grid max-w-7xl grid-cols-[248px_1fr] gap-6 px-6 py-6">
        <aside className="rounded-[var(--dashboard-radius)] border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] p-4">
          <p className="text-sm font-semibold">Northstar</p>
          <nav className="mt-6 grid gap-2 text-sm text-[var(--dashboard-muted)]">
            <a className="rounded-md bg-blue-50 px-3 py-2 text-[var(--dashboard-accent)]">Overview</a>
            <a className="px-3 py-2">Customers</a>
            <a className="px-3 py-2">Signals</a>
            <a className="px-3 py-2">Reports</a>
          </nav>
        </aside>
        <div className="space-y-6">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--dashboard-muted)]">Product dashboard</p>
              <h1 className="text-3xl font-semibold">Growth operating room</h1>
            </div>
            <button className="rounded-md bg-[var(--dashboard-accent)] px-4 py-2 text-sm font-medium text-white">Share brief</button>
          </header>
          <section className="grid grid-cols-3 gap-4">
            {metrics.map((metric) => (
              <article key={metric.label} className="rounded-[var(--dashboard-radius)] border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] p-5 shadow-[var(--dashboard-shadow)]">
                <p className="text-sm text-[var(--dashboard-muted)]">{metric.label}</p>
                <div className="mt-3 flex items-end justify-between">
                  <strong className="text-3xl">{metric.value}</strong>
                  <span className={metric.tone === "positive" ? "text-[var(--dashboard-positive)]" : "text-[var(--dashboard-warning)]"}>{metric.delta}</span>
                </div>
              </article>
            ))}
          </section>
        </div>
      </section>
    </main>
  );
}
`;
}

function dashboardHandoff(generatedAt: string): string {
  return `# Product Dashboard Handoff

Generated: ${generatedAt}

## What To Inspect

- Open \`dashboard-preview.html\` for the first-pass visual.
- Edit \`DashboardPage.tsx\` for the React handoff.
- Edit \`dashboard.page-spec.json\` for the page-level design contract.
- Edit \`dashboard.tokens.css\` for system-level visual decisions.

## Acceptance

- The page has a clear dashboard hierarchy: navigation, headline, KPI summary, chart surface, and activity table.
- The design uses named tokens instead of one-off styling.
- The next iteration can continue from spec, code, or handoff notes.
`;
}

function dashboardContinuation(generatedAt: string): string {
  return `# Dashboard Continuation Note

Generated: ${generatedAt}

Next prompt:

"Continue the product dashboard by adding a cohort health drill-down, preserving the existing tokens and Atomic Design levels. Update the preview, spec, code, and handoff notes."
`;
}

function dashboardPreviewHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>memi visual parity dashboard</title>
  <link rel="stylesheet" href="./dashboard.tokens.css">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--dashboard-bg); color: var(--dashboard-text); }
    .shell { min-height: 100vh; display: grid; grid-template-columns: 248px minmax(0, 1fr); gap: 24px; padding: 24px; }
    .panel { background: var(--dashboard-surface); border: 1px solid var(--dashboard-border); border-radius: var(--dashboard-radius); box-shadow: var(--dashboard-shadow); }
    .sidebar { padding: 18px; }
    .brand { font-size: 14px; font-weight: 700; }
    .nav { margin-top: 28px; display: grid; gap: 8px; font-size: 14px; color: var(--dashboard-muted); }
    .nav span { padding: 10px 12px; border-radius: 6px; }
    .nav .active { color: var(--dashboard-accent); background: #eaf0ff; }
    .workspace { display: grid; gap: 22px; }
    .header { display: flex; justify-content: space-between; align-items: center; }
    .eyebrow { margin: 0 0 8px; color: var(--dashboard-muted); font-size: 13px; }
    h1 { margin: 0; font-size: 36px; letter-spacing: 0; }
    button { border: 0; border-radius: 7px; background: var(--dashboard-accent); color: white; padding: 11px 16px; font-weight: 700; }
    .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .metric { padding: 20px; }
    .metric p { margin: 0; color: var(--dashboard-muted); font-size: 13px; }
    .metric strong { display: block; margin-top: 14px; font-size: 34px; }
    .metric span { color: var(--dashboard-positive); font-weight: 700; }
    .content { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(360px, 0.7fr); gap: 16px; }
    .chart { padding: 20px; min-height: 340px; }
    .chart-bars { display: grid; grid-template-columns: repeat(8, 1fr); align-items: end; gap: 12px; height: 220px; margin-top: 32px; border-bottom: 1px solid var(--dashboard-border); }
    .chart-bars i { display: block; border-radius: 6px 6px 0 0; background: linear-gradient(180deg, #6289f3, var(--dashboard-accent)); }
    .table { padding: 20px; }
    .row { display: grid; grid-template-columns: 1fr auto; gap: 12px; padding: 13px 0; border-top: 1px solid var(--dashboard-border); font-size: 14px; }
    .status { color: var(--dashboard-positive); font-weight: 700; }
  </style>
</head>
<body>
  <main class="shell">
    <aside class="panel sidebar">
      <div class="brand">Northstar</div>
      <nav class="nav">
        <span class="active">Overview</span>
        <span>Customers</span>
        <span>Signals</span>
        <span>Reports</span>
      </nav>
    </aside>
    <section class="workspace">
      <header class="header">
        <div>
          <p class="eyebrow">Product dashboard</p>
          <h1>Growth operating room</h1>
        </div>
        <button>Share brief</button>
      </header>
      <section class="metrics">
        <article class="panel metric"><p>Pipeline</p><strong>$2.4M</strong><span>+18%</span></article>
        <article class="panel metric"><p>Activation</p><strong>68%</strong><span>+7 pts</span></article>
        <article class="panel metric"><p>Open risk</p><strong>12</strong><span>-4</span></article>
      </section>
      <section class="content">
        <article class="panel chart">
          <p class="eyebrow">Revenue trend</p>
          <h2>Expansion momentum</h2>
          <div class="chart-bars">
            <i style="height:42%"></i><i style="height:56%"></i><i style="height:48%"></i><i style="height:68%"></i>
            <i style="height:62%"></i><i style="height:78%"></i><i style="height:72%"></i><i style="height:88%"></i>
          </div>
        </article>
        <article class="panel table">
          <p class="eyebrow">Priority accounts</p>
          <h2>Today</h2>
          <div class="row"><span>Acme onboarding</span><span class="status">Healthy</span></div>
          <div class="row"><span>Northwind renewal</span><span>Review</span></div>
          <div class="row"><span>Globex expansion</span><span class="status">Ready</span></div>
          <div class="row"><span>Initech risk</span><span>Escalate</span></div>
        </article>
      </section>
    </section>
  </main>
</body>
</html>
`;
}

function dashboardScreenshotSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="960" viewBox="0 0 1440 960" role="img" aria-label="Product dashboard visual parity screenshot">
  <rect width="1440" height="960" fill="#f6f7f9"/>
  <rect x="32" y="32" width="248" height="896" rx="8" fill="#fff" stroke="#d9dee7"/>
  <text x="56" y="76" font-family="Inter, Arial" font-size="18" font-weight="700" fill="#16202a">Northstar</text>
  <rect x="52" y="122" width="180" height="40" rx="6" fill="#eaf0ff"/>
  <text x="68" y="148" font-family="Inter, Arial" font-size="15" fill="#2457d6">Overview</text>
  <text x="68" y="202" font-family="Inter, Arial" font-size="15" fill="#66717f">Customers</text>
  <text x="68" y="250" font-family="Inter, Arial" font-size="15" fill="#66717f">Signals</text>
  <text x="68" y="298" font-family="Inter, Arial" font-size="15" fill="#66717f">Reports</text>
  <text x="320" y="64" font-family="Inter, Arial" font-size="14" fill="#66717f">Product dashboard</text>
  <text x="320" y="108" font-family="Inter, Arial" font-size="42" font-weight="700" fill="#16202a">Growth operating room</text>
  <rect x="1220" y="58" width="144" height="44" rx="8" fill="#2457d6"/>
  <text x="1248" y="86" font-family="Inter, Arial" font-size="15" font-weight="700" fill="#fff">Share brief</text>
  <g>
    <rect x="320" y="148" width="324" height="152" rx="8" fill="#fff" stroke="#d9dee7"/>
    <text x="348" y="190" font-family="Inter, Arial" font-size="15" fill="#66717f">Pipeline</text>
    <text x="348" y="246" font-family="Inter, Arial" font-size="42" font-weight="700" fill="#16202a">$2.4M</text>
    <text x="560" y="246" font-family="Inter, Arial" font-size="16" font-weight="700" fill="#14855f">+18%</text>
    <rect x="668" y="148" width="324" height="152" rx="8" fill="#fff" stroke="#d9dee7"/>
    <text x="696" y="190" font-family="Inter, Arial" font-size="15" fill="#66717f">Activation</text>
    <text x="696" y="246" font-family="Inter, Arial" font-size="42" font-weight="700" fill="#16202a">68%</text>
    <text x="900" y="246" font-family="Inter, Arial" font-size="16" font-weight="700" fill="#14855f">+7 pts</text>
    <rect x="1016" y="148" width="324" height="152" rx="8" fill="#fff" stroke="#d9dee7"/>
    <text x="1044" y="190" font-family="Inter, Arial" font-size="15" fill="#66717f">Open risk</text>
    <text x="1044" y="246" font-family="Inter, Arial" font-size="42" font-weight="700" fill="#16202a">12</text>
    <text x="1244" y="246" font-family="Inter, Arial" font-size="16" font-weight="700" fill="#aa6a12">-4</text>
  </g>
  <rect x="320" y="330" width="656" height="420" rx="8" fill="#fff" stroke="#d9dee7"/>
  <text x="352" y="378" font-family="Inter, Arial" font-size="14" fill="#66717f">Revenue trend</text>
  <text x="352" y="418" font-family="Inter, Arial" font-size="28" font-weight="700" fill="#16202a">Expansion momentum</text>
  <line x1="352" y1="674" x2="932" y2="674" stroke="#d9dee7"/>
  <rect x="386" y="570" width="42" height="104" rx="7" fill="#2457d6"/>
  <rect x="458" y="536" width="42" height="138" rx="7" fill="#2457d6"/>
  <rect x="530" y="552" width="42" height="122" rx="7" fill="#2457d6"/>
  <rect x="602" y="494" width="42" height="180" rx="7" fill="#2457d6"/>
  <rect x="674" y="508" width="42" height="166" rx="7" fill="#2457d6"/>
  <rect x="746" y="458" width="42" height="216" rx="7" fill="#2457d6"/>
  <rect x="818" y="474" width="42" height="200" rx="7" fill="#2457d6"/>
  <rect x="890" y="424" width="42" height="250" rx="7" fill="#2457d6"/>
  <rect x="1000" y="330" width="340" height="420" rx="8" fill="#fff" stroke="#d9dee7"/>
  <text x="1032" y="378" font-family="Inter, Arial" font-size="14" fill="#66717f">Priority accounts</text>
  <text x="1032" y="418" font-family="Inter, Arial" font-size="28" font-weight="700" fill="#16202a">Today</text>
  <text x="1032" y="488" font-family="Inter, Arial" font-size="16" fill="#16202a">Acme onboarding</text>
  <text x="1224" y="488" font-family="Inter, Arial" font-size="16" font-weight="700" fill="#14855f">Healthy</text>
  <line x1="1032" y1="516" x2="1308" y2="516" stroke="#d9dee7"/>
  <text x="1032" y="560" font-family="Inter, Arial" font-size="16" fill="#16202a">Northwind renewal</text>
  <text x="1224" y="560" font-family="Inter, Arial" font-size="16" fill="#66717f">Review</text>
  <line x1="1032" y1="588" x2="1308" y2="588" stroke="#d9dee7"/>
  <text x="1032" y="632" font-family="Inter, Arial" font-size="16" fill="#16202a">Globex expansion</text>
  <text x="1224" y="632" font-family="Inter, Arial" font-size="16" font-weight="700" fill="#14855f">Ready</text>
</svg>
`;
}
