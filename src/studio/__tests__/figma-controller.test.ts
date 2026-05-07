import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import { StudioFigmaController, type StudioFigmaBridgeLike } from "../figma-controller.js";

function createBridge(): StudioFigmaBridgeLike & { calls: string[] } {
  const calls: string[] = [];
  let running = false;
  let activePort = 9223;
  return {
    calls,
    get isConnected() {
      return running;
    },
    async connect(port?: number) {
      calls.push(`connect:${port ?? "scan"}`);
      running = true;
      if (port) {
        activePort = port;
        return port;
      }
      activePort = 9223;
      return 9223;
    },
    async disconnect() {
      calls.push("disconnect");
      running = false;
    },
    getStatus() {
      return {
        running,
        port: running ? activePort : null,
        clients: running ? [{ id: "plugin-1", file: "Design System", editor: "figma", connectedAt: "2026-05-05T00:00:00.000Z" }] : [],
        connectionState: running ? "connected" as const : "disconnected" as const,
        reconnectAttempts: 0,
        lastConnectedAt: running ? "2026-05-05T00:00:00.000Z" : null,
        lastDisconnectedAt: running ? null : "2026-05-05T00:00:00.000Z",
      };
    },
    async getSelection() {
      calls.push("getSelection");
      return { count: 1 };
    },
    async extractDesignSystem() {
      calls.push("extractDesignSystem");
      return { tokens: [{ name: "ink" }], components: [{ name: "Button" }], styles: [{ name: "Body" }], lastSync: "now" };
    },
    async extractStickies() {
      calls.push("extractStickies");
      return [{ id: "sticky-1", text: "Need stronger IA" }];
    },
    async getPageTree() {
      calls.push("getPageTree");
      return { fileKey: "abc", fileName: "Design System", pages: [] };
    },
    async getWidgetSnapshot() {
      calls.push("getWidgetSnapshot");
      return { protocol: "memoire.widget.v2" };
    },
    async captureScreenshot() {
      calls.push("captureScreenshot");
      return { base64: "abc", format: "PNG", scale: 2, byteLength: 3 };
    },
    async createNode(params) {
      calls.push(`createNode:${params.type}`);
      return { id: "node-1", name: params.name ?? "node" };
    },
    async updateNode(nodeId, properties, expectedVersion) {
      calls.push(`updateNode:${nodeId}:${expectedVersion ?? "none"}`);
      return { id: nodeId, ...properties, version: "v2" };
    },
    async deleteNode(nodeId) {
      calls.push(`deleteNode:${nodeId}`);
      return { deleted: nodeId };
    },
    async setSelection(nodeIds) {
      calls.push(`setSelection:${nodeIds.join(",")}`);
      return { selected: nodeIds.length };
    },
    async navigateTo(nodeId) {
      calls.push(`navigateTo:${nodeId}`);
      return { navigated: nodeId };
    },
    async pushTokens(tokens, options) {
      calls.push(`pushTokens:${tokens.length}:${options?.createMissing ? "missing" : "existing"}: ${options?.collectionName ?? "default"}`);
    },
  };
}

describe("studio figma controller", () => {
  it("does not reconnect or allocate another port when the bridge is already running", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-figma-controller-"));
    const bridge = createBridge();
    try {
      const controller = new StudioFigmaController({ projectRoot: root, bridgeFactory: () => bridge });

      const first = await controller.connect({ preferredPort: 9223 });
      const second = await controller.connect({ preferredPort: 9224 });

      expect(bridge.calls).toEqual(["connect:9223"]);
      expect(first).toMatchObject({
        running: true,
        port: 9223,
        bridgeStatus: "running",
        pluginStatus: "connected",
      });
      expect(second).toMatchObject({
        running: true,
        port: 9223,
        bridgeStatus: "running",
        pluginStatus: "connected",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("starts and stops the existing bridge while reporting connected clients", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-figma-controller-"));
    const bridge = createBridge();
    try {
      const controller = new StudioFigmaController({ projectRoot: root, bridgeFactory: () => bridge });

      const connected = await controller.connect({ preferredPort: 9223 });
      const stopped = await controller.disconnect();

      expect(bridge.calls).toEqual(["connect:9223", "disconnect"]);
      expect(connected).toMatchObject({
        running: true,
        port: 9223,
        connectionState: "connected",
        bridgeStatus: "running",
        pluginStatus: "connected",
      });
      expect(connected.clients[0]).toMatchObject({ file: "Design System" });
      expect(stopped.running).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports a running bridge separately from a disconnected plugin", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-figma-controller-"));
    const bridge = createBridge();
    bridge.getStatus = () => ({
      running: true,
      port: 9227,
      clients: [],
      connectionState: "disconnected",
      reconnectAttempts: 0,
      lastConnectedAt: null,
      lastDisconnectedAt: null,
    });
    try {
      const controller = new StudioFigmaController({ projectRoot: root, bridgeFactory: () => bridge });

      const status = await controller.connect({ preferredPort: 9227 });

      expect(status).toMatchObject({
        running: true,
        port: 9227,
        bridgeStatus: "running",
        pluginStatus: "disconnected",
        connectionState: "disconnected",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("routes allowlisted actions through the bridge and records events", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-figma-controller-"));
    const bridge = createBridge();
    const onEvent = vi.fn();
    try {
      const controller = new StudioFigmaController({ projectRoot: root, bridgeFactory: () => bridge, onEvent });
      await controller.connect({ preferredPort: 9223 });

      const selection = await controller.runAction({ action: "inspectSelection" });
      const fullSync = await controller.runAction({ action: "fullSync" });
      await controller.runAction({ action: "pullStickies" });
      await controller.runAction({ action: "widgetSnapshot" });

      expect(selection.result).toEqual({ count: 1 });
      expect(fullSync.result).toMatchObject({ tokens: [{ name: "ink" }] });
      expect(bridge.calls).toEqual([
        "connect:9223",
        "getSelection",
        "extractDesignSystem",
        "extractStickies",
        "getWidgetSnapshot",
        "extractStickies",
        "getWidgetSnapshot",
      ]);
      expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "figma_action_started" }));
      expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "figma_action_completed" }));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects unsupported actions before they reach the bridge", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-figma-controller-"));
    try {
      const controller = new StudioFigmaController({ projectRoot: root, bridgeFactory: createBridge });
      await expect(controller.runAction({ action: "executeRaw" as never })).rejects.toThrow(/unsupported/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("routes scratch-safe mutating actions through the Studio-owned bridge", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-figma-controller-"));
    const bridge = createBridge();
    try {
      const controller = new StudioFigmaController({ projectRoot: root, bridgeFactory: () => bridge });
      await controller.connect({ preferredPort: 9223 });

      await controller.runAction({ action: "createNode", type: "FRAME", name: "Mémoire E2E Scratch Frame" });
      await controller.runAction({
        action: "updateNode",
        nodeId: "node-1",
        properties: { name: "Mémoire E2E Scratch Updated" },
        expectedVersion: "v1",
      });
      await controller.runAction({ action: "setSelection", nodeIds: ["node-1"] });
      await controller.runAction({ action: "navigateTo", nodeId: "node-1" });
      await controller.runAction({ action: "deleteNode", nodeId: "node-1" });

      expect(bridge.calls).toEqual([
        "connect:9223",
        "createNode:FRAME",
        "updateNode:node-1:v1",
        "setSelection:node-1",
        "navigateTo:node-1",
        "deleteNode:node-1",
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("passes scratch token creation options through pushTokens", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-figma-controller-"));
    const bridge = createBridge();
    try {
      const controller = new StudioFigmaController({ projectRoot: root, bridgeFactory: () => bridge });
      await controller.connect({ preferredPort: 9223 });

      await controller.runAction({
        action: "pushTokens",
        createMissing: true,
        collectionName: "Mémoire E2E Scratch",
        tokens: [{ name: "memoire/e2e/color", values: { value: "#ff0000" } }],
      });

      expect(bridge.calls).toEqual([
        "connect:9223",
        "pushTokens:1:missing: Mémoire E2E Scratch",
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
