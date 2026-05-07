import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { FigmaBridge } from "../figma/bridge.js";
import type {
  StudioEventType,
  StudioFigmaAction,
  StudioFigmaActionRequest,
  StudioFigmaActionResult,
  StudioFigmaOpenRequest,
  StudioFigmaOpenResult,
  StudioFigmaStatus,
} from "./types.js";

type StudioFigmaBridgeStatus = Omit<StudioFigmaStatus, "bridgeStatus" | "pluginStatus"> &
  Partial<Pick<StudioFigmaStatus, "bridgeStatus" | "pluginStatus">>;

export interface StudioFigmaBridgeLike {
  isConnected: boolean;
  connect(preferredPort?: number): Promise<number>;
  disconnect(): Promise<void>;
  getStatus(): StudioFigmaBridgeStatus;
  getSelection(): Promise<unknown>;
  extractDesignSystem(): Promise<{ tokens?: unknown[]; components?: unknown[]; styles?: unknown[] }>;
  extractStickies(): Promise<unknown>;
  getPageTree(depth?: number): Promise<unknown>;
  getWidgetSnapshot(timeoutMs?: number): Promise<unknown>;
  captureScreenshot(nodeId?: string, format?: "PNG" | "SVG", scale?: number): Promise<unknown>;
  createNode(params: Record<string, unknown>): Promise<unknown>;
  updateNode(nodeId: string, properties: Record<string, unknown>, expectedVersion?: string): Promise<unknown>;
  deleteNode(nodeId: string): Promise<unknown>;
  setSelection(nodeIds: string[]): Promise<unknown>;
  navigateTo(nodeId: string): Promise<unknown>;
  pushTokens(
    tokens: NonNullable<StudioFigmaActionRequest["tokens"]>,
    options?: { createMissing?: boolean; collectionName?: string },
  ): Promise<unknown>;
}

export interface StudioFigmaControllerEvent {
  type: StudioEventType;
  message: string;
  timestamp: string;
  data?: unknown;
}

interface StudioFigmaControllerOptions {
  projectRoot: string;
  bridge?: StudioFigmaBridgeLike;
  bridgeFactory?: () => StudioFigmaBridgeLike;
  openApp?: (target: string) => Promise<void>;
  onEvent?: (event: StudioFigmaControllerEvent) => void;
}

const ALLOWED_FIGMA_ACTIONS = new Set<StudioFigmaAction>([
  "inspectSelection",
  "pullTokens",
  "pullComponents",
  "pullStyles",
  "pullStickies",
  "pageTree",
  "widgetSnapshot",
  "captureScreenshot",
  "createNode",
  "updateNode",
  "deleteNode",
  "setSelection",
  "navigateTo",
  "pushTokens",
  "fullSync",
]);

export class StudioFigmaController {
  private readonly projectRoot: string;
  private readonly onEvent?: (event: StudioFigmaControllerEvent) => void;
  private readonly bridgeFactory: () => StudioFigmaBridgeLike;
  private readonly openApp: (target: string) => Promise<void>;
  private bridge: StudioFigmaBridgeLike | null;

  constructor(options: StudioFigmaControllerOptions) {
    this.projectRoot = resolve(options.projectRoot);
    this.bridge = options.bridge ?? null;
    this.bridgeFactory = options.bridgeFactory ?? (() => new FigmaBridge({}) as unknown as StudioFigmaBridgeLike);
    this.openApp = options.openApp ?? openFigmaApp;
    this.onEvent = options.onEvent;
  }

  async connect(input: { preferredPort?: number | null } = {}): Promise<StudioFigmaStatus> {
    const bridge = this.ensureBridge();
    const currentStatus = normalizeStatus(bridge.getStatus());
    if (currentStatus.running) {
      return currentStatus;
    }

    const port = await bridge.connect(input.preferredPort ?? undefined);
    this.emit("figma_bridge_started", `Figma bridge started on ${port}`, { port });
    const status = normalizeStatus(bridge.getStatus());
    for (const client of status.clients) {
      this.emit("figma_plugin_connected", `Figma plugin connected: ${client.file || client.id}`, client);
    }
    return status;
  }

  async disconnect(): Promise<StudioFigmaStatus> {
    if (this.bridge) await this.bridge.disconnect();
    this.emit("figma_bridge_stopped", "Figma bridge stopped");
    return disconnectedStatus();
  }

  async status(): Promise<StudioFigmaStatus> {
    if (!this.bridge) return disconnectedStatus();
    return normalizeStatus(this.bridge.getStatus());
  }

  async openFigma(input: StudioFigmaOpenRequest = {}): Promise<StudioFigmaOpenResult> {
    const fileKey = input.fileKey?.trim();
    const target = fileKey ? `figma://file/${encodeURIComponent(fileKey)}` : "figma://";
    await this.openApp(target);
    return {
      status: "opened",
      target,
      openedAt: new Date().toISOString(),
    };
  }

  async runAction(request: StudioFigmaActionRequest): Promise<StudioFigmaActionResult> {
    if (!ALLOWED_FIGMA_ACTIONS.has(request.action)) {
      throw Object.assign(new Error(`Unsupported Figma action: ${request.action}`), { statusCode: 400 });
    }
    const bridge = this.ensureConnectedBridge();
    this.emit("figma_action_started", `Started ${request.action}`, request);

    try {
      const result = await this.dispatchAction(bridge, request);
      const artifactPath = await this.persistArtifact(request.action, result);
      const response: StudioFigmaActionResult = {
        action: request.action,
        status: "completed",
        completedAt: new Date().toISOString(),
        result,
        artifactPath,
      };
      this.emit("figma_action_completed", `Completed ${request.action}`, response);
      return response;
    } catch (error) {
      this.emit("figma_action_failed", `Failed ${request.action}`, {
        error: error instanceof Error ? error.message : String(error),
        request,
      });
      throw error;
    }
  }

  private async dispatchAction(bridge: StudioFigmaBridgeLike, request: StudioFigmaActionRequest): Promise<unknown> {
    switch (request.action) {
      case "inspectSelection":
        return bridge.getSelection();
      case "pullTokens": {
        const system = await bridge.extractDesignSystem();
        return { tokens: system.tokens ?? [], summary: designSystemSummary(system) };
      }
      case "pullComponents": {
        const system = await bridge.extractDesignSystem();
        return { components: system.components ?? [], summary: designSystemSummary(system) };
      }
      case "pullStyles": {
        const system = await bridge.extractDesignSystem();
        return { styles: system.styles ?? [], summary: designSystemSummary(system) };
      }
      case "pullStickies":
        return bridge.extractStickies();
      case "pageTree":
        return bridge.getPageTree(2);
      case "widgetSnapshot":
        return bridge.getWidgetSnapshot(8000);
      case "captureScreenshot":
        return bridge.captureScreenshot(request.nodeId, request.format ?? "PNG", request.scale ?? 2);
      case "createNode":
        return bridge.createNode({
          type: request.type,
          name: request.name,
          parentId: request.parentId,
          x: request.x,
          y: request.y,
          width: request.width,
          height: request.height,
          text: request.text,
          fills: request.fills,
        });
      case "updateNode":
        return bridge.updateNode(request.nodeId ?? "", request.properties ?? {}, request.expectedVersion);
      case "deleteNode":
        return bridge.deleteNode(request.nodeId ?? "");
      case "setSelection":
        return bridge.setSelection(request.nodeIds ?? []);
      case "navigateTo":
        return bridge.navigateTo(request.nodeId ?? "");
      case "pushTokens":
        return bridge.pushTokens(request.tokens ?? [], {
          createMissing: request.createMissing,
          collectionName: request.collectionName,
        });
      case "fullSync": {
        const [system, stickies, widget] = await Promise.all([
          bridge.extractDesignSystem(),
          bridge.extractStickies(),
          bridge.getWidgetSnapshot(8000),
        ]);
        return {
          ...system,
          stickies,
          widget,
          summary: designSystemSummary(system),
        };
      }
    }
  }

  private ensureBridge(): StudioFigmaBridgeLike {
    if (!this.bridge) this.bridge = this.bridgeFactory();
    return this.bridge;
  }

  private ensureConnectedBridge(): StudioFigmaBridgeLike {
    const bridge = this.ensureBridge();
    if (!bridge.isConnected) {
      throw Object.assign(new Error("Figma bridge is not connected"), { statusCode: 409 });
    }
    return bridge;
  }

  private async persistArtifact(action: StudioFigmaAction, result: unknown): Promise<string | null> {
    const dir = join(this.projectRoot, ".memoire", "project-memory", "figma");
    await mkdir(dir, { recursive: true });
    const file = join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${action}.json`);
    await writeFile(file, `${JSON.stringify({ action, capturedAt: new Date().toISOString(), result }, null, 2)}\n`, "utf-8");
    return file;
  }

  private emit(type: StudioEventType, message: string, data?: unknown): void {
    this.onEvent?.({ type, message, timestamp: new Date().toISOString(), data });
  }
}

async function openFigmaApp(target: string): Promise<void> {
  if (process.platform !== "darwin") {
    throw Object.assign(new Error("Native Figma launch is currently supported on macOS only"), { statusCode: 501 });
  }
  await new Promise<void>((resolveOpen, rejectOpen) => {
    const child = spawn("open", [target], { stdio: "ignore" });
    child.once("error", rejectOpen);
    child.once("close", (code) => {
      if (code === 0) resolveOpen();
      else rejectOpen(new Error(`Failed to open Figma target: ${target}`));
    });
  });
}

function disconnectedStatus(): StudioFigmaStatus {
  return {
    running: false,
    port: null,
    bridgeStatus: "stopped",
    pluginStatus: "disconnected",
    clients: [],
    connectionState: "disconnected",
    reconnectAttempts: 0,
    lastConnectedAt: null,
    lastDisconnectedAt: new Date().toISOString(),
  };
}

function normalizeStatus(status: StudioFigmaBridgeStatus): StudioFigmaStatus {
  return {
    ...status,
    bridgeStatus: status.bridgeStatus ?? (status.running ? "running" : "stopped"),
    pluginStatus: status.pluginStatus ?? (status.clients.length > 0 ? "connected" : "disconnected"),
  };
}

function designSystemSummary(system: { tokens?: unknown[]; components?: unknown[]; styles?: unknown[] }): {
  tokens: number;
  components: number;
  styles: number;
} {
  return {
    tokens: Array.isArray(system.tokens) ? system.tokens.length : 0,
    components: Array.isArray(system.components) ? system.components.length : 0,
    styles: Array.isArray(system.styles) ? system.styles.length : 0,
  };
}
