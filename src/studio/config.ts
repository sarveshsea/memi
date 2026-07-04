import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getHarnessManifest } from "./harnesses.js";
import type { StudioCodexConfig, StudioConfig, StudioSetupConfig } from "./types.js";

const SECURITY_DEFAULTS_VERSION = 2;

export function studioConfigPath(projectRoot: string): string {
  return join(projectRoot, ".memoire", "studio", "config.json");
}

export function defaultStudioConfig(projectRoot: string): StudioConfig {
  const root = resolve(projectRoot);
  return {
    schemaVersion: 1,
    workspaceRoots: [root],
    defaultHarness: "codex",
    defaultModel: null,
    providers: {
      anthropic: { enabled: true, envKey: "ANTHROPIC_API_KEY" },
      openai: { enabled: true, envKey: "OPENAI_API_KEY" },
      openaiCompatible: { enabled: false, baseUrl: null, envKey: null },
      ollama: { enabled: true, baseUrl: "http://127.0.0.1:11434", defaultModel: "llama3.1:8b" },
    },
    codex: {
      model: "gpt-5.5",
      reasoningEffort: "xhigh",
      approvalPolicy: "on-request",
      webSearch: false,
      skipGitRepoCheck: true,
      includeMemoireCommands: true,
      includeCodexCommands: true,
      planModeDefault: true,
    },
    ui: {
      theme: "dark",
      inputMode: "agent",
      commandPaletteEnabled: true,
      toolbeltLayout: "compact",
    },
    agentProfiles: [{
      id: "design",
      name: "Design",
      defaultHarness: "codex",
      defaultAction: "app-build",
      model: null,
      autonomy: "autonomous",
    }],
    permissions: {
      workspaceWrite: "approval",
      shell: "block",
      computer: "approval",
      figma: "approval",
      allowlist: [],
      denylist: [],
    },
    computer: {
      enabled: false,
      allowedApps: ["Figma", "Google Chrome", "Safari", "Finder", "Terminal", "iTerm", "Visual Studio Code", "Cursor"],
      requireApproval: true,
      permissions: {
        accessibility: "unknown",
        screenRecording: "unknown",
        automation: "unknown",
        fileAccess: "unknown",
      },
    },
    setup: {
      wizardVersion: 1,
      securityDefaultsVersion: SECURITY_DEFAULTS_VERSION,
      completedAt: null,
      dismissedAt: null,
      lastCheckedAt: null,
      downloadReadyAcknowledged: false,
    },
    usageBudgets: {
      warningThreshold: 0.8,
      providers: {},
      harnesses: {},
    },
    harnesses: getHarnessManifest().harnesses.map((harness) => ({
      ...harness,
      enabled: harness.enabledByDefault,
      command: harness.id === "shell" ? (process.env.SHELL || harness.command) : harness.command,
    })),
    enabledTools: {
      shell: false,
      browser: false,
      figma: false,
      mcp: true,
    },
    figma: {
      autoStartBridge: false,
      preferredPort: 9223,
      portRange: [9223, 9232],
      lastFileKey: null,
      lastConnectedAt: null,
    },
  };
}

export async function loadStudioConfig(projectRoot: string): Promise<StudioConfig> {
  const defaults = defaultStudioConfig(projectRoot);
  try {
    const raw = JSON.parse(await readFile(studioConfigPath(projectRoot), "utf-8")) as Partial<StudioConfig>;
    return mergeStudioConfig(defaults, raw);
  } catch {
    return defaults;
  }
}

export async function saveStudioConfig(projectRoot: string, config: StudioConfig): Promise<void> {
  const path = studioConfigPath(projectRoot);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, JSON.stringify(mergeStudioConfig(defaultStudioConfig(projectRoot), config), null, 2) + "\n");
}

function mergeStudioConfig(defaults: StudioConfig, raw: Partial<StudioConfig>): StudioConfig {
  const overrideHarnesses = new Map((raw.harnesses ?? []).map((harness) => [harness.id, harness]));
  return {
    ...defaults,
    ...raw,
    schemaVersion: 1,
    workspaceRoots: (raw.workspaceRoots ?? defaults.workspaceRoots).map((root) => resolve(root)),
    providers: {
      ...defaults.providers,
      ...(raw.providers ?? {}),
      anthropic: { ...defaults.providers.anthropic, ...(raw.providers?.anthropic ?? {}) },
      openai: { ...defaults.providers.openai, ...(raw.providers?.openai ?? {}) },
      openaiCompatible: { ...defaults.providers.openaiCompatible, ...(raw.providers?.openaiCompatible ?? {}) },
      ollama: { ...defaults.providers.ollama, ...(raw.providers?.ollama ?? {}) },
    },
    enabledTools: {
      ...defaults.enabledTools,
      ...(raw.enabledTools ?? {}),
    },
    codex: mergeCodexConfig(defaults.codex, raw.codex, raw.setup),
    ui: {
      ...defaults.ui,
      ...(raw.ui ?? {}),
    },
    agentProfiles: raw.agentProfiles && raw.agentProfiles.length > 0
      ? raw.agentProfiles
      : defaults.agentProfiles,
    permissions: {
      ...defaults.permissions,
      ...(raw.permissions ?? {}),
      allowlist: raw.permissions?.allowlist ?? defaults.permissions.allowlist,
      denylist: raw.permissions?.denylist ?? defaults.permissions.denylist,
    },
    computer: {
      ...defaults.computer,
      ...(raw.computer ?? {}),
      permissions: {
        ...defaults.computer.permissions,
        ...(raw.computer?.permissions ?? {}),
      },
      allowedApps: raw.computer?.allowedApps ?? defaults.computer.allowedApps,
    },
    setup: {
      ...defaults.setup,
      ...(raw.setup ?? {}),
      wizardVersion: 1,
      securityDefaultsVersion: raw.setup?.securityDefaultsVersion ?? SECURITY_DEFAULTS_VERSION,
    },
    usageBudgets: {
      warningThreshold: raw.usageBudgets?.warningThreshold ?? defaults.usageBudgets.warningThreshold,
      providers: {
        ...defaults.usageBudgets.providers,
        ...(raw.usageBudgets?.providers ?? {}),
      },
      harnesses: {
        ...defaults.usageBudgets.harnesses,
        ...(raw.usageBudgets?.harnesses ?? {}),
      },
    },
    figma: {
      autoStartBridge: raw.figma?.autoStartBridge ?? defaults.figma?.autoStartBridge ?? false,
      preferredPort: raw.figma?.preferredPort ?? defaults.figma?.preferredPort ?? null,
      portRange: raw.figma?.portRange ?? defaults.figma?.portRange ?? [9223, 9232],
      lastFileKey: raw.figma?.lastFileKey ?? defaults.figma?.lastFileKey ?? null,
      lastConnectedAt: raw.figma?.lastConnectedAt ?? defaults.figma?.lastConnectedAt ?? null,
    },
    harnesses: defaults.harnesses.map((harness) => {
      const override = overrideHarnesses.get(harness.id);
      return {
        ...harness,
        enabled: override?.enabled ?? harness.enabled,
        command: override?.command ?? harness.command,
      };
    }),
  };
}

function mergeCodexConfig(
  defaults: StudioCodexConfig,
  rawCodex: Partial<StudioCodexConfig> | undefined,
  rawSetup: Partial<StudioSetupConfig> | undefined,
): StudioCodexConfig {
  const merged = {
    ...defaults,
    ...(rawCodex ?? {}),
  };
  if ((rawSetup?.securityDefaultsVersion ?? 1) < SECURITY_DEFAULTS_VERSION) {
    if (rawCodex?.approvalPolicy === "never") merged.approvalPolicy = defaults.approvalPolicy;
    if (rawCodex?.webSearch === true) merged.webSearch = defaults.webSearch;
  }
  return merged;
}
