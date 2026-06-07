import { execFile as execFileCallback } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type {
  StudioComputerAction,
  StudioComputerActionRequest,
  StudioComputerActionResult,
  StudioComputerConfig,
  StudioComputerOpenRequest,
  StudioComputerStatus,
  StudioConfig,
} from "./types.js";

export interface StudioComputerAdapterOptions {
  projectRoot: string;
  platform?: NodeJS.Platform;
  execFile?: (file: string, args: string[]) => Promise<void>;
  now?: () => Date;
}

export class StudioComputerAdapter {
  private readonly projectRoot: string;
  private readonly platform: NodeJS.Platform;
  private readonly execFile: (file: string, args: string[]) => Promise<void>;
  private readonly now: () => Date;

  constructor(options: StudioComputerAdapterOptions) {
    this.projectRoot = resolve(options.projectRoot);
    this.platform = options.platform ?? process.platform;
    this.execFile = options.execFile ?? execFilePromise;
    this.now = options.now ?? (() => new Date());
  }

  status(config: StudioConfig): StudioComputerStatus {
    const enabled = Boolean(config.computer.enabled);
    const available = enabled && this.platform === "darwin";
    return {
      enabled,
      platform: this.platform,
      available,
      mode: config.computer.requireApproval ? "guarded-native" : "full-access-native",
      permissions: config.computer.permissions,
      allowedApps: config.computer.allowedApps,
      message: available
        ? "Computer integration ready; Studio records every action while macOS permissions stay user-controlled."
        : "Computer integration is limited outside the macOS desktop shell.",
    };
  }

  async open(request: StudioComputerOpenRequest, config: StudioConfig): Promise<StudioComputerActionResult> {
    const action = actionForOpenTarget(request.target);
    return this.action({
      action,
      value: request.value,
      app: request.target === "app" ? request.value : undefined,
      url: request.target === "url" || request.target === "browser" || request.target === "figma" ? request.value : undefined,
      path: request.target === "file" ? request.value : undefined,
      approved: request.approved,
    }, config, { openShortcut: true });
  }

  async action(
    request: StudioComputerActionRequest,
    config: StudioConfig,
    options: { openShortcut?: boolean } = {},
  ): Promise<StudioComputerActionResult> {
    const status = this.status(config);
    const approvalRequired = requiresApproval(request.action, config.computer, options.openShortcut);
    if (!status.enabled || !status.available) {
      return result(request.action, "unavailable", approvalRequired, false, status.message);
    }
    if (approvalRequired && !request.approved) {
      return result(request.action, "approval_required", true, false, `Approval required for ${request.action}`);
    }
    const validation = validateComputerAction(request, config);
    if (validation) return result(request.action, "failed", approvalRequired, false, validation);

    if (request.action === "captureScreen") {
      return this.captureScreen(request, approvalRequired);
    }

    return result(request.action, "completed", approvalRequired, false, actionMessage(request.action, request));
  }

  private async captureScreen(
    request: StudioComputerActionRequest,
    approvalRequired: boolean,
  ): Promise<StudioComputerActionResult> {
    const artifactDir = join(this.projectRoot, ".memoire", "studio", "artifacts", "computer");
    await mkdir(artifactDir, { recursive: true });
    const stamp = this.now().toISOString().replace(/[:.]/g, "-");
    const artifactPath = join(artifactDir, `${stamp}-screen.png`);
    try {
      await this.execFile("screencapture", ["-x", artifactPath]);
      return result(
        request.action,
        "completed",
        approvalRequired,
        true,
        `Captured screen to ${artifactPath}`,
        artifactPath,
      );
    } catch (error) {
      return result(
        request.action,
        "failed",
        approvalRequired,
        true,
        `Failed to capture screen: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

function actionForOpenTarget(target: StudioComputerOpenRequest["target"]): StudioComputerAction {
  if (target === "app") return "openApp";
  if (target === "file") return "revealPath";
  if (target === "figma") return "openFigma";
  if (target === "browser") return "openBrowser";
  return "openUrl";
}

function requiresApproval(action: StudioComputerAction, config: StudioComputerConfig, openShortcut = false): boolean {
  if (!config.requireApproval) return false;
  if (openShortcut && ["openUrl", "openApp", "revealPath", "openFigma", "openBrowser"].includes(action)) return false;
  return action === "captureScreen" || action === "focusApp" || action === "openApp";
}

function validateComputerAction(request: StudioComputerActionRequest, config: StudioConfig): string | null {
  if (request.action === "openApp" || request.action === "focusApp") {
    const app = request.app ?? request.value ?? "";
    if (!config.computer.allowedApps.includes(app)) return `App is not allowlisted: ${app}`;
  }
  if (request.action === "revealPath") {
    const path = resolve(String(request.path ?? request.value ?? thisPathFallback()));
    if (!path.startsWith(resolve(config.workspaceRoots[0] ?? ""))) return `Path is outside the active workspace: ${path}`;
  }
  return null;
}

function actionMessage(action: StudioComputerAction, request: StudioComputerActionRequest): string {
  if (action === "openUrl" || action === "openBrowser" || action === "openFigma") return `Prepared ${action} for ${request.url ?? request.value ?? "target"}`;
  if (action === "revealPath") return `Prepared reveal for ${request.path ?? request.value ?? "path"}`;
  if (action === "openApp" || action === "focusApp") return `Prepared ${action} for ${request.app ?? request.value ?? "app"}`;
  return `Prepared ${action}`;
}

function result(
  action: StudioComputerAction,
  status: StudioComputerActionResult["status"],
  requiresApproval: boolean,
  executed: boolean,
  message: string,
  artifactPath: string | null = null,
): StudioComputerActionResult {
  return {
    action,
    status,
    completedAt: new Date().toISOString(),
    requiresApproval,
    executed,
    message,
    artifactPath,
  };
}

function thisPathFallback(): string {
  return ".";
}

function execFilePromise(file: string, args: string[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    execFileCallback(file, args, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolvePromise();
    });
  });
}
