import { invoke } from "@tauri-apps/api/core";

export type HarnessId =
  | "memoire"
  | "claude-code"
  | "codex"
  | "opencode"
  | "gemini"
  | "ollama"
  | "hermes"
  | "shell";
export type StudioAction =
  | "compose"
  | "design-doc"
  | "audit"
  | "references"
  | "video"
  | "raw"
  | "app-build"
  | "self-design"
  | "research"
  | "simulate"
  | "fix"
  | "browser-audit"
  | "handoff";
export type StudioSessionMode = "delegate" | "brokered";
export type StudioInputMode = "agent" | "terminal" | "auto";
export type StudioChatMode = "ideate" | "research" | "build" | "terminal" | "review";
export type StudioPermissionMode = "plan" | "guarded" | "full_access";
export type StudioCodexReasoningEffort = "low" | "medium" | "high" | "xhigh";
export type StudioCodexApprovalPolicy = "untrusted" | "on-request" | "never";
export type StudioAutonomyLevel = "supervised" | "ask-before-tools" | "autonomous";
export type StudioPermissionPolicy = "allow" | "approval" | "block";
export type StudioComputerPermissionState = "unknown" | "granted" | "denied" | "not_applicable";
export type StudioSetupStatus = "ready" | "needs_action" | "optional" | "blocked";
export type StudioSetupPermissionKind = "cli" | "provider" | "figma" | "macos" | "workspace" | "download" | "none";
export type AgentInstallTarget = "hermes" | "openclaw" | "claude-code" | "cursor" | "codex" | "opencode";
export type AgentInstallTargetInput = AgentInstallTarget | "all";
export type AgentKitKind = "skill" | "mcp-config";

export const AGENT_KIT_TARGETS: AgentInstallTarget[] = [
  "hermes",
  "openclaw",
  "claude-code",
  "cursor",
  "codex",
  "opencode",
];

export interface Harness {
  id: HarnessId;
  label: string;
  kind: string;
  provider: string;
  description: string;
  command: string;
  enabled: boolean;
  installed: boolean;
  resolvedPath?: string | null;
  authStatus?: "missing" | "needs_login" | "signed_in" | "ready" | "not_required";
  authMessage?: string;
  supportsCancel: boolean;
  outputParser: string;
  capabilities?: StudioAction[];
  defaultModel?: string | null;
}

export interface StudioProviderConfig {
  anthropic?: { enabled: boolean; envKey: "ANTHROPIC_API_KEY" };
  openai?: { enabled: boolean; envKey: "OPENAI_API_KEY" };
  openaiCompatible?: { enabled: boolean; baseUrl: string | null; envKey: string | null };
  ollama?: { enabled: boolean; baseUrl: string; defaultModel: string };
}

export interface StudioCodexConfig {
  model: string;
  reasoningEffort: StudioCodexReasoningEffort;
  approvalPolicy: StudioCodexApprovalPolicy;
  webSearch: boolean;
  skipGitRepoCheck: boolean;
  includeMemoireCommands: boolean;
  includeCodexCommands: boolean;
  planModeDefault: boolean;
}

export type StudioAutomationKind = "cron" | "heartbeat";
export type StudioAutomationStatus = "ACTIVE" | "PAUSED";
export type StudioAutomationMutationPolicy = "review" | "allow_writes" | "read_only";

export interface StudioAutomationDefinition {
  schemaVersion: 1;
  id: string;
  kind: StudioAutomationKind;
  name: string;
  prompt: string;
  status: StudioAutomationStatus;
  rrule: string;
  timezone: string;
  harness: HarnessId;
  action: StudioAction;
  chatMode: StudioChatMode;
  permissionMode: StudioPermissionMode;
  mutationPolicy: StudioAutomationMutationPolicy;
  codex?: Partial<StudioCodexConfig>;
  cwd: string;
  templateId?: string;
  sourceSessionId?: string | null;
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export interface StudioAutomationTemplate {
  id: string;
  name: string;
  description: string;
  kind: StudioAutomationKind;
  rrule: string;
  harness: HarnessId;
  action: StudioAction;
  chatMode: StudioChatMode;
  permissionMode: StudioPermissionMode;
  mutationPolicy: StudioAutomationMutationPolicy;
  prompt: string;
}

export interface StudioAutomationRun {
  id: string;
  automationId: string;
  sessionId: string | null;
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}

export interface StudioAutomationSchedulerStatus {
  label: string;
  installed: boolean;
  plistPath: string;
  projectRoot: string;
  runtimeBinary: string;
  intervalSeconds: number;
  logPath: string;
  message: string;
}

export interface StudioConfig {
  schemaVersion?: 1;
  workspaceRoots: string[];
  defaultHarness: HarnessId;
  defaultModel?: string | null;
  providers?: StudioProviderConfig;
  codex?: StudioCodexConfig;
  harnesses?: Array<Harness & { enabledByDefault?: boolean; installProbe?: string[]; capabilities?: StudioAction[] }>;
  ui?: {
    theme: "light" | "dark" | "system";
    inputMode: StudioInputMode;
    commandPaletteEnabled: boolean;
    toolbeltLayout: "compact" | "expanded";
  };
  agentProfiles?: Array<{
    id: string;
    name: string;
    defaultHarness: HarnessId;
    defaultAction: StudioAction;
    model: string | null;
    autonomy: StudioAutonomyLevel;
  }>;
  permissions?: {
    workspaceWrite: StudioPermissionPolicy;
    shell: StudioPermissionPolicy;
    computer: StudioPermissionPolicy;
    figma: StudioPermissionPolicy;
    allowlist: string[];
    denylist: string[];
  };
  computer?: {
    enabled: boolean;
    allowedApps: string[];
    requireApproval: boolean;
    permissions: {
      accessibility: StudioComputerPermissionState;
      screenRecording: StudioComputerPermissionState;
      automation: StudioComputerPermissionState;
      fileAccess: StudioComputerPermissionState;
    };
  };
  setup?: {
    wizardVersion: 1;
    completedAt: string | null;
    dismissedAt: string | null;
    lastCheckedAt: string | null;
    downloadReadyAcknowledged: boolean;
  };
  enabledTools?: {
    shell: boolean;
    browser: boolean;
    figma: boolean;
    mcp: boolean;
  };
  figma?: {
    autoStartBridge: boolean;
    preferredPort: number | null;
    portRange: [number, number];
    lastFileKey: string | null;
    lastConnectedAt: string | null;
  };
}

export interface AgentKitPlan {
  target: AgentInstallTarget;
  kind: AgentKitKind;
  source: string;
  destination: string;
  wouldWrite: boolean;
  exists: boolean;
  overwritten: boolean;
  note: string;
}

export interface AgentSuiteManifestPlan {
  destination: string;
  wouldWrite: boolean;
  exists: boolean;
  overwritten: boolean;
  note: string;
}

export interface AgentKitPlansPayload {
  targets: AgentInstallTarget[];
  projectRoot: string;
  suiteManifest?: AgentSuiteManifestPlan;
  plans: AgentKitPlan[];
}

export interface AgentKitInstallResult {
  action: "install";
  status: "planned" | "completed";
  target: AgentInstallTargetInput;
  dryRun: boolean;
  force: boolean;
  suiteManifest?: AgentSuiteManifestPlan;
  plans: AgentKitPlan[];
}

export interface StudioStatus {
  status: string;
  projectRoot: string;
  config: StudioConfig;
  harnesses?: Harness[];
  runtime?: StudioRuntimeStatus | null;
  metrics?: {
    uptimeMs: number;
    indexedSessions: number;
    activeProcesses: number;
    activeStreams: number;
    eventBufferSize: number;
    harnessProbeCacheAgeMs: number;
    enabledHarnesses: number;
    catalogCacheAgeMs?: number;
    downloads?: {
      total: number;
      active: number;
      queued: number;
    };
  };
}

export interface StudioRuntimeStatus {
  status: "running" | "starting" | "stopped" | "error";
  port: number;
  url: string;
  pid?: number | null;
  workspaceRoot: string;
  packageRoot?: string | null;
  error?: string | null;
}

export interface DesktopAppConfig {
  schemaVersion: 1;
  workspaceRoot: string;
}

export interface StudioDesignSystemTraceFile {
  path: string;
  status: string;
  insertions: number;
  deletions: number;
  kind: "component" | "style" | "token" | "spec" | "figma" | "config" | "research" | "other";
  designSystem: boolean;
}

export interface StudioDesignSystemTrace {
  generatedAt: string;
  projectRoot: string;
  status: "clean" | "changed" | "unavailable";
  filesChanged: number;
  insertions: number;
  deletions: number;
  reviewLabel: string;
  files: StudioDesignSystemTraceFile[];
  designSystemFiles: StudioDesignSystemTraceFile[];
  error: string | null;
}

export type DesignChangelogEntryStatus = "active" | "archived";
export type DesignChangelogAuthor = "agent" | "human" | "runtime";

export interface DesignChangelogFileRef {
  path: string;
  status: string;
  insertions: number;
  deletions: number;
  kind: StudioDesignSystemTraceFile["kind"];
  designSystem: boolean;
}

export interface DesignChangelogEntry {
  schemaVersion: 1;
  id: string;
  title: string;
  summary: string;
  bodyMarkdown: string;
  status: DesignChangelogEntryStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  authoredBy: DesignChangelogAuthor;
  harness: HarnessId | string | null;
  action: StudioAction | string | null;
  sessionId: string | null;
  eventIds: string[];
  fileRefs: DesignChangelogFileRef[];
  captureWarnings: string[];
}

export type DesignChangelogCreateInput = Partial<Omit<DesignChangelogEntry, "schemaVersion" | "id" | "createdAt" | "updatedAt" | "status">> & {
  id?: string;
  status?: DesignChangelogEntryStatus;
};
export type DesignChangelogPatchInput = Partial<Omit<DesignChangelogEntry, "schemaVersion" | "id" | "createdAt">>;

export interface DesignChangelogCaptureResult {
  entry: DesignChangelogEntry | null;
  captured: boolean;
  warnings: string[];
}

export interface SessionSummary {
  id: string;
  harness: HarnessId;
  action?: string;
  cwd: string;
  prompt: string;
  status: "running" | "completed" | "failed" | "cancelled";
  mode?: StudioSessionMode;
  chatMode?: StudioChatMode;
  permissionMode?: StudioPermissionMode;
  attachments?: StudioAttachment[];
  startedAt: string;
  completedAt: string | null;
  exitCode: number | null;
  eventCount: number;
  source?: "live" | "persisted";
}

export type StudioAttachmentKind = "image" | "file" | "text";
export type StudioAttachmentSource = "file" | "paste" | "drop" | "material";

export interface StudioAttachment {
  id: string;
  kind: StudioAttachmentKind;
  name: string;
  mimeType: string;
  size: number;
  source: StudioAttachmentSource;
  path?: string;
  text?: string;
  previewUrl?: string;
  sessionId?: string | null;
  createdAt: string;
}

export interface StudioAttachmentCaptureRequest {
  sessionId?: string | null;
  kind: StudioAttachmentKind;
  name: string;
  mimeType: string;
  source: StudioAttachmentSource;
  text?: string;
  dataUrl?: string;
}

export interface StudioEvent {
  id: string;
  sessionId: string;
  type: string;
  timestamp: string;
  message: string;
  data?: unknown;
}

export interface StudioToolDefinition {
  id: string;
  label: string;
  category: "workspace" | "shell" | "git" | "browser" | "figma" | "mcp" | "knowledge" | "research" | "simulation";
  description: string;
  requiresApproval: boolean;
  enabled: boolean;
}

export interface StudioToolCallRequest {
  id?: string;
  toolId: string;
  input?: Record<string, unknown>;
  cwd?: string;
  sessionId?: string | null;
  approved?: boolean;
}

export interface StudioToolCallResult {
  id: string;
  toolId: string;
  status: "completed" | "failed" | "approval_required";
  startedAt: string;
  completedAt: string;
  input: Record<string, unknown>;
  data?: unknown;
  error?: string;
  artifactPath?: string | null;
}

export interface StudioBrowserStatus {
  enabled: boolean;
  installed: boolean;
  activeSessions: number;
  message: string;
}

export interface StudioBrowserSession {
  id: string;
  url: string;
  status: "active" | "closed";
  createdAt: string;
  updatedAt: string;
  artifactDir: string;
}

export interface StudioComputerStatus {
  enabled: boolean;
  platform: string;
  available: boolean;
  mode: "full-access-native" | "guarded-native" | "limited-web";
  permissions: {
    accessibility: StudioComputerPermissionState;
    screenRecording: StudioComputerPermissionState;
    automation: StudioComputerPermissionState;
    fileAccess: StudioComputerPermissionState;
  };
  allowedApps: string[];
  message: string;
}

export type StudioComputerAction =
  | "openApp"
  | "openUrl"
  | "revealPath"
  | "focusApp"
  | "openFigma"
  | "openBrowser"
  | "captureScreen";

export interface StudioComputerActionResult {
  action: StudioComputerAction;
  status: "completed" | "approval_required" | "failed" | "unavailable";
  completedAt: string;
  requiresApproval: boolean;
  executed: boolean;
  message: string;
  artifactPath: string | null;
  result?: unknown;
}

export interface StudioCompatibilitySnapshot {
  schemaVersion: 1;
  generatedAt: string;
  runtime: "local";
  harnesses: Array<{
    id: HarnessId;
    label: string;
    provider: string;
    installed: boolean;
    enabled: boolean;
    authStatus: Harness["authStatus"];
    authMessage: string;
    supportedActions: StudioAction[];
    outputParser: string;
    supportsCancel: boolean;
    supportsStreaming: boolean;
    modes: StudioSessionMode[];
    requiredSetup: string[];
    setupStatus: StudioSetupStatus;
    setupAction: string;
    setupCommand: string | null;
    canAutoOpen: boolean;
    permissionKind: StudioSetupPermissionKind;
    resolvedPath: string | null;
  }>;
  tools: {
    browser: StudioCompatibilityTool;
    figma: StudioCompatibilityTool;
    computer: StudioCompatibilityTool;
    mcp: StudioCompatibilityTool;
    shell: StudioCompatibilityTool;
  };
  providers: StudioProviderConfig;
}

export interface StudioCompatibilityTool {
  enabled: boolean;
  available: boolean;
  state: string;
  message: string;
  setupStatus: StudioSetupStatus;
  setupAction: string;
  setupCommand: string | null;
  canAutoOpen: boolean;
  permissionKind: StudioSetupPermissionKind;
}

export interface StudioTracePhase {
  id: "research" | "analyze" | "ideate" | "design" | "spec" | "handoff";
  label: string;
  status: "queued" | "running" | "completed" | "failed";
  evidenceIds: string[];
}

export interface StudioTraceTask {
  id: string;
  label: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  evidenceIds: string[];
}

export type StudioReferenceTraceKind =
  | "package"
  | "spec"
  | "knowledge"
  | "figma"
  | "file"
  | "artifact"
  | "model";

export interface StudioReferenceTraceItem {
  id: string;
  kind: StudioReferenceTraceKind;
  label: string;
  summary: string;
  sourcePath?: string;
  packageName?: string;
  packageVersion?: string;
  url?: string;
  eventIds: string[];
}

export type StudioTraceOutputKind =
  | "chat"
  | "terminal"
  | "design"
  | "preview"
  | "research"
  | "marketplace"
  | "handoff"
  | "artifact"
  | "auth";

export interface StudioTraceOutput {
  id: string;
  kind: StudioTraceOutputKind;
  title: string;
  summary: string;
  sourcePath?: string;
  artifactPath?: string;
  url?: string;
  eventIds: string[];
}

export interface StudioTraceToolRun {
  id: string;
  tool: string;
  status: "queued" | "running" | "completed" | "failed" | "approval_required";
  summary: string;
  eventIds: string[];
}

export interface StudioTraceCitation {
  id: string;
  label: string;
  url?: string;
  sourcePath?: string;
  eventIds: string[];
}

export interface StudioTraceResearchEvidence {
  id: string;
  label: string;
  method: "qualitative" | "quantitative" | "mixed" | "netnography" | "desk";
  summary: string;
  sourcePath?: string;
  url?: string;
  tags: string[];
  eventIds: string[];
}

export type StudioActivityKind =
  | "thinking"
  | "reading_file"
  | "searching"
  | "listing"
  | "running_command"
  | "writing_file"
  | "using_tool"
  | "browser_action"
  | "figma_action"
  | "mcp_call"
  | "computer_action"
  | "terminal_group";

export interface StudioActivityItem {
  id: string;
  kind: StudioActivityKind;
  status: "running" | "completed" | "failed";
  label: string;
  summary: string;
  targetPath?: string;
  command?: string;
  sourceEventIds: string[];
  startedAt: string;
  completedAt?: string;
  outputPreview?: string;
}

export interface StudioActiveProcess {
  id: string;
  sessionId?: string;
  command: string;
  cwd?: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  outputPreview: string;
  sourceEventIds: string[];
}

export interface StudioTraceSnapshot {
  sessionId: string | null;
  source: "live" | "persisted" | "empty";
  generatedAt: string;
  phases: StudioTracePhase[];
  tasks: StudioTraceTask[];
  evidenceCount: number;
  activePhaseId: StudioTracePhase["id"] | null;
  eventIds: string[];
  references: StudioReferenceTraceItem[];
  outputs: StudioTraceOutput[];
  toolRuns: StudioTraceToolRun[];
  citations: StudioTraceCitation[];
  researchEvidence: StudioTraceResearchEvidence[];
  artifacts: DesignSystemArtifact[];
  activities: StudioActivityItem[];
  activeProcesses: StudioActiveProcess[];
}

export type DesignSystemArtifactReviewState = "unreviewed" | "looks_good" | "needs_work";
export type DesignSystemArtifactSectionKind =
  | "brand"
  | "type"
  | "colors"
  | "spacing"
  | "components"
  | "screens"
  | "accessibility"
  | "drift"
  | "handoff";

export interface DesignSystemArtifactSourceRef {
  id: string;
  label: string;
  sourcePath?: string;
  url?: string;
  line?: number;
  eventIds: string[];
}

export interface DesignSystemArtifactPreview {
  kind: "summary" | "tokens" | "typography" | "buttons" | "brand" | "spacing" | "components";
  items: Array<{ label: string; value: string; detail?: string }>;
}

export interface DesignSystemResolvedAsset {
  id: string;
  kind: "brand" | "logo" | "image" | "icon";
  label: string;
  sourcePath: string;
  previewUrl?: string;
  mimeType?: string;
  sectionId?: string;
}

export interface DesignSystemResolvedToken {
  id: string;
  kind: "color" | "typography" | "spacing" | "radius" | "shadow" | "component";
  name: string;
  value: string;
  sourcePath?: string;
  line?: number;
  sectionId?: string;
}

export interface DesignSystemArtifactSection {
  id: string;
  kind: DesignSystemArtifactSectionKind;
  title: string;
  summary: string;
  content: string;
  reviewState: DesignSystemArtifactReviewState;
  comments: string[];
  sourceRefs: DesignSystemArtifactSourceRef[];
  preview: DesignSystemArtifactPreview;
  eventIds: string[];
}

export type AgenticDesignSystemRoleId =
  | "harness_status"
  | "message_composer"
  | "tool_trace"
  | "artifact_review"
  | "memory_context"
  | "permission_control";
export type AgenticAtomicLevel = "atom" | "molecule" | "organism" | "template" | "page";
export type AgenticSurface = "topbar" | "composer" | "output" | "canvas" | "drawer";

export interface AgenticDesignSystemRole {
  id: AgenticDesignSystemRoleId;
  label: string;
  atomicLevel: AgenticAtomicLevel;
  surface: AgenticSurface;
  purpose: string;
  requiredSignals: string[];
  commandIds: string[];
  fallbackState: string;
}

export interface AgenticOpenSourceReference {
  name: string;
  url: string;
  license: string;
  category: string;
  mappedRoles: AgenticDesignSystemRoleId[];
}

export interface AgenticInteractionPattern {
  id: string;
  label: string;
  source: string;
  appliesTo: AgenticDesignSystemRoleId[];
  requiredSignals: string[];
}

export interface AgenticDesignSystemContract {
  contractVersion: 1;
  source: {
    name: string;
    url: string;
    figmaPreviewUrl: string;
    access: "public-preview";
    downloaded: false;
  };
  roles: AgenticDesignSystemRole[];
  outputSections: string[];
  agentRules: string[];
  openSourceReferences?: AgenticOpenSourceReference[];
  interactionPatterns?: AgenticInteractionPattern[];
}

export interface DesignSystemArtifact {
  schemaVersion: 1;
  id: string;
  title: string;
  status: "draft" | "review" | "published";
  sourceWorkspace: string | null;
  createdByHarness: string;
  sourceSessionId: string | null;
  sourceEventIds: string[];
  sourceRefs: DesignSystemArtifactSourceRef[];
  sections: DesignSystemArtifactSection[];
  agentic?: AgenticDesignSystemContract;
  assets?: DesignSystemResolvedAsset[];
  tokens?: DesignSystemResolvedToken[];
  resolvedAt?: string | null;
  resolverDiagnostics?: string[];
  rawContent: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectMemoryKind = "home" | "research" | "spec" | "system" | "monitor" | "changelog";
export type StudioKnowledgeKind =
  | "markdown"
  | "yaml"
  | "json"
  | "spec"
  | "note"
  | "research"
  | "design-reference"
  | "agent-capture"
  | "artifact";

export interface MarketplaceNote {
  id: string;
  name: string;
  title: string;
  category: string;
  description: string;
  source: "built-in-note" | "legacy-skill" | "workspace-skill" | "installed-note" | "remote-catalog" | "community-catalog" | "local-fork";
  sourcePath: string;
  sourceUrl: string | null;
  packageName: string | null;
  version: string;
  installed: boolean;
  builtIn: boolean;
  installable: boolean;
  tags: string[];
  sourceUrls?: string[];
  lastResearchedAt?: string | null;
  freshnessDays?: number | null;
  sourceRepo?: string | null;
  reviewStatus?: "draft" | "submitted" | "approved" | "rejected" | null;
  forkOf?: {
    name: string;
    version: string;
    sourceRepo?: string | null;
    sourcePath?: string | null;
  } | null;
  isForkable?: boolean;
  contributionUrl?: string | null;
  freshnessStatus?: string;
}

export interface NoteForkSummary {
  name: string;
  path: string;
  reviewStatus: "draft" | "submitted" | "approved" | "rejected";
  forkOf: {
    name: string;
    version: string;
    sourceRepo?: string | null;
    sourcePath?: string | null;
  };
  updatedAt: string;
}

export interface NoteForkFile {
  path: string;
  content: string;
  size: number;
  updatedAt: string;
}

export interface NoteForkValidation {
  ok: boolean;
  noteName: string | null;
  notePath: string;
  issues: Array<{ level: "error" | "warning"; message: string; path?: string }>;
  warnings: Array<{ level: "error" | "warning"; message: string; path?: string }>;
}

export interface NoteForkDiff {
  forkName: string;
  files: Array<{
    path: string;
    status: "added" | "modified" | "removed" | "unchanged";
    original: string | null;
    modified: string | null;
  }>;
}

export interface NoteForkPrHandoff {
  forkName: string;
  sourceRepo: string;
  targetPath: string;
  branchName: string;
  commitMessage: string;
  files: string[];
  commands: string[];
}

export interface StudioDownloadJob {
  id: string;
  type: "note-install";
  status: "queued" | "running" | "completed" | "failed";
  noteName: string | null;
  noteId: string | null;
  source: string | null;
  catalogUrl: string | null;
  progress: number;
  message: string;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface StudioDownloadEvent {
  id: string;
  jobId: string;
  type: "queued" | "progress" | "completed" | "failed";
  timestamp: string;
  message: string;
  progress: number;
}

export interface MarketplaceNotesPayload {
  notes: MarketplaceNote[];
  summary: {
    total: number;
    builtIn: number;
    installed: number;
    installable: number;
    categories: Record<string, number>;
  };
  remote?: {
    status: "disabled" | "ready" | "error";
    catalogUrl: string | null;
    checkedAt: string | null;
    cacheAgeMs: number;
    error: string | null;
    entries: number;
  };
  community?: {
    status: "disabled" | "ready" | "error";
    catalogUrl: string | null;
    checkedAt: string | null;
    cacheAgeMs: number;
    error: string | null;
    entries: number;
  };
}

export interface ProjectMemoryItem {
  id: string;
  kind: ProjectMemoryKind;
  title: string;
  summary: string;
  status: string;
  tags: string[];
  sourcePath: string;
  createdAt: string;
  updatedAt: string;
  links: Array<{ label: string; href: string }>;
  data: Record<string, unknown>;
}

export interface ProjectMemoryIndex {
  schemaVersion: 1;
  projectRoot: string;
  generatedAt: string;
  counts: Record<ProjectMemoryKind, number>;
  items: ProjectMemoryItem[];
}

export interface StudioKnowledgeItem {
  id: string;
  kind: StudioKnowledgeKind;
  title: string;
  summary: string;
  status: string;
  tags: string[];
  sourcePath: string;
  sourceRoot: string;
  contentType: string;
  content: string;
  excerpt: string;
  createdAt: string;
  updatedAt: string;
  links: Array<{ label: string; href: string }>;
  data: Record<string, unknown>;
  sessionId?: string;
  eventId?: string;
  eventType?: string;
}

export interface StudioKnowledgeIndex {
  schemaVersion: 1;
  projectRoot: string;
  generatedAt: string;
  counts: Record<StudioKnowledgeKind, number>;
  items: StudioKnowledgeItem[];
}

export interface FigmaStatus {
  running: boolean;
  port: number | null;
  bridgeStatus: "stopped" | "running";
  pluginStatus: "disconnected" | "connected";
  clients: Array<{
    id: string;
    file: string;
    fileKey?: string;
    editor: string;
    connectedAt: string;
    lastPing?: string;
  }>;
  connectionState: "connected" | "reconnecting" | "disconnected";
  reconnectAttempts: number;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
}

export type FigmaAction =
  | "inspectSelection"
  | "pullTokens"
  | "pullComponents"
  | "pullStyles"
  | "pullStickies"
  | "pageTree"
  | "widgetSnapshot"
  | "captureScreenshot"
  | "createNode"
  | "updateNode"
  | "deleteNode"
  | "setSelection"
  | "navigateTo"
  | "pushTokens"
  | "fullSync";

export interface FigmaActionRequest {
  action: FigmaAction;
  nodeId?: string;
  nodeIds?: string[];
  type?: string;
  name?: string;
  parentId?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  fills?: unknown;
  properties?: Record<string, unknown>;
  expectedVersion?: string;
  tokens?: { name: string; values: Record<string, string | number> }[];
  createMissing?: boolean;
  collectionName?: string;
}

export interface FigmaActionResult {
  action: FigmaAction;
  status: "completed";
  completedAt: string;
  result: unknown;
  artifactPath: string | null;
}

export interface FigmaOpenResult {
  status: "opened";
  target: string;
  openedAt: string;
}

const runtimeBase = import.meta.env.DEV ? "" : import.meta.env.VITE_MEMOIRE_STUDIO_RUNTIME
  || "http://127.0.0.1:8765";

function hasTauri(): boolean {
  return "__TAURI_INTERNALS__" in window && !window.location.protocol.startsWith("http");
}

export async function getStatus(): Promise<StudioStatus> {
  if (hasTauri()) return invoke<StudioStatus>("studio_status");
  return fetchJSON<StudioStatus>("/api/status");
}

export async function getRuntimeStatus(): Promise<StudioRuntimeStatus | null> {
  if (!hasTauri()) return null;
  return invoke<StudioRuntimeStatus>("studio_runtime_status");
}

export async function loadAppConfig(): Promise<DesktopAppConfig | null> {
  if (!hasTauri()) return null;
  return invoke<DesktopAppConfig>("load_app_config");
}

export async function saveAppConfig(config: DesktopAppConfig): Promise<DesktopAppConfig> {
  return invoke<DesktopAppConfig>("save_app_config", { config });
}

export async function selectWorkspace(): Promise<DesktopAppConfig> {
  return invoke<DesktopAppConfig>("select_workspace");
}

export async function listHarnesses(options: { refresh?: boolean } = {}): Promise<Harness[]> {
  const payload = await fetchJSON<{ harnesses: Harness[] }>(`/api/harnesses${options.refresh ? "?refresh=1" : ""}`);
  return payload.harnesses;
}

export async function getAgentKitPlans(input: { target?: AgentInstallTargetInput; force?: boolean; global?: boolean } = {}): Promise<AgentKitPlansPayload> {
  const target = input.target ?? "all";
  if (hasTauri()) {
    const status = await getStatus();
    const result = await invoke<AgentKitInstallResult>("agent_install", {
      target,
      project: status.projectRoot,
      dryRun: true,
      force: Boolean(input.force),
    });
    return {
      targets: ["hermes", "openclaw", "claude-code", "cursor", "codex", "opencode"],
      projectRoot: status.projectRoot,
      suiteManifest: result.suiteManifest,
      plans: result.plans,
    };
  }
  const params = new URLSearchParams({
    target,
    force: String(Boolean(input.force)),
    global: String(Boolean(input.global)),
  });
  return fetchJSON<AgentKitPlansPayload>(`/api/agents/kits?${params}`);
}

export async function installAgentKit(input: {
  target: AgentInstallTargetInput;
  dryRun?: boolean;
  force?: boolean;
  global?: boolean;
  project?: string;
}): Promise<AgentKitInstallResult> {
  if (hasTauri()) {
    const status = await getStatus();
    return invoke<AgentKitInstallResult>("agent_install", {
      target: input.target,
      project: input.project ?? status.projectRoot,
      dryRun: Boolean(input.dryRun),
      force: Boolean(input.force),
    });
  }
  return fetchJSON<AgentKitInstallResult>("/api/agents/kits/install", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function getConfig(): Promise<StudioConfig> {
  const payload = await fetchJSON<{ config: StudioConfig }>("/api/config");
  return payload.config;
}

export async function saveConfig(config: StudioConfig): Promise<StudioConfig> {
  const payload = await fetchJSON<{ config: StudioConfig }>("/api/config", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(config),
  });
  return payload.config;
}

export async function getAutomationTemplates(): Promise<StudioAutomationTemplate[]> {
  const payload = await fetchJSON<{ templates: StudioAutomationTemplate[] }>("/api/automations/templates");
  return payload.templates;
}

export async function listAutomations(): Promise<StudioAutomationDefinition[]> {
  const payload = await fetchJSON<{ automations: StudioAutomationDefinition[] }>("/api/automations");
  return payload.automations;
}

export async function createAutomation(input: Partial<StudioAutomationDefinition> & { templateId?: string }): Promise<StudioAutomationDefinition> {
  const payload = await fetchJSON<{ automation: StudioAutomationDefinition }>("/api/automations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return payload.automation;
}

export async function updateAutomation(id: string, patch: Partial<StudioAutomationDefinition>): Promise<StudioAutomationDefinition> {
  const payload = await fetchJSON<{ automation: StudioAutomationDefinition }>(`/api/automations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  return payload.automation;
}

export async function deleteAutomation(id: string): Promise<boolean> {
  const payload = await fetchJSON<{ deleted: boolean }>(`/api/automations/${encodeURIComponent(id)}`, { method: "DELETE" });
  return payload.deleted;
}

export async function runAutomationNow(id: string): Promise<StudioAutomationRun> {
  const payload = await fetchJSON<{ run: StudioAutomationRun }>(`/api/automations/${encodeURIComponent(id)}/run`, { method: "POST" });
  return payload.run;
}

export async function listAutomationRuns(id: string): Promise<StudioAutomationRun[]> {
  const payload = await fetchJSON<{ runs: StudioAutomationRun[] }>(`/api/automations/${encodeURIComponent(id)}/runs`);
  return payload.runs;
}

export async function getAutomationSchedulerStatus(): Promise<StudioAutomationSchedulerStatus> {
  const payload = await fetchJSON<{ scheduler: StudioAutomationSchedulerStatus }>("/api/automations/scheduler/status");
  return payload.scheduler;
}

export async function installAutomationScheduler(): Promise<StudioAutomationSchedulerStatus> {
  const payload = await fetchJSON<{ scheduler: StudioAutomationSchedulerStatus }>("/api/automations/scheduler/install", { method: "POST" });
  return payload.scheduler;
}

export async function uninstallAutomationScheduler(): Promise<StudioAutomationSchedulerStatus> {
  const payload = await fetchJSON<{ scheduler: StudioAutomationSchedulerStatus }>("/api/automations/scheduler/uninstall", { method: "POST" });
  return payload.scheduler;
}

export async function startSession(input: { harness: HarnessId; cwd: string; prompt: string; action?: StudioAction; mode?: StudioSessionMode; chatMode?: StudioChatMode; permissionMode?: StudioPermissionMode; attachments?: StudioAttachment[] }): Promise<SessionSummary> {
  const payload = await fetchJSON<{ session: SessionSummary }>("/api/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return payload.session;
}

export async function captureAttachment(input: StudioAttachmentCaptureRequest): Promise<StudioAttachment> {
  try {
    const payload = await fetchJSON<{ attachment: StudioAttachment }>("/api/attachments/capture", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    return payload.attachment;
  } catch (error) {
    if (!hasTauri()) throw error;
    return invoke<StudioAttachment>("capture_attachment", { payload: input });
  }
}

export async function getAttachment(id: string): Promise<StudioAttachment> {
  try {
    const payload = await fetchJSON<{ attachment: StudioAttachment }>(`/api/attachments/${encodeURIComponent(id)}`);
    return payload.attachment;
  } catch (error) {
    if (!hasTauri()) throw error;
    return invoke<StudioAttachment>("get_attachment", { id });
  }
}

export async function listStudioTools(): Promise<StudioToolDefinition[]> {
  const payload = await fetchJSON<{ tools: StudioToolDefinition[] }>("/api/tools");
  return payload.tools;
}

export async function callStudioTool(input: StudioToolCallRequest): Promise<StudioToolCallResult> {
  const payload = await fetchJSON<{ call: StudioToolCallResult }>("/api/tools/call", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return payload.call;
}

export async function getBrowserStatus(): Promise<StudioBrowserStatus> {
  return fetchJSON<StudioBrowserStatus>("/api/browser/status");
}

export async function getCompatibility(options: { refresh?: boolean } = {}): Promise<StudioCompatibilitySnapshot> {
  const payload = await fetchJSON<{ compatibility: StudioCompatibilitySnapshot }>(`/api/compatibility${options.refresh ? "?refresh=1" : ""}`);
  return payload.compatibility;
}

export async function getDesignSystemTrace(): Promise<StudioDesignSystemTrace> {
  const payload = await fetchJSON<{ trace: StudioDesignSystemTrace }>("/api/design-system/trace");
  return payload.trace;
}

export async function listDesignSystemArtifacts(): Promise<DesignSystemArtifact[]> {
  const payload = await fetchJSON<{ artifacts: DesignSystemArtifact[] }>("/api/artifacts");
  return payload.artifacts;
}

export async function listDesignChangelogEntries(): Promise<DesignChangelogEntry[]> {
  const payload = await fetchJSON<{ entries: DesignChangelogEntry[] }>("/api/design-changelog");
  return payload.entries;
}

export async function createDesignChangelogEntry(input: DesignChangelogCreateInput): Promise<DesignChangelogEntry> {
  const payload = await fetchJSON<{ entry: DesignChangelogEntry }>("/api/design-changelog", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return payload.entry;
}

export async function updateDesignChangelogEntry(id: string, patch: DesignChangelogPatchInput): Promise<DesignChangelogEntry> {
  const payload = await fetchJSON<{ entry: DesignChangelogEntry }>(`/api/design-changelog/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  return payload.entry;
}

export async function archiveDesignChangelogEntry(id: string): Promise<DesignChangelogEntry> {
  const payload = await fetchJSON<{ entry: DesignChangelogEntry }>(`/api/design-changelog/${encodeURIComponent(id)}`, { method: "DELETE" });
  return payload.entry;
}

export async function restoreDesignChangelogEntry(id: string): Promise<DesignChangelogEntry> {
  const payload = await fetchJSON<{ entry: DesignChangelogEntry }>(`/api/design-changelog/${encodeURIComponent(id)}/restore`, { method: "POST" });
  return payload.entry;
}

export async function captureDesignChangelogEntry(input: { session?: Partial<SessionSummary> | null; events?: StudioEvent[]; event?: StudioEvent; trace?: StudioDesignSystemTrace | null }): Promise<DesignChangelogCaptureResult> {
  return fetchJSON<DesignChangelogCaptureResult>("/api/design-changelog/capture", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function exportDesignChangelogMarkdown(): Promise<string> {
  const response = await fetch("/api/design-changelog?format=markdown");
  if (!response.ok) throw new Error(await response.text());
  return response.text();
}

export async function getDesignSystemArtifact(id: string): Promise<DesignSystemArtifact> {
  const payload = await fetchJSON<{ artifact: DesignSystemArtifact }>(`/api/artifacts/${encodeURIComponent(id)}`);
  return payload.artifact;
}

export async function captureDesignSystemArtifact(input: {
  artifact?: DesignSystemArtifact;
  session?: Partial<SessionSummary> | null;
  events?: StudioEvent[];
  event?: StudioEvent;
}): Promise<DesignSystemArtifact> {
  const payload = await fetchJSON<{ artifact: DesignSystemArtifact }>("/api/artifacts/capture", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return payload.artifact;
}

export async function reviewDesignSystemArtifactSection(input: {
  artifactId: string;
  sectionId: string;
  reviewState: DesignSystemArtifactReviewState;
  comment?: string | null;
}): Promise<DesignSystemArtifact> {
  const payload = await fetchJSON<{ artifact: DesignSystemArtifact }>(
    `/api/artifacts/${encodeURIComponent(input.artifactId)}/sections/${encodeURIComponent(input.sectionId)}/review`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reviewState: input.reviewState, comment: input.comment ?? null }),
    },
  );
  return payload.artifact;
}

export async function getComputerStatus(): Promise<StudioComputerStatus> {
  return fetchJSON<StudioComputerStatus>("/api/computer/status");
}

export async function openComputerTarget(input: { target: "app" | "url" | "file" | "figma" | "browser"; value: string; approved?: boolean }): Promise<StudioComputerActionResult> {
  const payload = await fetchJSON<{ result: StudioComputerActionResult }>("/api/computer/open", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return payload.result;
}

export async function callComputerAction(input: { action: StudioComputerAction; value?: string; app?: string; url?: string; path?: string; approved?: boolean; sessionId?: string | null }): Promise<StudioComputerActionResult> {
  const payload = await fetchJSON<{ result: StudioComputerActionResult }>("/api/computer/action", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return payload.result;
}

export async function createBrowserSession(url?: string): Promise<StudioBrowserSession> {
  const payload = await fetchJSON<{ session: StudioBrowserSession }>("/api/browser/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return payload.session;
}

export async function listSessions(): Promise<SessionSummary[]> {
  const payload = await fetchJSON<{ sessions: SessionSummary[] }>("/api/sessions");
  return payload.sessions;
}

export async function getSessionEvents(id: string, limit = 160): Promise<{ session: SessionSummary; events: StudioEvent[] }> {
  return fetchJSON<{ session: SessionSummary; events: StudioEvent[] }>(
    `/api/sessions/${encodeURIComponent(id)}/events?limit=${encodeURIComponent(String(limit))}`,
  );
}

export async function getSessionTrace(id: string): Promise<{ session: SessionSummary; trace: StudioTraceSnapshot }> {
  return fetchJSON<{ session: SessionSummary; trace: StudioTraceSnapshot }>(
    `/api/sessions/${encodeURIComponent(id)}/trace`,
  );
}

export async function cancelSession(id: string): Promise<boolean> {
  const payload = await fetchJSON<{ cancelled: boolean }>(`/api/sessions/${encodeURIComponent(id)}/cancel`, { method: "POST" });
  return payload.cancelled;
}

export function subscribeSession(id: string, onEvent: (event: StudioEvent) => void): () => void {
  const source = new EventSource(`${runtimeBase}/api/sessions/${encodeURIComponent(id)}/events`);
  const types = [
    "session_started",
    "reference_trace",
    "stdout",
    "stderr",
    "package_log",
    "harness_log",
    "auth_status",
    "reasoning",
    "tool_call",
    "tool_result",
    "approval_request",
    "approval_resolved",
    "artifact",
    "design_system_artifact",
    "file_change",
    "screenshot",
    "browser_snapshot",
    "mcp_call",
    "design_preview",
    "research_note",
    "design_decision",
    "acceptance_statement",
    "token_usage",
    "session_result",
    "session_done",
    "session_error",
    "video_project_created",
    "video_render_started",
    "video_render_completed",
    "video_render_failed",
  ];
  for (const type of types) {
    source.addEventListener(type, (message) => {
      onEvent(JSON.parse((message as MessageEvent).data) as StudioEvent);
    });
  }
  return () => source.close();
}

export async function getProjectMemory(): Promise<ProjectMemoryIndex> {
  return fetchJSON<ProjectMemoryIndex>("/api/project-memory");
}

export async function refreshProjectMemory(): Promise<ProjectMemoryIndex> {
  return fetchJSON<ProjectMemoryIndex>("/api/project-memory/refresh", { method: "POST" });
}

export async function getMarketplaceNotes(options: { refresh?: boolean } = {}): Promise<MarketplaceNotesPayload> {
  return fetchJSON<MarketplaceNotesPayload>(`/api/marketplace/notes${options.refresh ? "?refresh=1" : ""}`);
}

export async function installMarketplaceNote(input: { noteId?: string; source?: string }): Promise<{ job: StudioDownloadJob; marketplace: MarketplaceNotesPayload }> {
  return fetchJSON<{ job: StudioDownloadJob; marketplace: MarketplaceNotesPayload }>("/api/marketplace/notes/install", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function forkMarketplaceNote(noteId: string): Promise<{ fork: NoteForkSummary; marketplace: MarketplaceNotesPayload }> {
  return fetchJSON<{ fork: NoteForkSummary; marketplace: MarketplaceNotesPayload }>("/api/marketplace/notes/fork", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ noteId }),
  });
}

export async function listNoteForks(): Promise<NoteForkSummary[]> {
  const payload = await fetchJSON<{ forks: NoteForkSummary[] }>("/api/marketplace/notes/forks");
  return payload.forks;
}

export async function getNoteForkFiles(name: string): Promise<NoteForkFile[]> {
  const payload = await fetchJSON<{ files: NoteForkFile[] }>(`/api/marketplace/notes/forks/${encodeURIComponent(name)}/files`);
  return payload.files;
}

export async function updateNoteForkFile(name: string, input: { path: string; content: string }): Promise<NoteForkFile> {
  const payload = await fetchJSON<{ file: NoteForkFile }>(`/api/marketplace/notes/forks/${encodeURIComponent(name)}/files`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return payload.file;
}

export async function getNoteForkDiff(name: string): Promise<NoteForkDiff> {
  const payload = await fetchJSON<{ diff: NoteForkDiff }>(`/api/marketplace/notes/forks/${encodeURIComponent(name)}/diff`);
  return payload.diff;
}

export async function validateNoteFork(name: string): Promise<NoteForkValidation> {
  const payload = await fetchJSON<{ validation: NoteForkValidation }>(`/api/marketplace/notes/forks/${encodeURIComponent(name)}/validate`, {
    method: "POST",
  });
  return payload.validation;
}

export async function exportNoteForkPr(name: string): Promise<NoteForkPrHandoff> {
  const payload = await fetchJSON<{ handoff: NoteForkPrHandoff }>(`/api/marketplace/notes/forks/${encodeURIComponent(name)}/export-pr`, {
    method: "POST",
  });
  return payload.handoff;
}

export function subscribeDownloadEvents(id: string, onEvent: (event: StudioDownloadEvent) => void): () => void {
  const source = new EventSource(`${runtimeBase}/api/downloads/${encodeURIComponent(id)}/events`);
  for (const type of ["queued", "progress", "completed", "failed"]) {
    source.addEventListener(type, (message) => {
      onEvent(JSON.parse((message as MessageEvent).data) as StudioDownloadEvent);
    });
  }
  source.onerror = () => source.close();
  return () => source.close();
}

export async function removeMarketplaceNote(name: string): Promise<MarketplaceNotesPayload> {
  return fetchJSON<MarketplaceNotesPayload>("/api/marketplace/notes/remove", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function getProjectMemoryItem(id: string): Promise<ProjectMemoryItem> {
  const payload = await fetchJSON<{ item: ProjectMemoryItem }>(`/api/project-memory/${encodeURIComponent(id)}`);
  return payload.item;
}

export async function getKnowledgeIndex(): Promise<StudioKnowledgeIndex> {
  return fetchJSON<StudioKnowledgeIndex>("/api/knowledge?detail=compact");
}

export async function refreshKnowledgeIndex(): Promise<StudioKnowledgeIndex> {
  return fetchJSON<StudioKnowledgeIndex>("/api/knowledge/refresh?detail=compact", { method: "POST" });
}

export async function getKnowledgeItem(id: string): Promise<StudioKnowledgeItem> {
  const payload = await fetchJSON<{ item: StudioKnowledgeItem }>(`/api/knowledge/${encodeURIComponent(id)}`);
  return payload.item;
}

export async function getFigmaStatus(): Promise<FigmaStatus> {
  return fetchJSON<FigmaStatus>("/api/figma/status");
}

export async function connectFigma(preferredPort?: number | null): Promise<FigmaStatus> {
  return fetchJSON<FigmaStatus>("/api/figma/connect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ preferredPort: preferredPort ?? null }),
  });
}

export async function disconnectFigma(): Promise<FigmaStatus> {
  return fetchJSON<FigmaStatus>("/api/figma/disconnect", { method: "POST" });
}

export async function runFigmaAction(input: FigmaActionRequest): Promise<FigmaActionResult> {
  return fetchJSON<FigmaActionResult>("/api/figma/action", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function openFigma(fileKey?: string | null): Promise<FigmaOpenResult> {
  return fetchJSON<FigmaOpenResult>("/api/figma/open", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fileKey: fileKey ?? null }),
  });
}

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${runtimeBase}${path}`, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(payload.error ?? response.statusText);
  }
  return response.json() as Promise<T>;
}
