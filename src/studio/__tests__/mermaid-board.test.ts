import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addMermaidBoardNode,
  connectMermaidBoardNodes,
  createMermaidBoard,
  exportMermaidBoardForJam,
  layoutMermaidBoard,
  readMermaidBoard,
} from "../mermaid-board.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "memoire-board-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("Mermaid Board persistence and export", () => {
  it("creates a local board with Mermaid, sticky, risk, frame, and connector data", async () => {
    const board = await createMermaidBoard(root, { id: "product-board" });
    const persisted = await readMermaidBoard(root, "product-board");

    expect(board.id).toBe("product-board");
    expect(board.nodes.map((node) => node.kind)).toEqual(expect.arrayContaining(["mermaid", "sticky", "risk"]));
    expect(board.edges.length).toBeGreaterThan(0);
    expect(board.frames.length).toBeGreaterThan(0);
    expect(persisted?.id).toBe(board.id);
  });

  it("adds evidence-backed nodes, connects them, and lays out without inventing citations", async () => {
    await createMermaidBoard(root, { id: "research-board" });
    const withNode = await addMermaidBoardNode(root, {
      boardId: "research-board",
      kind: "evidence",
      title: "Finding",
      body: "PMs need traceable visual specs.",
      researchBacking: ["finding-1", "evidence-2"],
      sourceEventIds: ["event-1"],
      author: "agent",
    });
    const evidence = withNode.nodes.find((node) => node.title === "Finding");

    expect(evidence?.researchBacking).toEqual(["finding-1", "evidence-2"]);
    expect(evidence?.sourceEventIds).toEqual(["event-1"]);

    const connected = await connectMermaidBoardNodes(root, {
      boardId: "research-board",
      fromNodeId: "node-hypothesis",
      toNodeId: evidence?.id,
      label: "cites",
    });
    expect(connected.edges.some((edge) => edge.label === "cites")).toBe(true);

    const laidOut = await layoutMermaidBoard(root, { boardId: "research-board" });
    expect(laidOut.nodes.every((node) => Number.isFinite(node.position.x) && Number.isFinite(node.position.y))).toBe(true);
  });

  it("exports nonempty Mermaid Jam source artifacts with a source-open boundary", async () => {
    await createMermaidBoard(root, { id: "export-board" });
    const result = await exportMermaidBoardForJam(root, { boardId: "export-board" });
    const outputs = await Promise.all(result.exports.map((item) => readFile(item.outputPath, "utf-8")));

    expect(result.exports.map((item) => item.format)).toEqual(["mermaid", "markdown", "json"]);
    expect(outputs.every((source) => source.trim().length > 0)).toBe(true);
    expect(outputs[0]).toContain("flowchart TD");
    expect(result.exports.flatMap((item) => item.nextSteps).join("\n")).toContain("Open Mermaid Jam");
    expect(result.exports.flatMap((item) => item.nextSteps).join("\n")).not.toMatch(/clipboard|paste automation/i);
  });
});
