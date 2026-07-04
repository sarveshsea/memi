import type {
  StudioBrowserStatus,
  StudioCompatibilitySnapshot,
  StudioCompatibilityTool,
  StudioComputerStatus,
  StudioConfig,
  StudioFigmaStatus,
  StudioHarnessAuthStatus,
  StudioHarnessId,
  StudioHarnessStatus,
  StudioSetupPermissionKind,
  StudioSetupStatus,
  StudioSessionMode,
} from "./types.js";

export interface StudioCompatibilityInput {
  config: StudioConfig;
  harnesses: StudioHarnessStatus[];
  browser: StudioBrowserStatus;
  figma: StudioFigmaStatus;
  computer: StudioComputerStatus;
}

export function createStudioCompatibilitySnapshot(input: StudioCompatibilityInput): StudioCompatibilitySnapshot {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    runtime: "local",
    harnesses: input.harnesses.map((harness) => {
      const modes: StudioSessionMode[] = harness.id === "shell" ? ["delegate"] : ["delegate", "brokered"];
      const requiredSetup = [
        ...(!harness.enabled ? ["Enable harness in Studio settings"] : []),
        ...(!harness.installed ? [`Install ${harness.command}`] : []),
        ...(harness.authStatus === "needs_login" ? [harness.authMessage] : []),
        ...(harness.authStatus === "config_error" ? [harness.authMessage] : []),
      ];
      const setup = setupForHarness(harness.id, harness.command, harness.enabled, harness.installed, harness.authStatus, harness.authMessage);
      return {
        id: harness.id,
        label: harness.label,
        provider: harness.provider,
        installed: harness.installed,
        enabled: harness.enabled,
        authStatus: harness.authStatus,
        authMessage: harness.authMessage,
        supportedActions: harness.capabilities,
        outputParser: harness.outputParser,
        supportsCancel: harness.supportsCancel,
        supportsStreaming: harness.supportsStreaming,
        modes,
        requiredSetup,
        ...setup,
        resolvedPath: harness.resolvedPath,
      };
    }),
    tools: {
      browser: setupTool({
        enabled: input.config.enabledTools.browser,
        available: input.browser.installed,
        state: input.browser.installed ? "ready" : "missing",
        message: input.browser.message,
        permissionKind: "none",
        readyAction: "Browser adapter ready",
        action: input.config.enabledTools.browser ? "Install browser adapter dependencies" : "Enable browser in Studio settings",
        command: "npm install",
      }),
      figma: setupTool({
        enabled: input.config.enabledTools.figma,
        available: input.figma.running,
        state: `${input.figma.bridgeStatus}/${input.figma.pluginStatus}`,
        message: input.figma.port ? `Bridge ${input.figma.bridgeStatus} on ${input.figma.port}` : "Bridge stopped",
        permissionKind: "figma",
        ready: input.figma.running && input.figma.pluginStatus === "connected",
        readyAction: "Figma bridge and plugin connected",
        action: input.config.enabledTools.figma
          ? input.figma.running
            ? "Open Figma and connect the Mémoire plugin"
            : "Start the Figma bridge"
          : "Enable Figma in Studio settings",
        canAutoOpen: true,
      }),
      computer: setupTool({
        enabled: input.config.computer.enabled,
        available: input.computer.available,
        state: input.computer.available ? "ready" : "limited",
        message: input.computer.message,
        permissionKind: "macos",
        ready: input.computer.available && permissionsReady(input.computer.permissions),
        readyAction: "Computer permissions ready",
        action: input.config.computer.enabled
          ? input.computer.available
            ? "Grant macOS Screen Recording, Accessibility, Automation, and file access"
            : "Use the macOS desktop app for Computer permissions"
          : "Enable Computer in Studio settings",
        canAutoOpen: input.computer.available,
      }),
      mcp: setupTool({
        enabled: input.config.enabledTools.mcp,
        available: input.config.enabledTools.mcp,
        state: input.config.enabledTools.mcp ? "enabled" : "disabled",
        message: input.config.enabledTools.mcp ? "MCP tools enabled" : "MCP tools disabled",
        permissionKind: "none",
        readyAction: "MCP tools enabled",
        action: "Enable MCP tools in Studio settings",
      }),
      shell: setupTool({
        enabled: input.config.enabledTools.shell,
        available: input.config.enabledTools.shell,
        state: input.config.enabledTools.shell ? "full-access" : "disabled",
        message: input.config.enabledTools.shell ? "Shell is enabled and every command is traced" : "Shell is disabled",
        permissionKind: "workspace",
        ready: input.config.enabledTools.shell,
        readyAction: input.config.enabledTools.shell ? "Shell full-access tracing enabled" : "Shell disabled by default",
        action: "Enable shell in Studio settings for terminal workflows",
      }),
    },
    providers: input.config.providers,
  };
}

function setupForHarness(
  id: StudioHarnessId,
  command: string,
  enabled: boolean,
  installed: boolean,
  authStatus: StudioHarnessAuthStatus,
  authMessage: string,
): {
  setupStatus: StudioSetupStatus;
  setupAction: string;
  setupCommand: string | null;
  canAutoOpen: boolean;
  permissionKind: StudioSetupPermissionKind;
} {
  if (!enabled) {
    return {
      setupStatus: "optional",
      setupAction: "Enable harness in Studio settings",
      setupCommand: null,
      canAutoOpen: false,
      permissionKind: "cli",
    };
  }
  if (!installed) {
    return {
      setupStatus: "needs_action",
      setupAction: `Install ${command}`,
      setupCommand: installCommandForHarness(id, command),
      canAutoOpen: true,
      permissionKind: "cli",
    };
  }
  if (authStatus === "needs_login" || authStatus === "missing") {
    return {
      setupStatus: "needs_action",
      setupAction: authMessage || `Authenticate ${command}`,
      setupCommand: loginCommandForHarness(id),
      canAutoOpen: true,
      permissionKind: "provider",
    };
  }
  if (authStatus === "config_error") {
    return {
      setupStatus: "blocked",
      setupAction: authMessage,
      setupCommand: null,
      canAutoOpen: false,
      permissionKind: "cli",
    };
  }
  return {
    setupStatus: "ready",
    setupAction: authStatus === "not_required" ? "Ready" : "Authenticated",
    setupCommand: null,
    canAutoOpen: false,
    permissionKind: "none",
  };
}

function setupTool(input: {
  enabled: boolean;
  available: boolean;
  state: string;
  message: string;
  permissionKind: StudioSetupPermissionKind;
  ready?: boolean;
  readyAction: string;
  action: string;
  command?: string | null;
  canAutoOpen?: boolean;
}): StudioCompatibilityTool {
  const disabled = !input.enabled;
  const ready = input.ready ?? (input.enabled && input.available);
  return {
    enabled: input.enabled,
    available: input.available,
    state: input.state,
    message: input.message,
    setupStatus: ready ? "ready" : disabled ? "optional" : "needs_action",
    setupAction: ready ? input.readyAction : input.action,
    setupCommand: input.command ?? null,
    canAutoOpen: Boolean(input.canAutoOpen),
    permissionKind: input.permissionKind,
  };
}

function installCommandForHarness(id: StudioHarnessId, command: string): string {
  if (id === "memoire") return "npm i -g @memi-design/cli";
  if (id === "claude-code") return "npm i -g @anthropic-ai/claude-code";
  if (id === "codex") return "npm i -g @openai/codex";
  if (id === "ollama") return "brew install ollama";
  if (id === "hermes") return "Install Hermes CLI from its project docs";
  return `Install ${command}`;
}

function loginCommandForHarness(id: StudioHarnessId): string | null {
  if (id === "claude-code") return "claude login";
  if (id === "codex") return "codex login";
  if (id === "ollama") return "ollama serve";
  return null;
}

function permissionsReady(permissions: StudioComputerStatus["permissions"]): boolean {
  return [
    permissions.accessibility,
    permissions.screenRecording,
    permissions.automation,
    permissions.fileAccess,
  ].every((status) => status === "granted" || status === "not_applicable");
}
