export type StudioClickSurface =
  | "topbar"
  | "sidebar"
  | "composer"
  | "activity"
  | "changes"
  | "artifact"
  | "details"
  | "settings"
  | "figma"
  | "automations"
  | "plugins"
  | "knowledge"
  | "changelog"
  | "computer"
  | "scenario"
  | "output"
  | "unknown";

export type StudioClickPermission = "figma" | "computer" | "browser" | "shell" | "workspace" | "download" | "none";

export interface StudioClickTarget {
  id: string;
  label: string;
  surface: StudioClickSurface;
  selector: string;
  expectedResult: string;
  mutates: boolean;
  requiresHarness: boolean;
  requiresPermission: StudioClickPermission;
}

export interface StudioClickManifestValidation {
  errors: string[];
  warnings: string[];
}

export function buildStudioClickManifestFromSource(source: string): StudioClickTarget[] {
  const ids = new Set<string>();
  const patterns = [
    /data-action-id="([^"]+)"/gu,
    /data-action-id=\{`([^`]+)`\}/gu,
    /data-action-id=\{(?!`)([^}\n]+)\}/gu,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const normalized = normalizeStudioActionId(match[1] ?? "");
      if (normalized) ids.add(normalized);
    }
  }

  return buildStudioClickManifestFromActionIds([...ids]);
}

export function buildStudioClickManifestFromActionIds(actionIds: string[]): StudioClickTarget[] {
  return [...new Set(actionIds.map(normalizeStudioActionId).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
    .map((id) => {
      const classification = classifyStudioAction(id);
      return {
        id,
        label: labelForStudioAction(id),
        selector: `[data-action-id="${id}"]`,
        ...classification,
      };
    });
}

export function normalizeStudioActionId(actionId: string): string {
  let cleaned = actionId
    .trim()
    .replace(/^["'`]+|["'`]+$/gu, "");

  if (cleaned.startsWith("{") && cleaned.endsWith("}") && !cleaned.includes("${")) {
    cleaned = cleaned.slice(1, -1);
  }

  cleaned = cleaned
    .replace(/\$\{[^}]+\}/gu, "*")
    .replace(/\{[^}]+\}/gu, "*")
    .replace(/\[[^\]]+\]/gu, "*")
    .replace(/\s+/gu, "");

  if (!cleaned) return "";
  if (cleaned === "action.id") return "command-palette.action.*";
  if (cleaned.includes("section.toLowerCase")) return "settings.section.*";
  if (cleaned.includes("selectedEntry.id")) return cleaned.replace(/selectedEntry\.id/gu, "*");
  if (cleaned.includes("automation.id")) return cleaned.replace(/automation\.id/gu, "*");
  if (cleaned.includes("project.id")) return cleaned.replace(/project\.id/gu, "*");
  if (cleaned.includes("session.id")) return cleaned.replace(/session\.id/gu, "*");
  if (cleaned.includes("harness.id")) return cleaned.replace(/harness\.id/gu, "*");
  if (cleaned.includes("item.id")) return cleaned.replace(/item\.id/gu, "*");
  if (cleaned.includes("entry.id")) return cleaned.replace(/entry\.id/gu, "*");
  if (cleaned.includes("tool.id")) return cleaned.replace(/tool\.id/gu, "*");
  if (cleaned.includes("root")) return cleaned.replace(/root/gu, "*");
  if (cleaned.includes("permission")) return cleaned.replace(/permission/gu, "*");
  if (cleaned.includes("note.id")) return cleaned.replace(/note\.id/gu, "*");
  if (cleaned.includes("note.name")) return cleaned.replace(/note\.name/gu, "*");
  if (cleaned.includes("file.path")) return cleaned.replace(/file\.path/gu, "*");
  if (cleaned.includes("process.id")) return cleaned.replace(/process\.id/gu, "*");
  if (cleaned.includes("activity.id")) return cleaned.replace(/activity\.id/gu, "*");
  if (cleaned.includes("block.id")) return cleaned.replace(/block\.id/gu, "*");
  if (cleaned.includes("recent.id")) return cleaned.replace(/recent\.id/gu, "*");
  if (cleaned.includes("filter.id")) return cleaned.replace(/filter\.id/gu, "*");
  if (cleaned.includes("tab.id")) return cleaned.replace(/tab\.id/gu, "*");
  if (cleaned.includes("template.id")) return cleaned.replace(/template\.id/gu, "*");
  if (cleaned.includes("section.kind")) return cleaned.replace(/section\.kind/gu, "*");
  if (cleaned.includes("section.id")) return cleaned.replace(/section\.id/gu, "*");
  if (cleaned.includes("actionIdSegment")) return cleaned.replace(/actionIdSegment\([^)]+\)/gu, "*");
  if (cleaned.includes("action.request.action")) return cleaned.replace(/action\.request\.action/gu, "*");
  if (cleaned.includes("action.id")) return cleaned.replace(/action\.id/gu, "*");
  return cleaned.replace(/\.\*\.?/gu, ".*").replace(/\*+/gu, "*");
}

export function classifyStudioAction(actionId: string): Omit<StudioClickTarget, "id" | "label" | "selector"> {
  const surface = surfaceForAction(actionId);
  return {
    surface,
    expectedResult: expectedResultForAction(actionId, surface),
    mutates: mutatesForAction(actionId),
    requiresHarness: requiresHarnessForAction(actionId),
    requiresPermission: permissionForAction(actionId),
  };
}

export function validateStudioClickManifest(manifest: StudioClickTarget[]): StudioClickManifestValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const target of manifest) {
    if (!target.id) errors.push("Click target is missing id.");
    if (!target.label) errors.push(`${target.id} is missing label.`);
    if (!target.selector) errors.push(`${target.id} is missing selector.`);
    if (!target.expectedResult) errors.push(`${target.id} is missing expected result.`);
    if (target.surface === "unknown") warnings.push(`${target.id} has unknown surface.`);
    if (seen.has(target.id)) errors.push(`${target.id} is duplicated.`);
    seen.add(target.id);
  }

  return { errors, warnings };
}

function surfaceForAction(actionId: string): StudioClickSurface {
  if (/^(command-palette\.open|details\.open|theme\..+|settings\.open|runtime\.refresh)$/u.test(actionId)) return "topbar";
  if (/^(sidebar\.|project\.toggle|session\.switch|plugins\.open\.sidebar|figma\.open\.sidebar|automations\.open\.sidebar|changelog\.open\.sidebar|command-palette\.open\.sidebar)$/u.test(actionId)) return "sidebar";
  if (/^(session\.run|session\.cancel|codex\.|workspace\.change|attachment\.|input-mode\.|chat-mode\.|starter\.prompt|harness\.select|harness\.action|command-palette\.action)/u.test(actionId)) return "composer";
  if (/^(activity\.|changed-file\.copy)/u.test(actionId)) return "activity";
  if (/^changed-files\./u.test(actionId)) return "changes";
  if (/^(artifact\.|source-ref\.|right-pane\.|design-trace\.)/u.test(actionId)) return "artifact";
  if (/^(details\.|block\.|memory\.|context\.)/u.test(actionId)) return "details";
  if (/^settings\./u.test(actionId)) return "settings";
  if (/^figma\./u.test(actionId)) return "figma";
  if (/^automations\./u.test(actionId)) return "automations";
  if (/^knowledge\./u.test(actionId)) return "knowledge";
  if (/^design-changelog\./u.test(actionId)) return "changelog";
  if (/^computer\./u.test(actionId)) return "computer";
  if (/^scenario\./u.test(actionId)) return "scenario";
  if (/^output\./u.test(actionId)) return "output";
  if (/^download\./u.test(actionId)) return "settings";
  return "unknown";
}

function expectedResultForAction(actionId: string, surface: StudioClickSurface): string {
  if (actionId === "session.run") return "Starts a traced Studio harness session.";
  if (actionId === "session.cancel") return "Stops the active Studio harness session.";
  if (actionId.startsWith("activity.copy-path")) return "Copies the compact activity target path.";
  if (actionId.startsWith("activity.copy-command")) return "Copies the traced terminal command.";
  if (actionId.startsWith("source-ref.copy")) return "Copies the compact source reference path.";
  if (actionId.startsWith("starter.prompt")) return "Loads a starter prompt into the composer.";
  if (actionId.startsWith("theme.")) return "Switches Studio theme without changing the active session.";
  if (actionId.startsWith("figma.")) return "Runs a visible Figma bridge action or opens Figma setup.";
  if (actionId.startsWith("automations.run")) return "Starts an auditable automation run.";
  if (actionId.startsWith("artifact.")) return "Updates or opens the design-system artifact review surface.";
  if (actionId.startsWith("settings.")) return "Opens, updates, or copies Studio settings state.";
  if (actionId.startsWith("computer.")) return "Prepares an auditable macOS Computer action.";
  if (actionId.startsWith("command-palette")) return "Opens or executes a command-palette navigation action.";
  return `Executes the ${surface} action ${actionId}.`;
}

function mutatesForAction(actionId: string): boolean {
  if (/^(theme\.|command-palette\.open|details\.open|settings\.open|sidebar\.collapse|project\.toggle|session\.switch|starter\.prompt|block\.|activity\.copy|source-ref\.copy|changed-file\.copy|knowledge\.filter|context\.filter|right-pane\.tab)/u.test(actionId)) {
    return false;
  }
  return /(run|cancel|new|save|connect|disconnect|install|uninstall|remove|delete|archive|restore|pause|create|finish|action|review|refresh|open|change|copy|capture|select|filter)/u.test(actionId);
}

function requiresHarnessForAction(actionId: string): boolean {
  return /^(session\.run|session\.cancel|codex\.|harness\.select|automations\.run)/u.test(actionId);
}

function permissionForAction(actionId: string): StudioClickPermission {
  if (/^figma\./u.test(actionId)) return "figma";
  if (/^computer\./u.test(actionId)) return "computer";
  if (/^download\./u.test(actionId)) return "download";
  if (/^(session\.run|workspace\.change|changed-files\.review)/u.test(actionId)) return "workspace";
  return "none";
}

function labelForStudioAction(actionId: string): string {
  return actionId
    .replace(/\.\*/gu, "")
    .split(".")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).replaceAll("-", " "))
    .join(" ");
}
