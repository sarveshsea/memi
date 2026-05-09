import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { StudioRuntimeServer } from "../server.js";

const servers: StudioRuntimeServer[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.stop()));
});

// The /api/computer/open + capture endpoints exercise macOS-specific
// behavior (open(1), screencapture). Skip on non-darwin runners; the test
// still runs on macOS dev/CI.
describe.skipIf(process.platform !== "darwin")("studio compatibility and computer routes", () => {
  it("serves a backend compatibility matrix from the local runtime", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-studio-compat-route-"));
    try {
      const server = new StudioRuntimeServer({ projectRoot: root, port: 0 });
      servers.push(server);
      const runtime = await server.start();

      const payload = await fetch(`${runtime.url}/api/compatibility`).then((res) => res.json());

      expect(payload.compatibility).toMatchObject({
        runtime: "local",
        harnesses: expect.arrayContaining([
          expect.objectContaining({
            id: "codex",
            provider: "openai",
            supportedActions: expect.arrayContaining(["app-build", "browser-audit"]),
            modes: expect.arrayContaining(["delegate", "brokered"]),
          }),
        ]),
        tools: expect.objectContaining({
          browser: expect.any(Object),
          figma: expect.any(Object),
          computer: expect.any(Object),
        }),
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("exposes full-access computer status and auditable native actions", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-studio-computer-route-"));
    try {
      const server = new StudioRuntimeServer({ projectRoot: root, port: 0 });
      servers.push(server);
      const runtime = await server.start();

      const status = await fetch(`${runtime.url}/api/computer/status`).then((res) => res.json());
      expect(status).toMatchObject({
        enabled: process.platform === "darwin",
        platform: process.platform,
        mode: "full-access-native",
        permissions: expect.objectContaining({
          accessibility: expect.any(String),
          screenRecording: expect.any(String),
        }),
      });

      const openUrl = await fetch(`${runtime.url}/api/computer/open`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: "url", value: "https://memoire.cv" }),
      }).then((res) => res.json());
      expect(openUrl.result).toMatchObject({
        action: "openUrl",
        status: "completed",
        requiresApproval: false,
      });

      const capture = await fetch(`${runtime.url}/api/computer/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "captureScreen" }),
      }).then((res) => res.json());
      expect(capture.result).toMatchObject({
        action: "captureScreen",
        status: process.platform === "darwin" ? "completed" : "unavailable",
        requiresApproval: false,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
