export type StudioHarnessId =
  | "memoire"
  | "claude-code"
  | "codex"
  | "opencode"
  | "gemini"
  | "ollama"
  | "hermes"
  | "shell";

export type StudioHarnessKind = "memoire" | "external-cli" | "local-model" | "shell";
export type StudioHarnessVisibility = "primary" | "advanced";
export type StudioRunAction =
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
export type StudioVideoAdapterId = "remotion" | "hyperframes";
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
export type StudioFigmaAction =
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
export type StudioHarnessProvider = "memoire" | "anthropic" | "openai" | "google" | "local" | "shell";
export type StudioUsageProviderId = "anthropic" | "openai" | "openai-compatible" | "google" | "local" | "memoire" | "shell";
export type StudioHarnessAuthStatus = "missing" | "needs_login" | "signed_in" | "ready" | "not_required";
export type StudioEnvPolicy = "provider" | "local-model" | "safe-inherit" | "shell";
export type StudioWorkspacePolicy = "workspace-required" | "trusted-shell";
export type StudioSetupStatus = "ready" | "needs_action" | "optional" | "blocked";
export type StudioSetupPermissionKind =
  | "cli"
  | "provider"
  | "figma"
  | "macos"
  | "workspace"
  | "download"
  | "none";
export type StudioOutputParser =
  | "memoire-jsonl"
  | "claude-stream-json"
  | "codex-jsonl"
  | "opencode-jsonl"
  | "hermes-text"
  | "stdio"
  | "ollama"
  | "shell";
export type StudioAutomationKind = "cron" | "heartbeat";
export type StudioAutomationStatus = "ACTIVE" | "PAUSED";
export type StudioAutomationMutationPolicy = "review" | "allow_writes" | "read_only";

export type {
  StudioReferenceTraceItem,
  StudioReferenceTraceKind,
} from "./reference-trace.js";

export type {
  StudioTraceSnapshot,
  StudioTracePhase,
  StudioTraceTask,
  StudioTraceOutput,
  StudioTraceToolRun,
  StudioTraceCitation,
  StudioTraceResearchEvidence,
  StudioActivityItem,
  StudioActivityKind,
  StudioActiveProcess,
} from "./view-model.js";

export interface StudioActionRegistryItem {
  id: string;
  label: string;
  kind: "local" | "runtime";
  surface: "topbar" | "nav" | "rail" | "command" | "context" | "figma" | "marketplace" | "monitor";
}

export interface StudioShellStatus {
  workspaceLabel: string;
  activeRun: string;
  indexedMemoryCount: number;
  logStreamState: "idle" | "streaming" | "replaying" | "error";
  figmaState: string;
  version: string;
}

export interface StudioHarnessManifest {
  schemaVersion: 2;
  hardlineBlockedPatterns: Array<{
    pattern: string;
    description: string;
  }>;
  harnesses: StudioHarnessManifestEntry[];
}

export interface StudioHarnessManifestEntry {
  id: StudioHarnessId;
  label: string;
  kind: StudioHarnessKind;
  provider: StudioHarnessProvider;
  command: string;
  description: string;
  visibility: StudioHarnessVisibility;
  enabledByDefault: boolean;
  installProbe: string[];
  capabilities: StudioRunAction[];
  commandTemplates: Partial<Record<StudioRunAction, string[]>>;
  envPolicy: StudioEnvPolicy;
  workspacePolicy: StudioWorkspacePolicy;
  supportsStreaming: boolean;
  supportsCancel: boolean;
  outputParser: StudioOutputParser;
  defaultModel?: string | null;
  docsUrl?: string;
  setup?: StudioHarnessSetupStep[];
  authProbe?: {
    command: string;
    args: string[];
  };
  pluginDirs?: string[];
  supportsSkills?: boolean;
  supportsMcp?: boolean;
  knownFailurePatterns?: StudioHarnessFailurePattern[];
}

export interface StudioHarnessSetupStep {
  id: string;
  label: string;
  command?: string | null;
  url?: string | null;
  required: boolean;
}

export interface StudioHarnessFailurePattern {
  pattern: string;
  message: string;
  setupStepId?: string | null;
}

export interface StudioHarnessConfig extends StudioHarnessManifestEntry {
  id: StudioHarnessId;
  enabled: boolean;
}

export interface StudioHarnessStatus extends StudioHarnessConfig {
  installed: boolean;
  resolvedPath: string | null;
  probeAgeMs: number;
  authStatus: StudioHarnessAuthStatus;
  authMessage: string;
}

export interface StudioProviderConfig {
  anthropic: { enabled: boolean; envKey: "ANTHROPIC_API_KEY" };
  openai: { enabled: boolean; envKey: "OPENAI_API_KEY" };
  openaiCompatible: { enabled: boolean; baseUrl: string | null; envKey: string | null };
  ollama: { enabled: boolean; baseUrl: string; defaultModel: string };
}

export interface StudioUiConfig {
  theme: "light" | "dark" | "system";
  inputMode: StudioInputMode;
  commandPaletteEnabled: boolean;
  toolbeltLayout: "compact" | "expanded";
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

export interface StudioAgentProfileConfig {
  id: string;
  name: string;
  defaultHarness: StudioHarnessId;
  defaultAction: StudioRunAction;
  model: string | null;
  autonomy: StudioAutonomyLevel;
}

export interface StudioPermissionConfig {
  workspaceWrite: StudioPermissionPolicy;
  shell: StudioPermissionPolicy;
  computer: StudioPermissionPolicy;
  figma: StudioPermissionPolicy;
  allowlist: string[];
  denylist: string[];
}

export interface StudioComputerConfig {
  enabled: boolean;
  allowedApps: string[];
  requireApproval: boolean;
  permissions: {
    accessibility: StudioComputerPermissionState;
    screenRecording: StudioComputerPermissionState;
    automation: StudioComputerPermissionState;
    fileAccess: StudioComputerPermissionState;
  };
}

export interface StudioSetupConfig {
  wizardVersion: 1;
  completedAt: string | null;
  dismissedAt: string | null;
  lastCheckedAt: string | null;
  downloadReadyAcknowledged: boolean;
}

export interface StudioUsageBudget {
  dailyTokenLimit?: number | null;
  dailyCostLimitUsd?: number | null;
  warningThreshold?: number | null;
}

export interface StudioUsageBudgetConfig {
  warningThreshold: number;
  providers: Partial<Record<StudioUsageProviderId, StudioUsageBudget>>;
  harnesses: Partial<Record<StudioHarnessId, StudioUsageBudget>>;
}

export interface StudioConfig {
  schemaVersion: 1;
  workspaceRoots: string[];
  defaultHarness: StudioHarnessId;
  defaultModel: string | null;
  providers: StudioProviderConfig;
  harnesses: StudioHarnessConfig[];
  codex: StudioCodexConfig;
  ui: StudioUiConfig;
  agentProfiles: StudioAgentProfileConfig[];
  permissions: StudioPermissionConfig;
  computer: StudioComputerConfig;
  setup: StudioSetupConfig;
  usageBudgets: StudioUsageBudgetConfig;
  enabledTools: {
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

export interface StudioAutomationDefinition {
  schemaVersion: 1;
  id: string;
  kind: StudioAutomationKind;
  name: string;
  prompt: string;
  status: StudioAutomationStatus;
  rrule: string;
  timezone: string;
  harness: StudioHarnessId;
  action: StudioRunAction;
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
  harness: StudioHarnessId;
  action: StudioRunAction;
  chatMode: StudioChatMode;
  permissionMode: StudioPermissionMode;
  mutationPolicy: StudioAutomationMutationPolicy;
  prompt: string;
}

export interface StudioAutomationRun {
  id: string;
  automationId: string;
  sessionId: string | null;
  status: "running" | "completed" | "failed" | "cancelled" | "skipped";
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

export type StudioEventType =
  | "chat_message"
  | "session_started"
  | "reference_trace"
  | "terminal_command"
  | "terminal_output"
  | "stdout"
  | "stderr"
  | "package_log"
  | "harness_log"
  | "auth_status"
  | "reasoning"
  | "tool_call"
  | "tool_result"
  | "approval_request"
  | "approval_resolved"
  | "artifact"
  | "design_system_artifact"
  | "file_change"
  | "screenshot"
  | "browser_snapshot"
  | "mcp_call"
  | "design_artifact"
  | "design_preview"
  | "preview_ready"
  | "figma_candidate"
  | "spec_reference"
  | "handoff_bundle"
  | "research_capture"
  | "research_code"
  | "research_theme"
  | "research_metric"
  | "research_note"
  | "design_decision"
  | "acceptance_statement"
  | "marketplace_download"
  | "auth_state"
  | "token_usage"
  | "session_result"
  | "session_done"
  | "session_error"
  | "memory_indexed"
  | "memory_item_updated"
  | "figma_bridge_started"
  | "figma_bridge_stopped"
  | "figma_plugin_connected"
  | "figma_action_started"
  | "figma_action_completed"
  | "figma_action_failed"
  | "computer_action_started"
  | "computer_action_completed"
  | "computer_action_failed"
  | "permission_status_changed"
  | "video_project_created"
  | "video_render_started"
  | "video_render_completed"
  | "video_render_failed";

export interface StudioEvent {
  id: string;
  sessionId: string;
  type: StudioEventType;
  timestamp: string;
  message: string;
  data?: unknown;
}

export interface StudioSession {
  id: string;
  conversationId?: string;
  turnIndex?: number;
  goal?: string;
  model?: string | null;
  effort?: string | null;
  harness: StudioHarnessId;
  action: StudioRunAction;
  mode?: StudioSessionMode;
  chatMode?: StudioChatMode;
  permissionMode?: StudioPermissionMode;
  cwd: string;
  prompt: string;
  attachments?: StudioAttachment[];
  status: "running" | "completed" | "failed" | "cancelled";
  startedAt: string;
  completedAt: string | null;
  exitCode: number | null;
  activeStreamId: string | null;
  pendingPrompt: string | null;
  events: StudioEvent[];
}

export interface StudioRunRequest {
  harnessId: StudioHarnessId;
  goal?: string;
  action?: StudioRunAction;
  mode?: StudioSessionMode;
  chatMode?: StudioChatMode;
  permissionMode?: StudioPermissionMode;
  cwd: string;
  prompt: string;
  model?: string | null;
  effort?: string | null;
  attachments?: StudioAttachment[];
  agentContext?: StudioAgentContext;
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

export interface StudioCommandSpec {
  command: string;
  args: string[];
  cwd: string;
  action: StudioRunAction;
  harness: StudioHarnessId;
  outputParser: StudioOutputParser;
  env?: NodeJS.ProcessEnv;
}

export type StudioToolCategory =
  | "workspace"
  | "shell"
  | "git"
  | "browser"
  | "figma"
  | "computer"
  | "mcp"
  | "knowledge"
  | "research"
  | "board"
  | "simulation";

export interface StudioToolDefinition {
  id: string;
  label: string;
  category: StudioToolCategory;
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

export interface StudioToolApprovalRequest {
  required: true;
  reason: string;
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
  approval?: StudioToolApprovalRequest;
  artifactPath?: string | null;
}

export interface StudioHarnessLoopStep {
  id: string;
  sessionId: string;
  step: number;
  eventId: string | null;
  toolCallId: string | null;
  status: "queued" | "running" | "completed" | "failed";
}

export interface StudioAgentMission {
  id: string;
  action: StudioRunAction;
  title: string;
  prompt: string;
  harness: StudioHarnessId;
  mode: StudioSessionMode;
}

export type StudioBrowserAction =
  | "open"
  | "snapshot"
  | "screenshot"
  | "click"
  | "type"
  | "close";

export interface StudioBrowserSession {
  id: string;
  url: string;
  status: "active" | "closed";
  createdAt: string;
  updatedAt: string;
  artifactDir: string;
}

export interface StudioBrowserStatus {
  enabled: boolean;
  installed: boolean;
  activeSessions: number;
  message: string;
}

export interface StudioBrowserActionRequest {
  action: StudioBrowserAction;
  sessionId?: string;
  url?: string;
  selector?: string;
  text?: string;
}

export interface StudioBrowserActionResult {
  action: StudioBrowserAction;
  sessionId: string;
  status: "completed";
  completedAt: string;
  result: unknown;
  artifactPath: string | null;
}

export type StudioComputerAction =
  | "openApp"
  | "openUrl"
  | "revealPath"
  | "focusApp"
  | "openFigma"
  | "openBrowser"
  | "captureScreen";

export interface StudioComputerStatus {
  enabled: boolean;
  platform: NodeJS.Platform;
  available: boolean;
  mode: "full-access-native" | "guarded-native" | "limited-web";
  permissions: StudioComputerConfig["permissions"];
  allowedApps: string[];
  message: string;
}

export interface StudioComputerOpenRequest {
  target: "app" | "url" | "file" | "figma" | "browser";
  value: string;
  approved?: boolean;
}

export interface StudioComputerActionRequest {
  action: StudioComputerAction;
  value?: string;
  app?: string;
  url?: string;
  path?: string;
  approved?: boolean;
  sessionId?: string | null;
}

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

export interface StudioCompatibilityHarness {
  id: StudioHarnessId;
  label: string;
  provider: StudioHarnessProvider;
  installed: boolean;
  enabled: boolean;
  authStatus: StudioHarnessAuthStatus;
  authMessage: string;
  supportedActions: StudioRunAction[];
  outputParser: StudioOutputParser;
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

export interface StudioCompatibilitySnapshot {
  schemaVersion: 1;
  generatedAt: string;
  runtime: "local";
  harnesses: StudioCompatibilityHarness[];
  tools: {
    browser: StudioCompatibilityTool;
    figma: StudioCompatibilityTool;
    computer: StudioCompatibilityTool;
    mcp: StudioCompatibilityTool;
    shell: StudioCompatibilityTool;
  };
  providers: StudioProviderConfig;
}

export interface StudioAgentContext {
  workspaceLabel: string;
  projectRoot: string;
  conversationId?: string;
  turnIndex?: number;
  goal?: string;
  model?: string | null;
  effort?: string | null;
  action: StudioRunAction;
  harness: StudioHarnessId;
  mode: StudioSessionMode;
  chatMode: StudioChatMode;
  permissionMode: StudioPermissionMode;
  codex?: StudioCodexConfig;
  prompt: string;
  memory: {
    counts: Record<ProjectMemoryKind, number>;
    recent: Array<{
      kind: ProjectMemoryKind | string;
      title: string;
      summary: string;
      sourcePath?: string;
    }>;
  };
  figma: {
    enabled: boolean;
    status: string;
    clients: number;
    port: number | null;
  };
  knowledge?: {
    counts: Partial<Record<StudioKnowledgeKind, number>>;
    recent: Array<{
      kind: StudioKnowledgeKind | string;
      title: string;
      summary: string;
      sourcePath: string;
    }>;
  };
  researchDesign?: {
    personas: string[];
    findings: string[];
    risks: string[];
    metrics: string[];
    latestSimulationRunId: string | null;
    suggestedTools: string[];
  };
}

export interface StudioRuntimeInfo {
  host: string;
  port: number;
  url: string;
}

export interface StudioRuntimeMetrics {
  uptimeMs: number;
  indexedSessions: number;
  activeProcesses: number;
  activeStreams: number;
  eventBufferSize: number;
  harnessProbeCacheAgeMs: number;
  enabledHarnesses: number;
  catalogCacheAgeMs: number;
  downloads: {
    total: number;
    active: number;
    queued: number;
  };
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
  harness: StudioHarnessId | string | null;
  action: StudioRunAction | string | null;
  sessionId: string | null;
  eventIds: string[];
  fileRefs: DesignChangelogFileRef[];
  captureWarnings: string[];
}

export interface DesignChangelogCaptureRequest {
  session?: Partial<StudioSession> | null;
  events?: StudioEvent[];
  event?: StudioEvent;
  trace?: StudioDesignSystemTrace | null;
}

export type StudioDesignSystemArtifactReviewState = "unreviewed" | "looks_good" | "needs_work";
export type StudioDesignSystemArtifactSectionKind =
  | "brand"
  | "type"
  | "colors"
  | "spacing"
  | "components"
  | "screens"
  | "accessibility"
  | "drift"
  | "handoff";

export interface StudioDesignSystemArtifactSourceRef {
  id: string;
  label: string;
  sourcePath?: string;
  url?: string;
  line?: number;
  eventIds: string[];
}

export interface StudioDesignSystemArtifactPreview {
  kind: "summary" | "tokens" | "typography" | "buttons" | "brand" | "spacing" | "components";
  items: Array<{
    label: string;
    value: string;
    detail?: string;
  }>;
}

export interface StudioDesignSystemResolvedAsset {
  id: string;
  kind: "brand" | "logo" | "image" | "icon";
  label: string;
  sourcePath: string;
  previewUrl?: string;
  mimeType?: string;
  sectionId?: string;
}

export interface StudioDesignSystemResolvedToken {
  id: string;
  kind: "color" | "typography" | "spacing" | "radius" | "shadow" | "component";
  name: string;
  value: string;
  sourcePath?: string;
  line?: number;
  sectionId?: string;
}

export interface StudioDesignSystemArtifactSection {
  id: string;
  kind: StudioDesignSystemArtifactSectionKind;
  title: string;
  summary: string;
  content: string;
  reviewState: StudioDesignSystemArtifactReviewState;
  comments: string[];
  sourceRefs: StudioDesignSystemArtifactSourceRef[];
  preview: StudioDesignSystemArtifactPreview;
  eventIds: string[];
}

export type StudioAgenticDesignSystemRoleId =
  | "harness_status"
  | "message_composer"
  | "tool_trace"
  | "artifact_review"
  | "memory_context"
  | "permission_control";
export type StudioAgenticAtomicLevel = "atom" | "molecule" | "organism" | "template" | "page";
export type StudioAgenticSurface = "topbar" | "composer" | "output" | "canvas" | "drawer";

export interface StudioAgenticDesignSystemRole {
  id: StudioAgenticDesignSystemRoleId;
  label: string;
  atomicLevel: StudioAgenticAtomicLevel;
  surface: StudioAgenticSurface;
  purpose: string;
  requiredSignals: string[];
  commandIds: string[];
  fallbackState: string;
}

export interface StudioAgenticOpenSourceReference {
  name: string;
  url: string;
  license: string;
  category: string;
  mappedRoles: StudioAgenticDesignSystemRoleId[];
}

export interface StudioAgenticInteractionPattern {
  id: string;
  label: string;
  source: string;
  appliesTo: StudioAgenticDesignSystemRoleId[];
  requiredSignals: string[];
}

export interface StudioAgenticDesignSystemContract {
  contractVersion: 1;
  source: {
    name: string;
    url: string;
    figmaPreviewUrl: string;
    access: "public-preview";
    downloaded: false;
  };
  roles: StudioAgenticDesignSystemRole[];
  outputSections: string[];
  agentRules: string[];
  openSourceReferences?: StudioAgenticOpenSourceReference[];
  interactionPatterns?: StudioAgenticInteractionPattern[];
}

export interface StudioDesignSystemArtifact {
  schemaVersion: 1;
  id: string;
  title: string;
  status: "draft" | "review" | "published";
  sourceWorkspace: string | null;
  createdByHarness: string;
  sourceSessionId: string | null;
  sourceEventIds: string[];
  sourceRefs: StudioDesignSystemArtifactSourceRef[];
  sections: StudioDesignSystemArtifactSection[];
  agentic?: StudioAgenticDesignSystemContract;
  assets?: StudioDesignSystemResolvedAsset[];
  tokens?: StudioDesignSystemResolvedToken[];
  resolvedAt?: string | null;
  resolverDiagnostics?: string[];
  rawContent: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudioDesignSystemArtifactCaptureRequest {
  artifact?: StudioDesignSystemArtifact;
  session?: Partial<StudioSession> | null;
  events?: StudioEvent[];
  event?: StudioEvent;
}

export interface StudioDesignSystemArtifactReviewPatch {
  reviewState: StudioDesignSystemArtifactReviewState;
  comment?: string | null;
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
  eventType?: StudioEventType;
}

export interface StudioKnowledgeIndex {
  schemaVersion: 1;
  projectRoot: string;
  generatedAt: string;
  counts: Record<StudioKnowledgeKind, number>;
  items: StudioKnowledgeItem[];
}

export interface StudioKnowledgeCaptureRequest {
  event: StudioEvent;
  session?: {
    harness?: StudioHarnessId;
    action?: StudioRunAction;
  } | null;
  item?: Partial<StudioKnowledgeItem>;
}

export type StudioMarketplaceNoteSource =
  | "built-in-note"
  | "legacy-skill"
  | "workspace-skill"
  | "installed-note"
  | "remote-catalog"
  | "community-catalog"
  | "local-fork";

export interface StudioMarketplaceNote {
  id: string;
  name: string;
  title: string;
  category: string;
  description: string;
  source: StudioMarketplaceNoteSource;
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

export interface StudioNoteForkSummary {
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

export interface StudioNoteForkFile {
  path: string;
  content: string;
  size: number;
  updatedAt: string;
}

export interface StudioNoteForkValidation {
  ok: boolean;
  noteName: string | null;
  notePath: string;
  issues: Array<{ level: "error" | "warning"; message: string; path?: string }>;
  warnings: Array<{ level: "error" | "warning"; message: string; path?: string }>;
}

export interface StudioNoteForkDiff {
  forkName: string;
  files: Array<{
    path: string;
    status: "added" | "modified" | "removed" | "unchanged";
    original: string | null;
    modified: string | null;
  }>;
}

export interface StudioNoteForkPrHandoff {
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

export interface StudioMarketplaceNotesPayload {
  notes: StudioMarketplaceNote[];
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

export interface StudioFigmaClientStatus {
  id: string;
  file: string;
  fileKey?: string;
  editor: string;
  connectedAt: string;
  lastPing?: string;
}

export interface StudioFigmaStatus {
  running: boolean;
  port: number | null;
  bridgeStatus: "stopped" | "running";
  pluginStatus: "disconnected" | "connected";
  clients: StudioFigmaClientStatus[];
  connectionState: "connected" | "reconnecting" | "disconnected";
  reconnectAttempts: number;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
}

export interface StudioFigmaActionRequest {
  action: StudioFigmaAction;
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
  format?: "PNG" | "SVG";
  scale?: number;
  tokens?: { name: string; values: Record<string, string | number> }[];
  createMissing?: boolean;
  collectionName?: string;
}

export interface StudioFigmaActionResult {
  action: StudioFigmaAction;
  status: "completed";
  completedAt: string;
  result: unknown;
  artifactPath: string | null;
}

export interface StudioFigmaOpenRequest {
  fileKey?: string | null;
}

export interface StudioFigmaOpenResult {
  status: "opened";
  target: string;
  openedAt: string;
}

export interface StudioVideoManifest {
  schemaVersion: 1;
  id: string;
  title: string;
  prompt: string;
  adapter: StudioVideoAdapterId;
  status: "created" | "preview-ready" | "render-ready" | "rendered" | "missing-adapter";
  createdAt: string;
  updatedAt: string;
  files: string[];
}
