import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { StudioRuntimeServer } from "../server.js";

const servers: StudioRuntimeServer[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.stop()));
});

describe("studio autonomous lab routes", () => {
  it("serves tool definitions and executes workspace reads through the broker", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-server-tools-"));
    try {
      await writeFile(join(root, "README.md"), "# App\n");
      const server = new StudioRuntimeServer({ projectRoot: root, port: 0 });
      servers.push(server);
      const runtime = await server.start();

      const tools = await fetch(`${runtime.url}/api/tools`).then((res) => res.json());
      expect(tools.tools.map((tool: { id: string }) => tool.id)).toContain("workspace.read");

      const result = await fetch(`${runtime.url}/api/tools/call`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ toolId: "workspace.read", input: { path: join(root, "README.md") } }),
      }).then((res) => res.json());

      expect(result.call).toMatchObject({
        status: "completed",
        toolId: "workspace.read",
        data: { content: "# App\n" },
      });

      const stored = await fetch(`${runtime.url}/api/tools/calls/${result.call.id}`).then((res) => res.json());
      expect(stored.call.id).toBe(result.call.id);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("exposes browser status and fails closed when Playwright is unavailable", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-server-browser-"));
    try {
      const server = new StudioRuntimeServer({ projectRoot: root, port: 0 });
      servers.push(server);
      const runtime = await server.start();

      const status = await fetch(`${runtime.url}/api/browser/status`).then((res) => res.json());
      expect(status).toMatchObject({
        enabled: false,
        installed: expect.any(Boolean),
        activeSessions: 0,
      });

      const response = await fetch(`${runtime.url}/api/browser/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "snapshot", sessionId: "missing" }),
      });
      expect(response.status).toBe(403);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
