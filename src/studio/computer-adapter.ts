import { resolve } from "node:path";
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
}

export class StudioComputerAdapter {
  private readonly projectRoot: string;

  constructor(options: StudioComputerAdapterOptions) {
    this.projectRoot = resolve(options.projectRoot);
  }

  status(config: StudioConfig): StudioComputerStatus {
    const enabled = Boolean(config.computer.enabled);
    const available = enabled && process.platform === "darwin";
    return {
      enabled,
      platform: process.platform,
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

    return result(request.action, "completed", approvalRequired, false, actionMessage(request.action, request));
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
): StudioComputerActionResult {
  return {
    action,
    status,
    completedAt: new Date().toISOString(),
    requiresApproval,
    executed,
    message,
    artifactPath: null,
  };
}

function thisPathFallback(): string {
  return ".";
}
