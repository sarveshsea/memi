import { mkdtemp, rm, readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { defaultStudioConfig, loadStudioConfig, saveStudioConfig, studioConfigPath } from "../config.js";

describe("studio config", () => {
  it("loads default desktop-first config when no config file exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-studio-config-"));
    try {
      const config = await loadStudioConfig(root);

      expect(studioConfigPath(root)).toBe(join(root, ".memoire", "studio", "config.json"));
      expect(config.defaultHarness).toBe("codex");
      expect(config.workspaceRoots).toEqual([root]);
      expect(config.harnesses.map((harness) => harness.id)).toEqual([
        "memoire",
        "claude-code",
        "codex",
        "opencode",
        "gemini",
        "ollama",
        "hermes",
        "shell",
      ]);
      expect(config.enabledTools).toEqual({
        shell: false,
        browser: false,
        figma: false,
        mcp: true,
      });
      expect(config.ui).toMatchObject({
        theme: "dark",
        inputMode: "agent",
        commandPaletteEnabled: true,
        toolbeltLayout: "compact",
      });
      expect(config.agentProfiles).toEqual([
        expect.objectContaining({
          id: "design",
          name: "Design",
          defaultHarness: "codex",
          defaultAction: "app-build",
          autonomy: "autonomous",
        }),
      ]);
      expect(config.harnesses.filter((harness) => harness.enabled).map((harness) => harness.id)).toEqual([
        "claude-code",
        "codex",
      ]);
      expect(config.harnesses.filter((harness) => harness.visibility === "primary").map((harness) => harness.id)).toEqual([
        "claude-code",
        "codex",
      ]);
      expect(config.permissions).toMatchObject({
        workspaceWrite: "approval",
        shell: "block",
        computer: "approval",
        figma: "approval",
      });
      expect(config.computer).toMatchObject({
        enabled: false,
        requireApproval: true,
      });
      expect(config.computer.allowedApps).toEqual(expect.arrayContaining([
        "Figma",
        "Google Chrome",
        "Safari",
        "Finder",
        "Terminal",
        "iTerm",
        "Visual Studio Code",
        "Cursor",
      ]));
      expect(config.setup).toMatchObject({
        wizardVersion: 1,
        securityDefaultsVersion: 2,
        completedAt: null,
        downloadReadyAcknowledged: false,
      });
      expect(config.codex).toMatchObject({
        model: "gpt-5.5",
        reasoningEffort: "xhigh",
        approvalPolicy: "on-request",
        webSearch: false,
        skipGitRepoCheck: true,
        includeMemoireCommands: true,
        includeCodexCommands: true,
        planModeDefault: true,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("saves merged config without dropping default harness definitions", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-studio-config-"));
    try {
      await saveStudioConfig(root, {
        ...defaultStudioConfig(root),
        defaultHarness: "codex",
        workspaceRoots: [root, join(root, "client")],
      });

      const raw = JSON.parse(await readFile(studioConfigPath(root), "utf-8"));
      const loaded = await loadStudioConfig(root);

      expect(raw.defaultHarness).toBe("codex");
      expect(loaded.defaultHarness).toBe("codex");
      expect(loaded.workspaceRoots).toEqual([root, join(root, "client")]);
      expect(loaded.harnesses.find((harness) => harness.id === "memoire")?.command).toBe("memi");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("migrates older Studio config files without losing new settings sections", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-studio-config-"));
    try {
      await saveStudioConfig(root, {
        ...defaultStudioConfig(root),
        defaultHarness: "codex",
        enabledTools: {
          shell: true,
          browser: true,
          figma: true,
          mcp: true,
        },
        ui: undefined as never,
        agentProfiles: undefined as never,
        permissions: undefined as never,
        computer: undefined as never,
      });

      const loaded = await loadStudioConfig(root);

      expect(loaded.defaultHarness).toBe("codex");
      expect(loaded.ui.inputMode).toBe("agent");
      expect(loaded.agentProfiles[0]).toMatchObject({ id: "design", defaultHarness: "codex" });
      expect(loaded.permissions.denylist).toEqual([]);
      expect(loaded.permissions.shell).toBe("block");
      expect(loaded.computer.allowedApps).toEqual(expect.arrayContaining(["Figma"]));
      expect(loaded.computer.enabled).toBe(false);
      expect(loaded.computer.requireApproval).toBe(true);
      expect(loaded.setup.completedAt).toBeNull();
      expect(loaded.setup.securityDefaultsVersion).toBe(2);
      expect(loaded.codex.model).toBe("gpt-5.5");
      expect(loaded.codex.reasoningEffort).toBe("xhigh");
      expect(loaded.codex.approvalPolicy).toBe("on-request");
      expect(loaded.codex.webSearch).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("persists Codex model, reasoning, approval, and research defaults", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-studio-config-"));
    try {
      await saveStudioConfig(root, {
        ...defaultStudioConfig(root),
        codex: {
          model: "gpt-5.4",
          reasoningEffort: "high",
          approvalPolicy: "on-request",
          webSearch: false,
          skipGitRepoCheck: false,
          includeMemoireCommands: true,
          includeCodexCommands: false,
          planModeDefault: true,
        },
      });

      const loaded = await loadStudioConfig(root);

      expect(loaded.codex).toEqual({
        model: "gpt-5.4",
        reasoningEffort: "high",
        approvalPolicy: "on-request",
        webSearch: false,
        skipGitRepoCheck: false,
        includeMemoireCommands: true,
        includeCodexCommands: false,
        planModeDefault: true,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("hardens legacy Codex never/web-search defaults while preserving versioned explicit settings", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-studio-config-"));
    try {
      await mkdir(join(root, ".memoire", "studio"), { recursive: true });
      await writeFile(studioConfigPath(root), JSON.stringify({
        schemaVersion: 1,
        workspaceRoots: [root],
        defaultHarness: "codex",
        setup: {
          wizardVersion: 1,
          completedAt: "2026-05-07T22:27:59.096Z",
          dismissedAt: null,
          lastCheckedAt: "2026-05-07T22:27:59.096Z",
          downloadReadyAcknowledged: true,
        },
        codex: {
          model: "gpt-5.5",
          reasoningEffort: "xhigh",
          approvalPolicy: "never",
          webSearch: true,
          skipGitRepoCheck: true,
          includeMemoireCommands: true,
          includeCodexCommands: true,
          planModeDefault: true,
        },
      }, null, 2));

      const legacyLoaded = await loadStudioConfig(root);
      expect(legacyLoaded.codex.approvalPolicy).toBe("on-request");
      expect(legacyLoaded.codex.webSearch).toBe(false);

      await saveStudioConfig(root, {
        ...legacyLoaded,
        setup: {
          ...legacyLoaded.setup,
          securityDefaultsVersion: 2,
        },
        codex: {
          ...legacyLoaded.codex,
          approvalPolicy: "never",
          webSearch: true,
        },
      });

      const explicitLoaded = await loadStudioConfig(root);
      expect(explicitLoaded.codex.approvalPolicy).toBe("never");
      expect(explicitLoaded.codex.webSearch).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });


  it("refreshes harness execution metadata from the manifest while preserving user enabled state", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-studio-config-"));
    try {
      await saveStudioConfig(root, {
        ...defaultStudioConfig(root),
        harnesses: defaultStudioConfig(root).harnesses.map((harness) => (
          harness.id === "codex"
            ? {
              ...harness,
              enabled: false,
              commandTemplates: {
                compose: ["exec", "--json", "{{promptEnvelope}}"],
              },
              defaultModel: null,
            }
            : harness
        )),
      });

      const loaded = await loadStudioConfig(root);
      const codex = loaded.harnesses.find((harness) => harness.id === "codex");

      expect(codex).toMatchObject({
        enabled: false,
        defaultModel: "GPT-5.5 Design",
      });
      expect(codex?.commandTemplates.compose).toEqual(expect.arrayContaining(["--model", "gpt-5.5"]));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("persists first-run setup completion state", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-studio-config-"));
    try {
      await saveStudioConfig(root, {
        ...defaultStudioConfig(root),
        setup: {
          wizardVersion: 1,
          securityDefaultsVersion: 2,
          completedAt: "2026-05-06T12:00:00.000Z",
          dismissedAt: null,
          lastCheckedAt: "2026-05-06T12:00:00.000Z",
          downloadReadyAcknowledged: true,
        },
      });

      const loaded = await loadStudioConfig(root);

      expect(loaded.setup).toMatchObject({
        wizardVersion: 1,
        completedAt: "2026-05-06T12:00:00.000Z",
        lastCheckedAt: "2026-05-06T12:00:00.000Z",
        downloadReadyAcknowledged: true,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
