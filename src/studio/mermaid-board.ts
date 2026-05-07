import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  MermaidBoard,
  MermaidBoardAuthor,
  MermaidBoardEdge,
  MermaidBoardExport,
  MermaidBoardFrame,
  MermaidBoardNode,
  MermaidBoardNodeKind,
  MermaidBoardPosition,
} from "./types.js";
import { resolveMermaidJamIntegration } from "../integrations/mermaid-jam.js";

const DEFAULT_BOARD_ID = "studio-mermaid-board";

export function mermaidBoardDir(projectRoot: string): string {
  return join(projectRoot, ".memoire", "boards");
}

export function mermaidBoardPath(projectRoot: string, boardId = DEFAULT_BOARD_ID): string {
  return join(mermaidBoardDir(projectRoot), `${safeBoardId(boardId)}.json`);
}

export async function listMermaidBoards(projectRoot: string): Promise<MermaidBoard[]> {
  const dir = mermaidBoardDir(projectRoot);
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const boards = await Promise.all(entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => readMermaidBoard(projectRoot, entry.name.replace(/\.json$/, ""))));
    return boards
      .filter((board): board is MermaidBoard => Boolean(board))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  } catch {
    return [];
  }
}

export async function readMermaidBoard(projectRoot: string, boardId = DEFAULT_BOARD_ID): Promise<MermaidBoard | null> {
  try {
    const parsed = JSON.parse(await readFile(mermaidBoardPath(projectRoot, boardId), "utf-8")) as Partial<MermaidBoard>;
    return normalizeBoard(parsed, boardId);
  } catch {
    return null;
  }
}

export async function createMermaidBoard(projectRoot: string, input: Partial<MermaidBoard> & { id?: string } = {}): Promise<MermaidBoard> {
  const boardId = safeBoardId(input.id ?? DEFAULT_BOARD_ID);
  const existing = await readMermaidBoard(projectRoot, boardId);
  if (existing) return existing;
  const now = new Date().toISOString();
  const board: MermaidBoard = {
    schemaVersion: 1,
    id: boardId,
    title: input.title || "Studio Mermaid Board",
    description: input.description || "Agent-native product board for Mermaid Jam source artifacts.",
    nodes: input.nodes?.length ? input.nodes.map((node, index) => normalizeNode(node, index)) : defaultBoardNodes(now),
    edges: input.edges?.length ? input.edges.map(normalizeEdge) : defaultBoardEdges(now),
    frames: input.frames?.length ? input.frames.map(normalizeFrame) : [{
      id: "frame-product-flow",
      title: "Product flow",
      nodeIds: ["node-hypothesis", "node-flow", "node-risk"],
      position: { x: 24, y: 24, width: 860, height: 420 },
    }],
    createdAt: now,
    updatedAt: now,
  };
  return writeMermaidBoard(projectRoot, board);
}

export async function addMermaidBoardNode(projectRoot: string, input: Record<string, unknown>): Promise<MermaidBoard> {
  const board = await ensureBoard(projectRoot, optionalString(input.boardId));
  const now = new Date().toISOString();
  const node = normalizeNode({
    id: optionalString(input.id) ?? `node-${randomUUID().slice(0, 8)}`,
    kind: boardNodeKind(input.kind),
    title: optionalString(input.title) ?? "New board node",
    body: optionalString(input.body) ?? "",
    mermaidSource: optionalString(input.mermaidSource) ?? undefined,
    researchBacking: stringArray(input.researchBacking),
    sourceEventIds: stringArray(input.sourceEventIds),
    author: boardAuthor(input.author),
    position: positionInput(input.position, board.nodes.length),
    createdAt: now,
    updatedAt: now,
  }, board.nodes.length);
  return writeMermaidBoard(projectRoot, { ...board, nodes: [...board.nodes, node], updatedAt: now });
}

export async function updateMermaidBoardNode(projectRoot: string, input: Record<string, unknown>): Promise<MermaidBoard> {
  const board = await ensureBoard(projectRoot, optionalString(input.boardId));
  const nodeId = requiredString(input.nodeId ?? input.id, "nodeId");
  const now = new Date().toISOString();
  const nodes = board.nodes.map((node) => {
    if (node.id !== nodeId) return node;
    return normalizeNode({
      ...node,
      kind: input.kind ? boardNodeKind(input.kind) : node.kind,
      title: optionalString(input.title) ?? node.title,
      body: optionalString(input.body) ?? node.body,
      mermaidSource: optionalString(input.mermaidSource) ?? node.mermaidSource,
      researchBacking: input.researchBacking ? stringArray(input.researchBacking) : node.researchBacking,
      sourceEventIds: input.sourceEventIds ? stringArray(input.sourceEventIds) : node.sourceEventIds,
      position: input.position ? positionInput(input.position, 0) : node.position,
      updatedAt: now,
    }, 0);
  });
  if (!nodes.some((node) => node.id === nodeId)) throw Object.assign(new Error(`Unknown Mermaid Board node: ${nodeId}`), { statusCode: 404 });
  return writeMermaidBoard(projectRoot, { ...board, nodes, updatedAt: now });
}

export async function connectMermaidBoardNodes(projectRoot: string, input: Record<string, unknown>): Promise<MermaidBoard> {
  const board = await ensureBoard(projectRoot, optionalString(input.boardId));
  const fromNodeId = requiredString(input.fromNodeId, "fromNodeId");
  const toNodeId = requiredString(input.toNodeId, "toNodeId");
  if (!board.nodes.some((node) => node.id === fromNodeId)) throw Object.assign(new Error(`Unknown Mermaid Board node: ${fromNodeId}`), { statusCode: 404 });
  if (!board.nodes.some((node) => node.id === toNodeId)) throw Object.assign(new Error(`Unknown Mermaid Board node: ${toNodeId}`), { statusCode: 404 });
  const now = new Date().toISOString();
  const edge: MermaidBoardEdge = {
    id: optionalString(input.id) ?? `edge-${randomUUID().slice(0, 8)}`,
    fromNodeId,
    toNodeId,
    label: optionalString(input.label) ?? "influences",
    sourceEventIds: stringArray(input.sourceEventIds),
    author: boardAuthor(input.author),
    createdAt: now,
    updatedAt: now,
  };
  return writeMermaidBoard(projectRoot, { ...board, edges: [...board.edges, edge], updatedAt: now });
}

export async function layoutMermaidBoard(projectRoot: string, input: Record<string, unknown> = {}): Promise<MermaidBoard> {
  const board = await ensureBoard(projectRoot, optionalString(input.boardId));
  const now = new Date().toISOString();
  const nodes = board.nodes.map((node, index) => ({
    ...node,
    position: positionInput({ x: 72 + (index % 3) * 300, y: 96 + Math.floor(index / 3) * 220, width: node.position.width, height: node.position.height }, index),
    updatedAt: now,
  }));
  return writeMermaidBoard(projectRoot, { ...board, nodes, updatedAt: now });
}

export async function exportMermaidBoardForJam(projectRoot: string, input: Record<string, unknown> = {}): Promise<{ board: MermaidBoard; exports: MermaidBoardExport[] }> {
  const board = await ensureBoard(projectRoot, optionalString(input.boardId));
  const integration = await resolveMermaidJamIntegration({ projectRoot });
  const outDir = join(projectRoot, ".memoire", "mermaid-jam", board.id);
  await mkdir(outDir, { recursive: true });
  const mermaid = boardMermaidSource(board);
  const markdown = boardMarkdownSource(board, mermaid);
  const json = `${JSON.stringify(board, null, 2)}\n`;
  const integrationSource = integration.local.ready ? "local-manifest" : "community";
  const outputs: MermaidBoardExport[] = [
    exportItem(board, "board-source", "mermaid", mermaid, join(outDir, `${board.id}.mmd`), integrationSource),
    exportItem(board, "board-summary", "markdown", markdown, join(outDir, `${board.id}.md`), integrationSource),
    exportItem(board, "board-json", "json", json, join(outDir, `${board.id}.json`), integrationSource),
  ];
  await Promise.all(outputs.map((item) => writeFile(item.outputPath, item.source, "utf-8")));
  return { board, exports: outputs };
}

function exportItem(board: MermaidBoard, kind: MermaidBoardExport["kind"], format: MermaidBoardExport["format"], source: string, outputPath: string, integration: string): MermaidBoardExport {
  return {
    id: `${board.id}-${kind}`,
    title: `${board.title} ${format.toUpperCase()}`,
    kind,
    format,
    source,
    outputPath,
    integration,
    nextSteps: ["Open Mermaid Jam", "Import or paste the source artifact manually", "Keep Studio as the source of truth"],
  };
}

async function ensureBoard(projectRoot: string, boardId?: string | null): Promise<MermaidBoard> {
  return await readMermaidBoard(projectRoot, boardId ?? DEFAULT_BOARD_ID) ?? await createMermaidBoard(projectRoot, { id: boardId ?? DEFAULT_BOARD_ID });
}

async function writeMermaidBoard(projectRoot: string, board: MermaidBoard): Promise<MermaidBoard> {
  await mkdir(mermaidBoardDir(projectRoot), { recursive: true });
  await writeFile(mermaidBoardPath(projectRoot, board.id), `${JSON.stringify(board, null, 2)}\n`, "utf-8");
  return board;
}

function normalizeBoard(input: Partial<MermaidBoard>, fallbackId: string): MermaidBoard {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: safeBoardId(input.id ?? fallbackId),
    title: input.title || "Studio Mermaid Board",
    description: input.description || "",
    nodes: (input.nodes ?? []).map((node, index) => normalizeNode(node, index)),
    edges: (input.edges ?? []).map(normalizeEdge),
    frames: (input.frames ?? []).map(normalizeFrame),
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}

function normalizeNode(input: Partial<MermaidBoardNode>, index: number): MermaidBoardNode {
  const now = new Date().toISOString();
  const kind = boardNodeKind(input.kind);
  const mermaidSource = kind === "mermaid" ? normalizeMermaidSource(input.mermaidSource || input.body || "") : input.mermaidSource;
  return {
    id: safeNodeId(input.id ?? `node-${randomUUID().slice(0, 8)}`),
    kind,
    title: input.title || titleForNodeKind(kind),
    body: input.body || "",
    mermaidSource,
    researchBacking: stringArray(input.researchBacking),
    sourceEventIds: stringArray(input.sourceEventIds),
    author: boardAuthor(input.author),
    position: normalizePosition(input.position, index),
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}

function normalizeEdge(input: Partial<MermaidBoardEdge>): MermaidBoardEdge {
  const now = new Date().toISOString();
  return {
    id: safeNodeId(input.id ?? `edge-${randomUUID().slice(0, 8)}`),
    fromNodeId: requiredString(input.fromNodeId, "fromNodeId"),
    toNodeId: requiredString(input.toNodeId, "toNodeId"),
    label: input.label || "connects",
    sourceEventIds: stringArray(input.sourceEventIds),
    author: boardAuthor(input.author),
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}

function normalizeFrame(input: Partial<MermaidBoardFrame>): MermaidBoardFrame {
  return {
    id: safeNodeId(input.id ?? `frame-${randomUUID().slice(0, 8)}`),
    title: input.title || "Frame",
    nodeIds: stringArray(input.nodeIds),
    position: normalizePosition(input.position, 0),
  };
}

function defaultBoardNodes(now: string): MermaidBoardNode[] {
  return [
    normalizeNode({
      id: "node-hypothesis",
      kind: "sticky",
      title: "Hypothesis",
      body: "Research-backed design decisions should stay visible while agents work.",
      author: "agent",
      position: { x: 72, y: 96, width: 260, height: 150 },
      createdAt: now,
      updatedAt: now,
    }, 0),
    normalizeNode({
      id: "node-flow",
      kind: "mermaid",
      title: "Evidence to spec flow",
      body: "Mermaid source for Mermaid Jam export.",
      mermaidSource: "flowchart TD\n  Research[Research evidence] --> Board[Mermaid Board]\n  Board --> Spec[Product spec]\n  Board --> FigJam[Mermaid Jam source]",
      author: "agent",
      position: { x: 380, y: 88, width: 340, height: 220 },
      createdAt: now,
      updatedAt: now,
    }, 1),
    normalizeNode({
      id: "node-risk",
      kind: "risk",
      title: "Risk",
      body: "Do not paste into FigJam automatically; keep source + open until plugin bridge exists.",
      author: "agent",
      position: { x: 752, y: 126, width: 280, height: 160 },
      createdAt: now,
      updatedAt: now,
    }, 2),
  ];
}

function defaultBoardEdges(now: string): MermaidBoardEdge[] {
  return [
    { id: "edge-hypothesis-flow", fromNodeId: "node-hypothesis", toNodeId: "node-flow", label: "becomes", sourceEventIds: [], author: "agent", createdAt: now, updatedAt: now },
    { id: "edge-flow-risk", fromNodeId: "node-flow", toNodeId: "node-risk", label: "bounded by", sourceEventIds: [], author: "agent", createdAt: now, updatedAt: now },
  ];
}

function boardMermaidSource(board: MermaidBoard): string {
  const nodeLines = board.nodes.map((node) => `  ${mermaidId(node.id)}["${escapeMermaidLabel(node.title)}"]`);
  const edgeLines = board.edges.map((edge) => `  ${mermaidId(edge.fromNodeId)} -->|"${escapeMermaidLabel(edge.label)}"| ${mermaidId(edge.toNodeId)}`);
  const embedded = board.nodes
    .filter((node) => node.kind === "mermaid" && node.mermaidSource)
    .map((node) => `\n%% ${node.title}\n${node.mermaidSource}`)
    .join("\n");
  return [`flowchart TD`, ...nodeLines, ...edgeLines, embedded].filter(Boolean).join("\n");
}

function boardMarkdownSource(board: MermaidBoard, mermaid: string): string {
  const nodes = board.nodes.map((node) => `- ${node.title} (${node.kind})${node.researchBacking.length ? ` evidence: ${node.researchBacking.join(", ")}` : ""}`).join("\n");
  return `# ${board.title}\n\n${board.description}\n\n## Mermaid\n\n\`\`\`mermaid\n${mermaid}\n\`\`\`\n\n## Nodes\n\n${nodes}\n`;
}

function normalizeMermaidSource(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) return "flowchart TD\n  A[Start] --> B[Decision]";
  if (!/^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|journey|timeline|gantt|mindmap)\b/m.test(trimmed)) {
    return `flowchart TD\n  A["${escapeMermaidLabel(trimmed.slice(0, 64))}"]`;
  }
  return trimmed;
}

function positionInput(value: unknown, index: number): MermaidBoardPosition {
  return normalizePosition(typeof value === "object" && value ? value as Partial<MermaidBoardPosition> : undefined, index);
}

function normalizePosition(input: Partial<MermaidBoardPosition> | undefined, index: number): MermaidBoardPosition {
  return {
    x: finiteNumber(input?.x, 72 + (index % 3) * 300),
    y: finiteNumber(input?.y, 96 + Math.floor(index / 3) * 220),
    width: finiteNumber(input?.width, 280),
    height: finiteNumber(input?.height, 170),
  };
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function boardNodeKind(value: unknown): MermaidBoardNodeKind {
  const allowed: MermaidBoardNodeKind[] = ["mermaid", "sticky", "evidence", "persona", "risk", "metric", "spec", "comment"];
  return allowed.includes(value as MermaidBoardNodeKind) ? value as MermaidBoardNodeKind : "sticky";
}

function boardAuthor(value: unknown): MermaidBoardAuthor {
  return value === "human" ? "human" : "agent";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function requiredString(value: unknown, name: string): string {
  if (typeof value === "string" && value.length > 0) return value;
  throw Object.assign(new Error(`Mermaid Board requires ${name}`), { statusCode: 400 });
}

function safeBoardId(value: string): string {
  return safeNodeId(value || DEFAULT_BOARD_ID);
}

function safeNodeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "") || randomUUID();
}

function mermaidId(value: string): string {
  return safeNodeId(value).replace(/-/g, "_");
}

function escapeMermaidLabel(value: string): string {
  return value.replace(/"/g, "'");
}

function titleForNodeKind(kind: MermaidBoardNodeKind): string {
  return kind === "mermaid" ? "Mermaid diagram" : kind.charAt(0).toUpperCase() + kind.slice(1);
}
