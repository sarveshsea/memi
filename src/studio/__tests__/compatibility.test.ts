import { describe, expect, it } from "vitest";
import { defaultStudioConfig } from "../config.js";
import { createStudioCompatibilitySnapshot } from "../compatibility.js";
import type { StudioBrowserStatus, StudioComputerStatus, StudioFigmaStatus } from "../types.js";

describe("studio compatibility snapshot", () => {
  it("summarizes harness readiness, modes, setup, tools, and providers from runtime state", () => {
    const root = "/tmp/memoire-compat";
    const config = defaultStudioConfig(root);
    const snapshot = createStudioCompatibilitySnapshot({
      config,
      harnesses: [
        {
          ...config.harnesses.find((harness) => harness.id === "codex")!,
          installed: true,
          resolvedPath: "/usr/local/bin/codex",
          probeAgeMs: 10,
          authStatus: "needs_login",
          authMessage: "Run codex login",
        },
        {
          ...config.harnesses.find((harness) => harness.id === "memoire")!,
          installed: true,
          resolvedPath: "/repo/node_modules/.bin/memi",
          probeAgeMs: 5,
          authStatus: "ready",
          authMessage: "No provider login required",
        },
      ],
      figma: figmaStatus(),
      browser: browserStatus(),
      computer: computerStatus(),
    });

    expect(snapshot.runtime).toBe("local");
    expect(snapshot.harnesses.find((harness) => harness.id === "codex")).toMatchObject({
      provider: "openai",
      installed: true,
      enabled: true,
      authStatus: "needs_login",
      supportsCancel: true,
      outputParser: "codex-jsonl",
      supportedActions: expect.arrayContaining(["app-build", "self-design"]),
      modes: ["delegate", "brokered"],
      requiredSetup: ["Run codex login"],
      setupStatus: "needs_action",
      setupAction: "Run codex login",
      setupCommand: "codex login",
      canAutoOpen: true,
      permissionKind: "provider",
    });
    expect(snapshot.tools).toMatchObject({
      browser: { enabled: true, available: true, setupStatus: "ready" },
      figma: {
        enabled: true,
        available: true,
        state: "running/disconnected",
        setupStatus: "needs_action",
        setupAction: "Open Figma and connect the Mémoire plugin",
        permissionKind: "figma",
      },
      computer: {
        enabled: true,
        available: process.platform === "darwin",
        setupAction: process.platform === "darwin"
          ? "Grant macOS Screen Recording, Accessibility, Automation, and file access"
          : "Use the macOS desktop app for Computer permissions",
        permissionKind: "macos",
      },
      shell: { enabled: true, available: true, setupStatus: "ready", permissionKind: "workspace" },
    });
    expect(snapshot.providers.openai).toMatchObject({ enabled: true, envKey: "OPENAI_API_KEY" });
  });
});

function figmaStatus(): StudioFigmaStatus {
  return {
    running: true,
    port: 9223,
    bridgeStatus: "running",
    pluginStatus: "disconnected",
    clients: [],
    connectionState: "disconnected",
    reconnectAttempts: 0,
    lastConnectedAt: null,
    lastDisconnectedAt: null,
  };
}

function browserStatus(): StudioBrowserStatus {
  return {
    enabled: true,
    installed: true,
    activeSessions: 0,
    message: "Playwright ready",
  };
}

function computerStatus(): StudioComputerStatus {
  return {
    enabled: true,
    platform: process.platform,
    available: process.platform === "darwin",
    mode: "full-access-native",
    permissions: {
      accessibility: "unknown",
      screenRecording: "unknown",
      automation: "unknown",
      fileAccess: "unknown",
    },
    allowedApps: ["Figma"],
    message: "Computer integration ready; Studio records every action while macOS permissions stay user-controlled.",
  };
}
