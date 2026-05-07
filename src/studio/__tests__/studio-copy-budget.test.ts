import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";

const BASELINE_VISIBLE_SENTENCES = 81;
const MAX_CORE_WORKBENCH_VISIBLE_SENTENCES = Math.floor(BASELINE_VISIBLE_SENTENCES * 0.55);

describe("Studio workbench copy budget", () => {
  it("keeps static workbench prose below the 0.16.3 baseline by at least 45%", async () => {
    const files = [
      join(process.cwd(), "apps", "studio", "src", "App.tsx"),
      join(process.cwd(), "apps", "studio", "src", "workbench-components.tsx"),
    ];
    const findings = (await Promise.all(files.map(visibleSentenceFindings))).flat();

    expect(findings.length, findings.map((finding) => `${finding.file}:${finding.line} ${finding.text}`).join("\n"))
      .toBeLessThanOrEqual(MAX_CORE_WORKBENCH_VISIBLE_SENTENCES);
  });

  it("removes paragraph-style chrome from scoped workbench states", async () => {
    const app = await readFile(join(process.cwd(), "apps", "studio", "src", "App.tsx"), "utf8");
    const components = await readFile(join(process.cwd(), "apps", "studio", "src", "workbench-components.tsx"), "utf8");
    const source = `${app}\n${components}`;

    expect(source).not.toContain("Start with a prompt.");
    expect(source).not.toContain("Run a design-system pull or open a completed audit to render the review canvas.");
    expect(source).not.toContain("Plan mode makes Codex inspect and research in read-only mode before edits");
    expect(source).not.toContain("Run a matrix to compare model mixes and hypotheses.");
  });
});

async function visibleSentenceFindings(file: string): Promise<Array<{ file: string; line: number; text: string }>> {
  const source = await readFile(file, "utf8");
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const ranges = scopedRanges(source, file);
  const findings: Array<{ file: string; line: number; text: string }> = [];

  function push(node: ts.Node, text: string) {
    const normalized = normalizeVisibleText(text);
    if (!normalized || !isInAnyRange(node.getStart(sourceFile), ranges)) return;
    if (!looksLikeVisibleSentence(normalized)) return;
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    findings.push({
      file: file.replace(`${process.cwd()}/`, ""),
      line: line + 1,
      text: normalized,
    });
  }

  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) push(node, node.getText(sourceFile));
    if (ts.isStringLiteralLike(node) && shouldCountStringLiteral(node)) push(node, node.text);
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

function shouldCountStringLiteral(node: ts.StringLiteralLike): boolean {
  const parent = node.parent;
  if (ts.isJsxAttribute(parent) && parent.initializer === node) {
    const name = parent.name.getText();
    if (name.startsWith("aria-")) return false;
    if (name.startsWith("data-")) return false;
    return ["title", "placeholder", "alt"].includes(name);
  }
  if (ts.isPropertyAssignment(parent) && parent.initializer === node) {
    const key = parent.name.getText().replace(/^["']|["']$/g, "");
    return ["label", "description", "prompt", "fallbackState", "summary"].includes(key);
  }
  return false;
}

function scopedRanges(source: string, file: string): Array<[number, number]> {
  const isApp = file.endsWith("App.tsx");
  const markers = isApp ? [
    ["const STARTER_PROMPTS", "const ACTIONS"],
    ["const DETAILS_DRAWER_SECTIONS", "const RIGHT_PANE_TABS"],
    ["const STUDIO_ACTION_REGISTRY", "export function App"],
    ["function renderScenarioLab()", "function renderConsolePanel()"],
    ["function renderConsolePanel()", "function renderDetailsDrawer()"],
    ["function renderDetailsDrawer()", "return ("],
    ["data-agent-workbench=\"resizable-conversation-artifacts\"", "<CommandPalette"],
  ] : [
    ["export function ContextRail", "export function TraceTaskRow"],
    ["export function ActivityTimeline", "export function KnowledgeReader"],
    ["export function KnowledgeReader", "export function TraceTaskRow"],
    ["export function FigmaDriver", "export function DesignSystemReviewSurface"],
    ["export function DesignSystemReviewSurface", "function ArtifactResolvedEvidence"],
    ["function AgenticDesignSystemContract", "function ArtifactPreview"],
    ["export function BlockBody", "export function FileReferenceChip"],
    ["export function buildTerminalBlocks", "export function isFigmaBridgeRunning"],
    ["function titleForBlock", "function deriveOutputItems"],
    ["function activityMeta", "function displaySourceLabel"],
  ];
  return markers
    .map(([startMarker, endMarker]) => {
      const start = source.indexOf(startMarker);
      const end = start >= 0 ? source.indexOf(endMarker, start + startMarker.length) : -1;
      return start >= 0 && end > start ? [start, end] as [number, number] : null;
    })
    .filter((range): range is [number, number] => Boolean(range));
}

function isInAnyRange(position: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([start, end]) => position >= start && position <= end);
}

function normalizeVisibleText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function looksLikeVisibleSentence(text: string): boolean {
  if (!/[A-Za-z]/.test(text)) return false;
  if (/^(https?:|file:|x-apple\.|\.memoire\/|[a-z0-9_.-]+$)/i.test(text)) return false;
  const words = text.match(/[A-Za-z0-9][A-Za-z0-9'_-]*/g) ?? [];
  return words.length >= 4 || /[.!?]$/.test(text) || text.includes("...");
}
