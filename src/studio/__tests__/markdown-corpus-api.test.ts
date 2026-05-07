import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StudioFigmaController, type StudioFigmaBridgeLike } from "../figma-controller.js";
import { StudioRuntimeServer } from "../server.js";

const servers: StudioRuntimeServer[] = [];
let projectRoot: string;
let fixtureRoot: string;

beforeEach(async () => {
  projectRoot = join(tmpdir(), `memoire-markdown-corpus-api-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fixtureRoot = join(projectRoot, "fixture-source");
  await mkdir(join(fixtureRoot, "docs"), { recursive: true });
  await writeFile(join(fixtureRoot, "README.md"), "# API onboarding\n\n- Create token\n- Call endpoint\n- Inspect response\n", "utf-8");
  await writeFile(join(fixtureRoot, "docs", "diagram.md"), "```mermaid\nsequenceDiagram\n  User->>API: request\n```\n", "utf-8");
  await writeFile(join(fixtureRoot, "docs", "ignored.js"), "console.log('skip')\n", "utf-8");
});

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.stop()));
  await rm(projectRoot, { recursive: true, force: true });
});

describe("studio markdown corpus api", () => {
  it("sets up corpus status and analyzes markdown candidates", async () => {
    const server = new StudioRuntimeServer({ projectRoot, port: 0 });
    servers.push(server);
    const runtime = await server.start();

    const setup = await fetch(`${runtime.url}/api/markdown-corpus/setup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ catalog: [{ owner: "fixture", repo: "docs", license: "MIT", branch: "main", policy: "download", localSource: fixtureRoot }] }),
    }).then((res) => res.json());
    const status = await fetch(`${runtime.url}/api/markdown-corpus/status`).then((res) => res.json());
    const analyze = await fetch(`${runtime.url}/api/markdown-corpus/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourcePath: join(fixtureRoot, "README.md") }),
    }).then((res) => res.json());

    expect(setup.status).toBe("ready");
    expect(status.repos[0]).toMatchObject({ repo: "fixture/docs", files: 2, skipped: 1 });
    expect(analyze.candidates[0]).toMatchObject({ kind: "checklist-to-flow", title: "API onboarding" });
  });

  it("rejects FigJam sync when the bridge is not connected", async () => {
    const figma = new StudioFigmaController({ projectRoot, bridge: { ...fakeBridge(), isConnected: false } });
    const server = new StudioRuntimeServer({ projectRoot, port: 0, figma });
    servers.push(server);
    const runtime = await server.start();

    const response = await fetch(`${runtime.url}/api/markdown-corpus/sync-to-figjam`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "# Flow\n\n- A\n- B\n", sourcePath: "inline.md" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toMatch(/figma bridge/i);
  });

  it("syncs markdown candidates through the connected FigJam bridge", async () => {
    const bridge = fakeBridge();
    const figma = new StudioFigmaController({ projectRoot, bridge });
    const server = new StudioRuntimeServer({ projectRoot, port: 0, figma });
    servers.push(server);
    const runtime = await server.start();

    const response = await fetch(`${runtime.url}/api/markdown-corpus/sync-to-figjam`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "# Flow\n\n- A\n- B\n", sourcePath: "inline.md" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.figjam).toMatchObject({
      bridgeState: "connected",
      createdNodeCount: 2,
    });
    expect(bridge.executed[0]).toContain("Memoire Markdown Sync");
    expect(payload.figjam.artifactPath).toContain("syncMarkdownToFigJam");
  });
});

function fakeBridge(): StudioFigmaBridgeLike & { executed: string[]; execute(code: string): Promise<unknown> } {
  const executed: string[] = [];
  return {
    executed,
    isConnected: true,
    async connect() { return 9223; },
    async disconnect() {},
    getStatus() {
      return {
        running: true,
        port: 9223,
        clients: [{ id: "plugin-1", file: "FigJam board", editor: "figjam", connectedAt: "2026-05-05T00:00:00.000Z" }],
        connectionState: "connected",
        reconnectAttempts: 0,
        lastConnectedAt: "2026-05-05T00:00:00.000Z",
        lastDisconnectedAt: null,
      };
    },
    async getSelection() { return { count: 0 }; },
    async extractDesignSystem() { return { tokens: [], components: [], styles: [] }; },
    async extractStickies() { return []; },
    async getPageTree() { return { pages: [] }; },
    async getWidgetSnapshot() { return {}; },
    async captureScreenshot() { return {}; },
    async pushTokens() {},
    async execute(code: string) {
      executed.push(code);
      return { createdNodeCount: 2, bridgeState: "connected" };
    },
  };
}
