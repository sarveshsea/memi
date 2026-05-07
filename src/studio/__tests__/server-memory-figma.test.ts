import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { StudioRuntimeServer } from "../server.js";
import { StudioFigmaController, type StudioFigmaBridgeLike } from "../figma-controller.js";

const servers: StudioRuntimeServer[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.stop()));
});

function fakeBridge(): StudioFigmaBridgeLike {
  return {
    isConnected: true,
    async connect() { return 9223; },
    async disconnect() {},
    getStatus() {
      return {
        running: true,
        port: 9223,
        clients: [{ id: "plugin-1", file: "Design System", editor: "figma", connectedAt: "2026-05-05T00:00:00.000Z" }],
        connectionState: "connected",
        reconnectAttempts: 0,
        lastConnectedAt: "2026-05-05T00:00:00.000Z",
        lastDisconnectedAt: null,
      };
    },
    async getSelection() { return { count: 2 }; },
    async extractDesignSystem() { return { tokens: [], components: [], styles: [], lastSync: "now" }; },
    async extractStickies() { return []; },
    async getPageTree() { return { fileKey: "abc", fileName: "Design System", pages: [] }; },
    async getWidgetSnapshot() { return { protocol: "memoire.widget.v2" }; },
    async captureScreenshot() { return { base64: "abc", format: "PNG", scale: 2, byteLength: 3 }; },
    async createNode() { return { id: "node-1" }; },
    async updateNode(nodeId) { return { id: nodeId }; },
    async deleteNode(nodeId) { return { deleted: nodeId }; },
    async setSelection(nodeIds) { return { selected: nodeIds.length }; },
    async navigateTo(nodeId) { return { navigated: nodeId }; },
    async pushTokens() {},
  };
}

describe("studio memory and figma runtime APIs", () => {
  it("serves and refreshes project memory", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-studio-memory-api-"));
    try {
      await mkdir(join(root, "research"), { recursive: true });
      await writeFile(join(root, "research", "Research.md"), "# Research\n\nA source.");

      const server = new StudioRuntimeServer({ projectRoot: root, port: 0 });
      servers.push(server);
      const runtime = await server.start();

      const listed = await fetch(`${runtime.url}/api/project-memory`).then((res) => res.json());
      const refreshed = await fetch(`${runtime.url}/api/project-memory/refresh`, { method: "POST" }).then((res) => res.json());
      const detail = await fetch(`${runtime.url}/api/project-memory/${listed.items.find((item: { kind: string }) => item.kind === "research").id}`).then((res) => res.json());

      expect(listed.counts.research).toBe(1);
      expect(refreshed.counts.research).toBe(1);
      expect(detail.item).toMatchObject({ kind: "research", title: "Research" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("serves figma status and allowlisted actions", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-studio-figma-api-"));
    try {
      const figma = new StudioFigmaController({ projectRoot: root, bridgeFactory: fakeBridge });
      const server = new StudioRuntimeServer({ projectRoot: root, port: 0, figma });
      servers.push(server);
      const runtime = await server.start();

      const connected = await fetch(`${runtime.url}/api/figma/connect`, { method: "POST" }).then((res) => res.json());
      const status = await fetch(`${runtime.url}/api/figma/status`).then((res) => res.json());
      const action = await fetch(`${runtime.url}/api/figma/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "inspectSelection" }),
      }).then((res) => res.json());

      expect(connected.connectionState).toBe("connected");
      expect(status.clients[0]).toMatchObject({ file: "Design System" });
      expect(action.result).toEqual({ count: 2 });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
