import type { StudioChatMode, StudioHarnessId, StudioPermissionMode, StudioRunAction } from "./types.js";

export interface WorkbenchE2ESurface {
  id: string;
  label: string;
  requiredActionIds: string[];
}

export interface WorkbenchHarnessE2ECase {
  id: StudioHarnessId;
  mode: "real" | "real-or-skip";
  action: StudioRunAction;
  chatMode: StudioChatMode;
  permissionMode: StudioPermissionMode;
  workspace: "disposable-fixture" | "configured-workspace";
  prompt: string;
  skipReason?: "missing-or-unauthenticated" | "disabled";
}

export interface WorkbenchE2EPlan {
  surfaces: WorkbenchE2ESurface[];
  harnesses: WorkbenchHarnessE2ECase[];
  requiredAssertions: string[];
  viewports: Array<{ name: string; width: number; height: number }>;
}

export const CORE_WORKBENCH_E2E_SURFACES: WorkbenchE2ESurface[] = [
  { id: "topbar", label: "Topbar", requiredActionIds: ["command-palette.open", "details.open", "theme.light", "theme.dark", "settings.open"] },
  { id: "sidebar", label: "Project/session sidebar", requiredActionIds: ["sidebar.collapse", "sidebar.new-chat", "plugins.open.sidebar", "figma.open.sidebar", "automations.open.sidebar"] },
  { id: "composer", label: "Message composer", requiredActionIds: ["attachment.add", "session.run", "session.cancel", "workspace.change"] },
  { id: "activity", label: "Agent activity and terminal trace", requiredActionIds: ["activity.copy-path.*", "activity.copy-command.*", "changed-files.review"] },
  { id: "artifact", label: "Design-system artifact canvas", requiredActionIds: ["artifact.use-system", "artifact.section.*", "right-pane.tab.*"] },
  { id: "details", label: "Run details drawer", requiredActionIds: ["details.section.*", "block.copy.*", "block.context.*", "block.toggle.*"] },
  { id: "settings", label: "Settings and setup", requiredActionIds: ["settings.section.*", "settings.save", "runtime.refresh"] },
];

export const REAL_HARNESS_E2E_MATRIX: WorkbenchHarnessE2ECase[] = [
  {
    id: "codex",
    mode: "real",
    action: "audit",
    chatMode: "review",
    permissionMode: "full_access",
    workspace: "disposable-fixture",
    prompt: "Mémoire Studio E2E smoke: read package metadata, run one harmless shell inspection, create a tiny design-system summary artifact, and finish with session_result.",
  },
  {
    id: "claude-code",
    mode: "real-or-skip",
    action: "audit",
    chatMode: "review",
    permissionMode: "guarded",
    workspace: "configured-workspace",
    prompt: "Mémoire Studio E2E smoke: inspect the current workspace read-only, report one file read, one search, and one session_result.",
    skipReason: "missing-or-unauthenticated",
  },
  {
    id: "hermes",
    mode: "real-or-skip",
    action: "audit",
    chatMode: "review",
    permissionMode: "guarded",
    workspace: "configured-workspace",
    prompt: "Mémoire Studio E2E smoke: summarize workspace readiness with visible activity and a session_result.",
    skipReason: "missing-or-unauthenticated",
  },
  {
    id: "memoire",
    mode: "real-or-skip",
    action: "compose",
    chatMode: "ideate",
    permissionMode: "guarded",
    workspace: "configured-workspace",
    prompt: "Mémoire Native E2E smoke: compose a concise design-system workbench readiness note as JSON if available.",
    skipReason: "disabled",
  },
];

export function buildWorkbenchE2EPlan(): WorkbenchE2EPlan {
  return {
    surfaces: CORE_WORKBENCH_E2E_SURFACES,
    harnesses: REAL_HARNESS_E2E_MATRIX,
    requiredAssertions: [
      "every enabled button has data-action-id or an explicit disabled reason",
      "no visible control overlaps another visible control at desktop, narrow desktop, or mobile-width pane",
      "terminal output is collapsed by default and expandable inside the activity row",
      "real harness sessions produce reference_trace, activity, terminal/process, and session_result evidence",
    ],
    viewports: [
      { name: "desktop", width: 1440, height: 980 },
      { name: "narrow-desktop", width: 980, height: 920 },
      { name: "mobile-pane", width: 430, height: 920 },
    ],
  };
}
