import { type FormEvent, type ReactNode, useState } from "react";
import {
  type FigmaAction,
  type FigmaActionRequest,
  type FigmaActionResult,
  type FigmaStatus,
  type Harness,
  type MarketplaceNotesPayload,
  type NoteForkDiff,
  type NoteForkFile,
  type NoteForkPrHandoff,
  type NoteForkSummary,
  type NoteForkValidation,
  type ProjectMemoryItem,
  type SessionSummary,
  type StudioAction,
  type StudioAutomationDefinition,
  type StudioAutomationMutationPolicy,
  type StudioAutomationRun,
  type StudioAutomationSchedulerStatus,
  type StudioAutomationTemplate,
  type StudioCompatibilitySnapshot,
  type StudioConfig,
  type StudioBrowserStatus,
  type StudioComputerStatus,
  type StudioDesignSystemTrace,
  type StudioDownloadJob,
  type DesignChangelogCreateInput,
  type DesignChangelogEntry,
  type DesignChangelogPatchInput,
  type DesignSystemArtifact,
  type DesignSystemArtifactReviewState,
  type DesignSystemArtifactSection,
  type StudioEvent,
  type StudioInputMode,
  type StudioAttachment,
  type StudioActiveProcess,
  type StudioActivityItem,
  type StudioCodexApprovalPolicy,
  type StudioCodexConfig,
  type StudioCodexReasoningEffort,
  type StudioKnowledgeItem,
  type StudioPermissionMode,
  type StudioReferenceTraceItem,
  type StudioStatus,
  type StudioToolDefinition,
} from "./studio-api";
import { type StudioTraceModel, type StudioTraceTask } from "../../../src/studio/view-model";
import { WorkbenchPanel } from "./studio-primitives";

export const OUTPUT_TABS = [
  { id: "screens", label: "Screens" },
  { id: "components", label: "Components" },
  { id: "tokens", label: "Tokens" },
  { id: "specs", label: "Specs" },
  { id: "audit", label: "Audit" },
  { id: "references", label: "References" },
  { id: "handoff", label: "Handoff" },
] as const;

export type OutputTabId = (typeof OUTPUT_TABS)[number]["id"];
export type TerminalBlockKind =
  | "run_context"
  | "command_trace"
  | "stdout_group"
  | "stderr_group"
  | "session_result"
  | "artifact_group"
  | "agentic_group"
  | "lifecycle";

export interface TerminalBlock {
  id: string;
  kind: TerminalBlockKind;
  title: string;
  meta: string;
  timestamp: string | null;
  messages: string[];
  data?: unknown;
  events: StudioEvent[];
}

export const ARTIFACT_EVENT_TYPES = new Set([
  "artifact",
  "design_system_artifact",
  "file_change",
  "screenshot",
  "design_artifact",
  "design_preview",
  "preview_ready",
  "figma_candidate",
  "spec_reference",
  "handoff_bundle",
  "marketplace_download",
  "token_usage",
  "video_project_created",
  "video_render_started",
  "video_render_completed",
  "video_render_failed",
]);

const AGENTIC_EVENT_TYPES = new Set([
  "reasoning",
  "tool_call",
  "approval_request",
  "auth_state",
  "auth_status",
  "harness_log",
  "package_log",
  "terminal_command",
  "terminal_output",
  "research_capture",
  "research_code",
  "research_theme",
  "research_metric",
  "research_note",
  "design_decision",
]);

const FIGMA_ACTIONS: Array<{ id: FigmaAction; label: string; primary?: boolean }> = [
  { id: "fullSync", label: "Full sync", primary: true },
  { id: "inspectSelection", label: "Inspect" },
  { id: "pullTokens", label: "Pull tokens" },
  { id: "pullComponents", label: "Pull components" },
  { id: "pullStickies", label: "Pull stickies" },
  { id: "captureScreenshot", label: "Screenshot" },
];

const FIGMA_MUTATING_ACTIONS: Array<{ label: string; request: FigmaActionRequest }> = [
  {
    label: "Create scratch frame",
    request: {
      action: "createNode",
      type: "FRAME",
      name: "Mémoire E2E Scratch Frame",
      x: 120,
      y: 120,
      width: 320,
      height: 180,
    },
  },
  {
    label: "Push scratch token",
    request: {
      action: "pushTokens",
      createMissing: true,
      collectionName: "Mémoire E2E Scratch",
      tokens: [{ name: "memoire/e2e/color", values: { value: "#ff0066" } }],
    },
  },
];

const CORE_HARNESS_IDS: Harness["id"][] = ["claude-code", "codex", "hermes"];
const DEFAULT_CODEX_UI_CONFIG: StudioCodexConfig = {
  model: "gpt-5.5",
  reasoningEffort: "xhigh",
  approvalPolicy: "never",
  webSearch: true,
  skipGitRepoCheck: true,
  includeMemoireCommands: true,
  includeCodexCommands: true,
  planModeDefault: false,
};
const CODEX_MODEL_OPTIONS = ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex"] as const;
const CODEX_REASONING_OPTIONS: Array<{ id: StudioCodexReasoningEffort; label: string }> = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "xhigh", label: "Extra High" },
];
const CODEX_APPROVAL_OPTIONS: Array<{ id: StudioCodexApprovalPolicy; label: string }> = [
  { id: "never", label: "Never" },
  { id: "on-request", label: "On request" },
  { id: "untrusted", label: "Untrusted only" },
];
const AUTOMATION_TEMPLATE_ORDER = [
  "design-system-audit",
  "figma-token-component-pull",
  "codex-app-build-review",
  "research-reference-refresh",
];
const FALLBACK_AGENTIC_ROLES: NonNullable<DesignSystemArtifact["agentic"]>["roles"] = [
  { id: "harness_status", label: "Harness Status", atomicLevel: "molecule", surface: "topbar", purpose: "Expose active agent state.", requiredSignals: ["harness_id", "auth_state"], commandIds: ["settings.open"], fallbackState: "Show blocked reason." },
  { id: "message_composer", label: "Message Composer", atomicLevel: "organism", surface: "composer", purpose: "Capture prompt, attachments, action, and permission.", requiredSignals: ["prompt", "permission_mode"], commandIds: ["session.run"], fallbackState: "Show disabled reason." },
  { id: "tool_trace", label: "Tool Trace", atomicLevel: "organism", surface: "output", purpose: "Render commands and tool calls.", requiredSignals: ["tool_id", "exit_state"], commandIds: ["tool.open"], fallbackState: "Show last output." },
  { id: "artifact_review", label: "Artifact Review", atomicLevel: "organism", surface: "canvas", purpose: "Review generated design-system evidence.", requiredSignals: ["review_state", "source_refs"], commandIds: ["artifact.use-system"], fallbackState: "Show source refs." },
  { id: "memory_context", label: "Memory Context", atomicLevel: "organism", surface: "drawer", purpose: "Expose memory and references.", requiredSignals: ["memory_kind", "source_path"], commandIds: ["context.open"], fallbackState: "Show refresh action." },
  { id: "permission_control", label: "Permission Control", atomicLevel: "molecule", surface: "composer", purpose: "Make plan, guarded, and full-access explicit.", requiredSignals: ["permission_mode"], commandIds: ["codex.plan-mode.toggle"], fallbackState: "Show current sandbox." },
];
const FALLBACK_AGENTIC_OUTPUT_SECTIONS = ["research_note", "design_decision", "tool_call", "artifact", "acceptance_statement", "session_result"];
type AgenticOpenSourceReferences = NonNullable<NonNullable<DesignSystemArtifact["agentic"]>["openSourceReferences"]>;
type AgenticInteractionPatterns = NonNullable<NonNullable<DesignSystemArtifact["agentic"]>["interactionPatterns"]>;
const FALLBACK_AGENTIC_OPEN_SOURCE_REFERENCES: AgenticOpenSourceReferences = [
  { name: "GAIA UI", url: "https://github.com/theexperiencecompany/gaia-ui", license: "MIT", category: "shadcn-agent-components", mappedRoles: ["message_composer", "artifact_review", "memory_context"] },
  { name: "assistant-ui", url: "https://github.com/assistant-ui/assistant-ui", license: "MIT", category: "composer-thread-ux", mappedRoles: ["message_composer", "memory_context", "permission_control"] },
  { name: "tool-ui", url: "https://github.com/assistant-ui/tool-ui", license: "MIT", category: "tool-call-rendering", mappedRoles: ["tool_trace", "permission_control"] },
  { name: "AG-UI", url: "https://github.com/ag-ui-protocol/ag-ui", license: "MIT", category: "agent-event-protocol", mappedRoles: ["harness_status", "tool_trace", "permission_control"] },
  { name: "OpenGenerativeUI", url: "https://github.com/CopilotKit/OpenGenerativeUI", license: "MIT", category: "generative-ui-harness", mappedRoles: ["artifact_review", "tool_trace", "memory_context"] },
  { name: "Magentic-UI", url: "https://github.com/microsoft/magentic-ui", license: "MIT", category: "human-in-the-loop-research", mappedRoles: ["harness_status", "permission_control", "memory_context"] },
];
const FALLBACK_AGENTIC_INTERACTION_PATTERNS: AgenticInteractionPatterns = [
  { id: "composer_agent_state", label: "Composer Agent State", source: "assistant-ui", appliesTo: ["message_composer", "permission_control"], requiredSignals: ["prompt", "attachments", "model", "reasoning_effort", "permission_mode"] },
  { id: "auditable_tool_trace_cards", label: "Auditable Tool Trace Cards", source: "tool-ui", appliesTo: ["tool_trace"], requiredSignals: ["tool_id", "status", "input", "output", "approval_state"] },
  { id: "event_stream_state_sync", label: "Event Stream State Sync", source: "AG-UI", appliesTo: ["harness_status", "tool_trace"], requiredSignals: ["event_type", "run_state", "tool_status", "shared_context"] },
  { id: "artifact_acceptance_state", label: "Artifact Acceptance State", source: "OpenGenerativeUI", appliesTo: ["artifact_review", "memory_context"], requiredSignals: ["source_refs", "review_state", "acceptance_statement", "design_decision"] },
  { id: "human_review_checkpoint", label: "Human Review Checkpoint", source: "Magentic-UI", appliesTo: ["artifact_review", "permission_control"], requiredSignals: ["plan_state", "approval_state", "risk_level", "next_action"] },
];

function isCoreHarness(id: Harness["id"]): boolean {
  return CORE_HARNESS_IDS.includes(id);
}

export function AttachmentShelf(props: {
  attachments: StudioAttachment[];
  onRemove?: (id: string) => void;
}) {
  if (props.attachments.length === 0) return null;
  return (
    <div className="attachment-shelf" data-attachment-shelf="composer-materials">
      {props.attachments.map((attachment) => (
        <article className="attachment-chip" data-attachment-chip={attachment.kind} key={attachment.id}>
          {attachment.kind === "image" && attachment.previewUrl ? <img alt="" src={attachment.previewUrl} /> : <span>{attachment.kind}</span>}
          <div>
            <strong>{attachment.name}</strong>
            <small>{formatAttachmentSize(attachment.size)} / {attachment.source}</small>
          </div>
          {props.onRemove ? <button type="button" onClick={() => props.onRemove?.(attachment.id)}>Remove</button> : null}
        </article>
      ))}
    </div>
  );
}

function formatAttachmentSize(size: number): string {
  if (size > 1_000_000) return `${(size / 1_000_000).toFixed(1)} MB`;
  if (size > 1_000) return `${Math.ceil(size / 1_000)} KB`;
  return `${size} B`;
}

export function ChatQualityLayer(props: {
  action: StudioAction;
  artifacts: DesignSystemArtifact[];
  designTrace: StudioDesignSystemTrace | null;
  events: StudioEvent[];
  lastFailure: StudioEvent | null;
  memoryPins: string[];
  searchQuery: string;
  session: SessionSummary | null;
  sessionStatus: string;
  terminalBlocks: TerminalBlock[];
  traceModel: StudioTraceModel;
  onBranch: () => void;
  onCopyVerification: () => void;
  onFollowUp: (prompt: string) => void;
  onPinMemory: () => void;
  onSearchChange: (query: string) => void;
}) {
  const followUps = deriveChatFollowUps(props);
  const verification = deriveVerificationSignals(props);
  const approvalRequests = props.events.filter((event) => event.type === "approval_request");
  const activeTasks = props.traceModel.tasks.filter((task) => task.status === "running").slice(0, 4);
  const nextTask = props.traceModel.tasks.find((task) => task.status !== "completed");
  const latestArtifact = props.artifacts[0] ?? null;
  return (
    <section className="chat-quality-layer" data-chat-qol="codex-antigravity" aria-label="Chat quality controls">
      <section className="chat-live-plan" data-chat-live-plan="current-run">
        <div>
          <span>Plan</span>
          <strong>{props.session ? trimText(props.session.prompt, 72) : "Draft prompt"}</strong>
        </div>
        <div>
          <span>Now</span>
          <strong>{props.sessionStatus}</strong>
        </div>
        <div>
          <span>Next</span>
          <strong>{nextTask?.label ?? props.action}</strong>
        </div>
        <button data-action-id="chat.branch-current" type="button" onClick={props.onBranch}>Branch</button>
      </section>
      <div className="chat-qol-grid">
        <label className="chat-search-row" data-chat-search="conversation">
          <span>Search</span>
          <input value={props.searchQuery} onChange={(event) => props.onSearchChange(event.target.value)} placeholder="Find output, files, errors" />
        </label>
        <section className="chat-follow-up-row" data-follow-up-chips="contextual">
          {followUps.map((followUp) => (
            <button data-action-id={`chat.follow-up.${followUp.id}`} key={followUp.id} type="button" onClick={() => props.onFollowUp(followUp.prompt)}>
              {followUp.label}
            </button>
          ))}
        </section>
        <section className="chat-memory-pins" data-memory-pins="session">
          <div>
            <span>Pins</span>
            <button data-action-id="chat.pin-memory" type="button" onClick={props.onPinMemory}>Pin</button>
          </div>
          <p>{props.memoryPins.length ? props.memoryPins.slice(0, 2).join(" / ") : "No pinned decisions"}</p>
        </section>
        <section className="chat-artifact-shelf" data-artifact-shelf="chat-evidence">
          <span>Artifacts</span>
          <strong>{latestArtifact?.title ?? "No artifacts yet"}</strong>
          <small>{props.artifacts.length} evidence items</small>
        </section>
        <section className="chat-verification-receipt" data-verification-receipt="run">
          <span>Receipt</span>
          <strong>{verification.status}</strong>
          <small>{verification.summary}</small>
          <button data-action-id="chat.copy-verification" type="button" onClick={props.onCopyVerification}>Copy</button>
        </section>
        <section className="chat-approval-queue" data-approval-queue="inline">
          <span>Approvals</span>
          <strong>{approvalRequests.length ? `${approvalRequests.length} pending` : "Clear"}</strong>
        </section>
        <section className="chat-agent-lanes" data-parallel-agent-lanes="mini">
          {(activeTasks.length ? activeTasks : props.traceModel.tasks.slice(0, 3)).map((task) => (
            <span data-task-status={task.status} key={task.id}>{task.label}</span>
          ))}
          {props.traceModel.tasks.length === 0 ? <span data-task-status="idle">No lanes</span> : null}
        </section>
      </div>
    </section>
  );
}

function deriveChatFollowUps(props: {
  designTrace: StudioDesignSystemTrace | null;
  lastFailure: StudioEvent | null;
  sessionStatus: string;
  terminalBlocks: TerminalBlock[];
}): Array<{ id: string; label: string; prompt: string }> {
  if (props.lastFailure) return [{ id: "fix-failure", label: "Fix failure", prompt: `Fix this failure:\n${props.lastFailure.message}` }];
  if (props.designTrace?.files.length) return [
    { id: "review-diff", label: "Review diff", prompt: "Review the changed files and summarize risk, tests, and cleanup." },
    { id: "changelog", label: "Changelog", prompt: "Capture the design-related changes in the local design changelog." },
  ];
  if (props.sessionStatus === "completed") return [{ id: "next-step", label: "Next step", prompt: "Continue from the verification receipt and handle the next highest-value improvement." }];
  if (props.terminalBlocks.length) return [{ id: "explain", label: "Explain", prompt: "Explain the latest output and identify the next action." }];
  return [{ id: "sharpen", label: "Sharpen", prompt: "Turn this prompt into a precise implementation task with acceptance criteria." }];
}

function deriveVerificationSignals(props: {
  artifacts: DesignSystemArtifact[];
  designTrace: StudioDesignSystemTrace | null;
  events: StudioEvent[];
  lastFailure: StudioEvent | null;
  sessionStatus: string;
}): { status: string; summary: string } {
  if (props.lastFailure) return { status: "Needs attention", summary: trimText(props.lastFailure.message, 96) };
  const files = props.designTrace?.files.length ?? 0;
  const evidence = props.artifacts.length + props.events.filter((event) => ["session_done", "artifact", "design_system_artifact", "browser_snapshot", "screenshot"].includes(event.type)).length;
  if (props.sessionStatus === "completed") return { status: "Verified", summary: `${files} files / ${evidence} evidence` };
  if (props.sessionStatus === "running") return { status: "Collecting", summary: `${files} files / ${evidence} evidence` };
  return { status: "Ready", summary: `${files} files / ${evidence} evidence` };
}

export function filterTerminalBlocksByQuery(blocks: TerminalBlock[], query: string): TerminalBlock[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return blocks;
  return blocks.filter((block) => `${block.title} ${block.meta} ${block.messages.join(" ")}`.toLowerCase().includes(normalized));
}

export function MemoireLogoMark() {
  return (
    <svg className="memoire-logo-mark" viewBox="0 0 512 512" width="24" height="24" aria-hidden="true">
      <defs>
        <path
          id="memoire-studio-petal"
          d="M256 220C236 194 196 176 181 139C167 104 184 72 217 67C237 64 250 75 256 88C262 75 275 64 295 67C328 72 345 104 331 139C316 176 276 194 256 220Z"
        />
        <mask id="memoire-studio-flower-mask" maskUnits="userSpaceOnUse">
          <rect width="512" height="512" fill="var(--svg-mask-off)" />
          <use href="#memoire-studio-petal" fill="var(--svg-mask-on)" />
          <use href="#memoire-studio-petal" fill="var(--svg-mask-on)" transform="rotate(90 256 256)" />
          <use href="#memoire-studio-petal" fill="var(--svg-mask-on)" transform="rotate(180 256 256)" />
          <use href="#memoire-studio-petal" fill="var(--svg-mask-on)" transform="rotate(270 256 256)" />
          <path d="M256 204C264 232 280 248 308 256C280 264 264 280 256 308C248 280 232 264 204 256C232 248 248 232 256 204Z" fill="var(--svg-mask-off)" />
          <g fill="var(--svg-mask-off)">
            <path d="M256 126C243 154 244 188 256 220C268 188 269 154 256 126Z" />
            <circle cx="256" cy="145" r="15" />
            <path d="M256 126C243 154 244 188 256 220C268 188 269 154 256 126Z" transform="rotate(90 256 256)" />
            <circle cx="367" cy="256" r="15" />
            <path d="M256 126C243 154 244 188 256 220C268 188 269 154 256 126Z" transform="rotate(180 256 256)" />
            <circle cx="256" cy="367" r="15" />
            <path d="M256 126C243 154 244 188 256 220C268 188 269 154 256 126Z" transform="rotate(270 256 256)" />
            <circle cx="145" cy="256" r="15" />
          </g>
        </mask>
      </defs>
      <rect width="512" height="512" fill="currentColor" mask="url(#memoire-studio-flower-mask)" />
    </svg>
  );
}

export function FigmaLogoMark() {
  return (
    <svg className="figma-logo-mark" data-figma-logo viewBox="0 0 38 56" width="18" height="24" aria-hidden="true">
      <circle className="figma-logo-red" cx="14" cy="10" r="8" />
      <circle className="figma-logo-coral" cx="24" cy="10" r="8" />
      <circle className="figma-logo-purple" cx="14" cy="28" r="8" />
      <circle className="figma-logo-blue" cx="24" cy="28" r="8" />
      <circle className="figma-logo-green" cx="14" cy="46" r="8" />
    </svg>
  );
}

export function MemoryTable(props: {
  title: string;
  items: ProjectMemoryItem[];
  empty: string;
  compact?: boolean;
  expandable?: boolean;
  onOpen?: (item: ProjectMemoryItem) => void;
}) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const expandable = props.expandable ?? true;

  function toggleRow(id: string) {
    if (!expandable) return;
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (props.compact) {
    return (
      <div className="memory-context-list compact-context" data-compact-memory-list role="list" aria-label={props.title}>
        {props.items.length === 0 ? <p className="empty">{props.empty}</p> : null}
        {props.items.map((item) => (
          <article
            className="memory-context-item"
            data-action-id={`context.open.${item.id}`}
            key={item.id}
            onClick={() => props.onOpen?.(item)}
            role="listitem"
            title={[item.title, item.status].filter(Boolean).join(" · ")}
          >
            <span className="memory-title">
              <strong>{item.title}</strong>
            </span>
            <span className="memory-status">{item.status}</span>
          </article>
        ))}
      </div>
    );
  }

  return (
    <WorkbenchPanel className="memory-table-panel" eyebrow="Memory" title={props.title} meta={String(props.items.length)}>
      <div className="memory-table" role="table">
        <div className="memory-row head" role="row">
          <span>Title</span>
          <span>Status</span>
          <span>Source</span>
          <span>Tags</span>
        </div>
        {props.items.length === 0 ? <p className="empty">{props.empty}</p> : null}
        {props.items.map((item) => {
          const expanded = expandedRows.has(item.id);
          return (
            <article
              className={expanded ? "memory-row expanded" : "memory-row"}
              key={item.id}
              onClick={() => toggleRow(item.id)}
              role="row"
              tabIndex={expandable ? 0 : undefined}
            >
              <span className="memory-title">
                <strong>{item.title}</strong>
                <small>{trimText(item.summary, 140)}</small>
              </span>
              <span className="memory-status">{item.status}</span>
              <span className="memory-source" title={item.sourcePath}>{displaySourceLabel(item.sourcePath)}</span>
              <span className="tag-list" title={item.tags.join(", ")}>
                {item.tags.slice(0, 4).map((tag) => <em key={tag}>{tag}</em>)}
                {item.tags.length === 0 ? <em>--</em> : null}
              </span>
              {expanded ? (
                <div className="memory-row-detail">
                  <span>{item.summary || item.title}</span>
                  <small>{item.sourcePath}</small>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </WorkbenchPanel>
  );
}

export function TracePanel({ trace }: { trace: StudioTraceModel }) {
  return (
    <section className="phase-tracker" data-phase-tracker="agent-trace" aria-label="Agent trace">
      {trace.phases.map((phase) => (
        <article className={`phase-card ${phase.status}`} data-source-event-id={phase.evidenceIds.at(-1) ?? ""} key={phase.id}>
          <span className="trace-dot" aria-hidden="true" />
          <strong>{phase.label}</strong>
          <small>{phase.status}</small>
        </article>
      ))}
    </section>
  );
}

export function OutputTabs(props: {
  activeTab: OutputTabId;
  artifactEvents: StudioEvent[];
  items: ProjectMemoryItem[];
  latestResult: StudioEvent | null;
  onChange: (tab: OutputTabId) => void;
}) {
  const outputItems = deriveOutputItems(props.activeTab, props.items, props.artifactEvents, props.latestResult);
  return (
    <section className="artifact-workbench" data-output-tabs="run-artifacts" aria-label="Run outputs">
      <nav className="artifact-tabs" aria-label="Output tabs">
        {OUTPUT_TABS.map((tab) => (
          <button
            aria-pressed={props.activeTab === tab.id}
            className={props.activeTab === tab.id ? "active" : ""}
            data-action-id={`output.tab.${tab.id}`}
            key={tab.id}
            onClick={() => props.onChange(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="artifact-grid">
        {outputItems.length === 0 ? <p className="empty">No {props.activeTab} output yet.</p> : null}
        {outputItems.slice(0, 6).map((item) => (
          <article className="artifact-card" key={item.id}>
            <span>{item.meta}</span>
            <strong>{item.title}</strong>
            <p>{trimText(item.summary, 90)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ContextRail(props: {
  contextItemDetail: ProjectMemoryItem | null;
  contextFilter: string;
  contextItems: ProjectMemoryItem[];
  contextQuery: string;
  events: StudioEvent[];
  knowledgeFilter: string;
  knowledgeItemDetail: StudioKnowledgeItem | null;
  knowledgeItems: StudioKnowledgeItem[];
  knowledgeQuery: string;
  memoryItems: ProjectMemoryItem[];
  selectedContextItem: ProjectMemoryItem | null;
  selectedKnowledgeItem: StudioKnowledgeItem | null;
  session: SessionSummary | null;
  traceModel: StudioTraceModel;
  onFilterChange: (filter: string) => void;
  onKnowledgeFilterChange: (filter: string) => void;
  onKnowledgeQueryChange: (query: string) => void;
  onOpenKnowledgeItem: (item: StudioKnowledgeItem) => void;
  onOpenItem: (item: ProjectMemoryItem) => void;
  onQueryChange: (query: string) => void;
  onRefreshKnowledge: () => void;
  onRefreshMemory: () => void;
}) {
  const filters = memoryFilterCounts(props.memoryItems);
  const detailItem = props.contextItemDetail ?? props.selectedContextItem;
  return (
    <>
      <WorkbenchPanel className="context-search-panel" eyebrow="Memory" title="Memory / Context" meta={String(props.contextItems.length)}>
        <div className="context-search-row">
          <input
            aria-label="Search memory context"
            placeholder="Search memory..."
            value={props.contextQuery}
            onChange={(event) => props.onQueryChange(event.target.value)}
          />
          <button data-action-id="memory.refresh" type="button" onClick={props.onRefreshMemory}>Sync</button>
        </div>
        <div className="context-filter-row">
          {filters.map((filter) => (
            <button
              aria-pressed={props.contextFilter === filter.id}
              className={props.contextFilter === filter.id ? "active" : ""}
              data-action-id={`context.filter.${filter.id}`}
              key={filter.id}
              onClick={() => props.onFilterChange(filter.id)}
              type="button"
            >
              {filter.label} <span>{filter.count}</span>
            </button>
          ))}
        </div>
        <MemoryTable compact title="Memory / Context" items={props.contextItems} empty="No context indexed." onOpen={props.onOpenItem} />
        {detailItem ? (
          <article className="context-detail" data-context-detail>
            <span>{props.contextItemDetail ? "Loaded" : "Opening"}</span>
            <strong>{detailItem.title}</strong>
            <p>{trimText(detailItem.summary || detailItem.sourcePath, 180)}</p>
            <small title={detailItem.sourcePath}>{displaySourceLabel(detailItem.sourcePath)}</small>
          </article>
        ) : null}
      </WorkbenchPanel>
      <KnowledgeReader
        filter={props.knowledgeFilter}
        itemDetail={props.knowledgeItemDetail}
        items={props.knowledgeItems}
        query={props.knowledgeQuery}
        selectedItem={props.selectedKnowledgeItem}
        onFilterChange={props.onKnowledgeFilterChange}
        onOpenItem={props.onOpenKnowledgeItem}
        onQueryChange={props.onKnowledgeQueryChange}
        onRefresh={props.onRefreshKnowledge}
      />
      <ReferenceTracePanel references={props.traceModel.references} />
      <WorkbenchPanel
        className="agent-task-panel"
        eyebrow="Trace"
        title="Agent Tasks"
        meta={props.session ? `${props.session.status} / ${props.events.length}` : String(props.traceModel.tasks.length)}
      >
        <div className="agent-task-list" data-agent-tasks="trace-tasks">
          {props.traceModel.tasks.length === 0 ? <p className="empty">No active trace.</p> : null}
          {props.traceModel.tasks.map((task) => (
            <TraceTaskRow key={task.id} task={task} />
          ))}
        </div>
      </WorkbenchPanel>
      <AgentLogsPanel events={props.events} session={props.session} />
    </>
  );
}

function LegacyActivityTimeline(props: {
  activities: StudioTraceModel["activities"];
  activeProcesses: StudioTraceModel["activeProcesses"];
  onCopyPath?: (path: string) => void;
}) {
  const activities = props.activities.slice(-8);
  return (
    <WorkbenchPanel className="activity-timeline" eyebrow="Activity" title="Agent Activity" meta={String(activities.length)}>
      <div data-agent-activity="timeline">
        {activities.length === 0 ? <p className="empty">No activity yet.</p> : null}
        {activities.map((activity) => (
          <article className="activity-row" data-activity-kind={activity.kind} key={activity.id}>
            <span>{activityLabel(activity.kind, activity.status)}</span>
            <div>
              <strong>{activity.label}</strong>
              <small>{activity.summary}</small>
            </div>
            {activity.targetPath ? <button type="button" onClick={() => props.onCopyPath?.(activity.targetPath ?? "")}>Copy path</button> : <em>{activity.status}</em>}
          </article>
        ))}
      </div>
      <div className="running-terminals-strip" data-running-terminals="active-processes">
        {props.activeProcesses.map((process) => (
          <article key={process.id}>
            <strong>Running</strong>
            <span>{trimText(process.command, 96)}</span>
            <small>{process.outputPreview || "waiting for output"}</small>
          </article>
        ))}
      </div>
    </WorkbenchPanel>
  );
}

export function ReferenceTracePanel({ references }: { references: StudioReferenceTraceItem[] }) {
  const groups = [
    { id: "package", label: "Package" },
    { id: "spec", label: "Specs" },
    { id: "knowledge", label: "Knowledge" },
    { id: "figma", label: "Figma" },
    { id: "file", label: "Files" },
    { id: "artifact", label: "Artifacts" },
    { id: "model", label: "Model" },
  ] as const;

  return (
    <WorkbenchPanel
      className="reference-trace-panel"
      data-reference-trace="package-sources"
      eyebrow="References"
      title="Package Sources"
      meta={String(references.length)}
    >
      {references.length === 0 ? <p className="empty">No reference trace yet.</p> : null}
      {groups.map((group) => {
        const groupItems = references.filter((item) => item.kind === group.id);
        if (groupItems.length === 0) return null;
        return (
          <section className="reference-group" data-reference-kind={group.id} key={group.id}>
            <div className="drawer-section-head">
              <span>{group.label}</span>
              <small>{groupItems.length}</small>
            </div>
            <div className="reference-list">
              {groupItems.map((item) => (
                <article className="reference-row" key={item.id}>
                  <strong>{item.label}</strong>
                  <p>{trimText(item.summary || item.sourcePath || item.url || item.packageName || "", 140)}</p>
                  <small title={item.sourcePath ?? item.url ?? item.packageName ?? ""}>
                    {item.packageName ? `${item.packageName}${item.packageVersion ? `@${item.packageVersion}` : ""}` : item.sourcePath ?? item.url ?? `${item.eventIds.length} events`}
                  </small>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </WorkbenchPanel>
  );
}

function activityLabel(kind: StudioTraceModel["activities"][number]["kind"], status: string): string {
  if (kind === "reading_file") return "Reading";
  if (kind === "searching") return "Searching";
  if (kind === "running_command") return "Running";
  if (kind === "writing_file") return "Writing";
  if (kind === "thinking") return "Thinking";
  return status === "running" ? "Running" : "Activity";
}

export function AgentLogsPanel({ events, session }: { events: StudioEvent[]; session: SessionSummary | null }) {
  const visibleEvents = events.slice(-18);
  return (
    <WorkbenchPanel className="agent-logs-panel" eyebrow="Logs" title="Agent Logs" meta={session?.harness ?? "idle"}>
      <div className="agent-log-list" data-agent-logs="raw-events">
        {visibleEvents.length === 0 ? <p className="empty">No events.</p> : null}
        {visibleEvents.map((event) => (
          <article className="agent-log-row" data-event-id={event.id} key={event.id}>
            <time dateTime={event.timestamp}>{formatTime(event.timestamp)}</time>
            <strong>{event.type}</strong>
            <span>{session?.harness ?? "--"}</span>
            <p>{trimText(formatLogPayload(event), 140)}</p>
          </article>
        ))}
      </div>
    </WorkbenchPanel>
  );
}

export function ProjectSidebar(props: {
  sessions: SessionSummary[];
  currentSessionId: string | null;
  collapsed: boolean;
  expandedProjectIds: string[];
  onToggleCollapsed: () => void;
  onToggleProject: (projectId: string) => void;
  onOpenSession: (session: SessionSummary) => void;
  onOpenSettings: () => void;
  onNewChat: () => void;
  onOpenCommand: () => void;
  onOpenPlugins: () => void;
  onOpenChangelog: () => void;
  onOpenAutomations: () => void;
  onOpenFigma: () => void | Promise<void>;
}) {
  const projects = groupSessionsByProject(props.sessions);
  const expanded = new Set(props.expandedProjectIds);
  return (
    <aside className="project-sidebar" data-project-sidebar="codex-style" data-sidebar-collapsed={String(props.collapsed)} aria-label="Projects">
      <div className="project-sidebar-main">
        <div className="project-sidebar-top">
          <button data-action-id="sidebar.collapse" type="button" onClick={props.onToggleCollapsed} aria-label={props.collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <SidebarIcon name={props.collapsed ? "panel-open" : "panel-close"} />
            <span>Collapse</span>
          </button>
        </div>
        <nav className="project-sidebar-actions" aria-label="Studio actions">
          <button data-action-id="sidebar.new-chat" type="button" onClick={props.onNewChat} title="New chat">
            <SidebarIcon name="new-chat" />
            <span>New chat</span>
          </button>
          <button data-action-id="command-palette.open.sidebar" type="button" onClick={props.onOpenCommand} title="Search">
            <SidebarIcon name="search" />
            <span>Search</span>
          </button>
          <button data-action-id="plugins.open.sidebar" type="button" onClick={props.onOpenPlugins} title="Plugins">
            <SidebarIcon name="plugins" />
            <span>Plugins</span>
          </button>
          <button data-action-id="changelog.open.sidebar" type="button" onClick={props.onOpenChangelog} title="Changelog">
            <SidebarIcon name="changelog" />
            <span>Changelog</span>
          </button>
          <button data-action-id="figma.open.sidebar" type="button" onClick={() => void props.onOpenFigma()} title="Figma">
            <SidebarIcon name="figma" />
            <span>Figma</span>
          </button>
          <button data-action-id="automations.open.sidebar" type="button" onClick={props.onOpenAutomations} title="Automations">
            <SidebarIcon name="clock" />
            <span>Automations</span>
          </button>
        </nav>
        <div className="project-sidebar-folders" data-project-folder-list="true">
          <div className="project-sidebar-section-label">
            <span>Projects</span>
            <small>{props.sessions.length}</small>
          </div>
          {projects.map((project) => {
            const isExpanded = expanded.has(project.id) || project.sessions.some((session) => session.id === props.currentSessionId);
            return (
              <section className="project-folder" key={project.id} data-project-folder={project.id}>
                <button
                  className="project-folder-row"
                  data-action-id={`project.toggle.${project.id}`}
                  data-project-folder-row="true"
                  data-active={String(project.sessions.some((session) => session.id === props.currentSessionId))}
                  type="button"
                  onClick={() => props.onToggleProject(project.id)}
                  title={project.path}
                >
                  <SidebarIcon name={isExpanded ? "folder-open" : "folder"} />
                  <span>{project.label}</span>
                  <small>{project.sessions.length}</small>
                  <SidebarIcon name={isExpanded ? "chevron-down" : "chevron-right"} />
                </button>
                {isExpanded ? (
                  <div className="project-session-list">
                    {project.sessions.slice(0, 12).map((session) => (
                      <button
                        className={session.id === props.currentSessionId ? "active" : ""}
                        data-action-id={`session.switch.${session.id}`}
                        data-project-session-row="true"
                        key={session.id}
                        type="button"
                        onClick={() => props.onOpenSession(session)}
                        title={session.prompt}
                      >
                        <i className="project-session-status" data-status={session.status} aria-hidden="true" />
                        <span className="project-session-copy">
                          <span>{trimText(session.prompt, 54)}</span>
                          <small>{session.harness} / {session.action ?? "run"} / {session.status}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
          {projects.length === 0 ? <p className="empty">No sessions.</p> : null}
        </div>
      </div>
      <div className="project-sidebar-footer" data-sidebar-settings="bottom-pinned">
        <button data-action-id="settings.open.sidebar" type="button" onClick={props.onOpenSettings} title="Settings">
          <SidebarIcon name="settings" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}

export function groupSessionsByProject(sessions: SessionSummary[]): Array<{ id: string; label: string; path: string; sessions: SessionSummary[] }> {
  const groups = new Map<string, { id: string; label: string; path: string; sessions: SessionSummary[] }>();
  for (const session of sessions) {
    const id = session.cwd || "workspace";
    const existing = groups.get(id);
    if (existing) {
      existing.sessions.push(session);
      continue;
    }
    groups.set(id, {
      id,
      label: displaySourceLabel(id).split("/").filter(Boolean).at(-1) ?? "workspace",
      path: id,
      sessions: [session],
    });
  }
  return Array.from(groups.values());
}

function StudioLineIcon({ children }: { children: ReactNode }) {
  return (
    <svg className="sidebar-icon" data-icon-pack="memoire-line" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export function StudioControlIcon({ name }: { name: "attach" | "mode" | "access" | "plan" | "harness" | "action" | "command" | "details" | "light" | "dark" | "settings" }) {
  const className = "control-icon";
  if (name === "attach") return <svg className={className} data-icon-pack="memoire-line" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14" /></svg>;
  if (name === "mode") return <svg className={className} data-icon-pack="memoire-line" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M7 12h10M10 17h4" /></svg>;
  if (name === "access") return <svg className={className} data-icon-pack="memoire-line" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 11V8a5 5 0 0 1 10 0v3" /><rect x="5" y="11" width="14" height="9" rx="2" /></svg>;
  if (name === "plan") return <svg className={className} data-icon-pack="memoire-line" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 4h9l3 3v13H6V4Z" /><path d="M9 11h6M9 15h4" /></svg>;
  if (name === "harness") return <svg className={className} data-icon-pack="memoire-line" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 4h8l2 4v7a6 6 0 0 1-12 0V8l2-4Z" /><path d="M9 12h6M10 16h4" /></svg>;
  if (name === "command") return <svg className={className} data-icon-pack="memoire-line" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4" y="5" width="16" height="14" rx="3" /><path d="m9 9 3 3-3 3M14 15h2" /></svg>;
  if (name === "details") return <svg className={className} data-icon-pack="memoire-line" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8" /><path d="M12 11v5M12 8h.01" /></svg>;
  if (name === "light") return <svg className={className} data-icon-pack="memoire-line" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" /></svg>;
  if (name === "dark") return <svg className={className} data-icon-pack="memoire-line" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18 15.5A7 7 0 0 1 8.5 6a7.5 7.5 0 1 0 9.5 9.5Z" /></svg>;
  if (name === "settings") return <svg className={className} data-icon-pack="memoire-line" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.7-1L14.5 3h-5l-.3 3a8 8 0 0 0-1.7 1L5.1 6l-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .3 0 .7.1 1l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 1.7 1l.3 3h5l.3-3a8 8 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1Z" /></svg>;
  return <svg className={className} data-icon-pack="memoire-line" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 6h16M4 12h16M4 18h16" /><path d="m15 9 3 3-3 3" /></svg>;
}

function SidebarIcon({ name }: { name: "new-chat" | "search" | "plugins" | "changelog" | "figma" | "clock" | "folder" | "folder-open" | "chevron-right" | "chevron-down" | "settings" | "panel-open" | "panel-close" }) {
  if (name === "new-chat") return <StudioLineIcon><path d="M12 5v14M5 12h14" /></StudioLineIcon>;
  if (name === "search") return <StudioLineIcon><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></StudioLineIcon>;
  if (name === "plugins") return <StudioLineIcon><path d="M8 4h8v5h4v8h-5v3H7v-5H4V7h4V4Z" /></StudioLineIcon>;
  if (name === "changelog") return <StudioLineIcon><path d="M7 4h10v16H7V4Z" /><path d="M10 8h4M10 12h4M10 16h3" /></StudioLineIcon>;
  if (name === "figma") return <StudioLineIcon><circle cx="9" cy="6" r="3" /><circle cx="15" cy="6" r="3" /><circle cx="9" cy="12" r="3" /><circle cx="15" cy="12" r="3" /><circle cx="9" cy="18" r="3" /></StudioLineIcon>;
  if (name === "clock") return <StudioLineIcon><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></StudioLineIcon>;
  if (name === "folder") return <StudioLineIcon><path d="M3 7h7l2 2h9v9H3V7Z" /></StudioLineIcon>;
  if (name === "folder-open") return <StudioLineIcon><path d="M3 8h7l2 2h9l-2 8H3V8Z" /><path d="M3 8v10" /></StudioLineIcon>;
  if (name === "chevron-right") return <StudioLineIcon><path d="m9 6 6 6-6 6" /></StudioLineIcon>;
  if (name === "chevron-down") return <StudioLineIcon><path d="m6 9 6 6 6-6" /></StudioLineIcon>;
  if (name === "settings") return <StudioLineIcon><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.7-1L14.5 3h-5l-.3 3a8 8 0 0 0-1.7 1L5.1 6l-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .3 0 .7.1 1l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 1.7 1l.3 3h5l.3-3a8 8 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1Z" /></StudioLineIcon>;
  if (name === "panel-open") return <StudioLineIcon><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M9 5v14M14 9l3 3-3 3" /></StudioLineIcon>;
  return <StudioLineIcon><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M9 5v14M17 9l-3 3 3 3" /></StudioLineIcon>;
}

export function ChangedFilesPanel(props: {
  trace: StudioDesignSystemTrace | null;
  onReview: () => void;
}) {
  const [showFiles, setShowFiles] = useState(false);
  const files = props.trace?.files ?? [];
  const totalInsertions = props.trace?.insertions ?? 0;
  const totalDeletions = props.trace?.deletions ?? 0;
  const previewFiles = files.slice(0, 6);
  return (
    <section className="inline-changed-files" data-changed-files-panel="inline-review">
      <div className="drawer-section-head">
        <span>{props.trace?.reviewLabel ?? "Changed files"}</span>
        <button data-action-id="changed-files.review" type="button" onClick={props.onReview}>Review</button>
      </div>
      <div className="change-metrics">
        <span>{files.length} files</span>
        <span>+{totalInsertions}</span>
        <span>-{totalDeletions}</span>
      </div>
      <details className="changed-file-disclosure" open={showFiles} onToggle={(event) => setShowFiles(event.currentTarget.open)}>
        <summary>{files.length > 0 ? `Show ${previewFiles.length} changed files` : "No changed files"}</summary>
        {showFiles ? (
          <div className="changed-file-list">
            {previewFiles.map((file) => (
              <details className="changed-file-row" data-file-kind={file.kind} key={file.path}>
                <summary>
                  <span title={file.path}>{displaySourceLabel(file.path)}</span>
                  <small>+{file.insertions} -{file.deletions}</small>
                </summary>
                <p>{file.kind} / {file.status}{file.designSystem ? " / design-system" : ""}</p>
                <button data-action-id={`changed-file.copy.${file.path}`} type="button" onClick={() => void copyText(file.path)}>Copy path</button>
              </details>
            ))}
            {props.trace && files.length === 0 ? <p className="empty">Working tree clean.</p> : null}
            {props.trace?.error ? <p className="error">{props.trace.error}</p> : null}
          </div>
        ) : null}
      </details>
    </section>
  );
}

export function ActivityTimeline(props: {
  activities: StudioActivityItem[];
  activeProcesses: StudioActiveProcess[];
  onCopyPath?: (path: string) => void;
}) {
  const visibleActivities = props.activities.slice(-16);
  if (visibleActivities.length === 0 && props.activeProcesses.length === 0) return null;
  const traceGroups = deriveToolTraceGroups(visibleActivities, props.activeProcesses);
  return (
    <section className="activity-timeline" data-agent-activity="timeline" aria-label="Agent activity">
      <section className="tool-trace-summary" data-tool-trace-summary="intent-groups">
        {traceGroups.map((group) => (
          <span key={group.id}>{group.label} {group.count}</span>
        ))}
      </section>
      {props.activeProcesses.length > 0 ? (
        <details className="running-terminals-strip" data-running-terminals="active-processes" open>
          <summary>
            <span>{`Run ${props.activeProcesses.length}`}</span>
            <small>{trimText(props.activeProcesses[0]?.command ?? "terminal", 52)}</small>
          </summary>
          <div>
            {props.activeProcesses.map((process) => (
              <article className="activity-row running" data-tool-trace-card={process.id} data-activity-kind="terminal_group" key={process.id}>
                <span className="activity-glyph" aria-hidden="true">&gt;</span>
                <div>
                  <strong>Run</strong>
                  <code title={process.command}>{process.command}</code>
                  {process.outputPreview ? <small>{trimText(process.outputPreview, 96)}</small> : null}
                </div>
                <button data-action-id={`activity.copy-command.${process.id}`} type="button" onClick={() => void copyText(process.command)}>
                  Copy
                </button>
              </article>
            ))}
          </div>
        </details>
      ) : null}
      <div className="activity-list">
        {visibleActivities.map((activity) => (
          <article className={`activity-row ${activity.status}`} data-tool-trace-card={activity.id} data-activity-kind={activity.kind} key={activity.id}>
            <span className="activity-glyph" aria-hidden="true">{activityGlyph(activity.kind)}</span>
            <div>
              <strong>{activity.label}</strong>
              <small title={activity.targetPath ?? activity.command ?? activity.summary}>{activityMeta(activity)}</small>
              {activity.outputPreview ? (
                <details className="activity-output">
                  <summary>{trimText(activity.outputPreview, 96)}</summary>
                  <pre>{activity.outputPreview}</pre>
                </details>
              ) : null}
            </div>
            {activity.targetPath ? (
              <button
                data-action-id={`activity.copy-path.${activity.id}`}
                type="button"
                onClick={() => {
                  if (!activity.targetPath) return;
                  if (props.onCopyPath) {
                    props.onCopyPath(activity.targetPath);
                    return;
                  }
                  void copyText(activity.targetPath);
                }}
              >
                Copy
              </button>
            ) : activity.command ? (
              <button data-action-id={`activity.copy-command.${activity.id}`} type="button" onClick={() => void copyText(activity.command ?? "")}>
                Copy
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function deriveToolTraceGroups(activities: StudioActivityItem[], activeProcesses: StudioActiveProcess[]): Array<{ id: string; label: string; count: number }> {
  const groups = new Map<string, { id: string; label: string; count: number }>();
  const add = (id: string, label: string) => {
    const current = groups.get(id) ?? { id, label, count: 0 };
    current.count += 1;
    groups.set(id, current);
  };
  for (const activity of activities) {
    if (activity.kind === "reading_file") add("read", "Read");
    else if (activity.kind === "searching") add("search", "Search");
    else if (activity.kind === "running_command") add("run", "Run");
    else if (activity.kind === "browser_action") add("browser", "Browser");
    else if (activity.kind === "figma_action") add("figma", "Figma");
    else add("other", "Other");
  }
  if (activeProcesses.length > 0) add("active", "Active");
  return Array.from(groups.values()).slice(0, 6);
}

export function KnowledgeReader(props: {
  filter: string;
  itemDetail: StudioKnowledgeItem | null;
  items: StudioKnowledgeItem[];
  query: string;
  selectedItem: StudioKnowledgeItem | null;
  onFilterChange: (filter: string) => void;
  onOpenItem: (item: StudioKnowledgeItem) => void;
  onQueryChange: (query: string) => void;
  onRefresh: () => void;
}) {
  const detail = props.itemDetail ?? props.selectedItem;
  const filters = [
    { id: "all", label: "All" },
    { id: "markdown", label: "Markdown" },
    { id: "yaml", label: "YAML" },
    { id: "spec", label: "Specs" },
    { id: "agent-capture", label: "Captured" },
  ];
  return (
    <WorkbenchPanel
      className="knowledge-reader-panel"
      data-knowledge-reader="design-reference-reader"
      eyebrow="Knowledge"
      title="References"
      meta={String(props.items.length)}
    >
      <div className="context-search-row">
        <input
          aria-label="Search knowledge"
          placeholder="Search"
          value={props.query}
          onChange={(event) => props.onQueryChange(event.target.value)}
        />
        <button data-action-id="knowledge.refresh" type="button" onClick={props.onRefresh}>Sync</button>
      </div>
      <div className="context-filter-row">
        {filters.map((filter) => (
          <button
            aria-pressed={props.filter === filter.id}
            className={props.filter === filter.id ? "active" : ""}
            data-action-id={`knowledge.filter.${filter.id}`}
            key={filter.id}
            onClick={() => props.onFilterChange(filter.id)}
            type="button"
          >
            {filter.label}
          </button>
        ))}
      </div>
      <div className="knowledge-list" role="list">
        {props.items.length === 0 ? <p className="empty">No notes</p> : null}
        {props.items.map((item) => (
          <button
            className={detail?.id === item.id ? "knowledge-row active" : "knowledge-row"}
            data-action-id={`knowledge.open.${item.id}`}
            data-knowledge-item-id={item.id}
            key={item.id}
            title={item.sourcePath}
            type="button"
            onClick={() => props.onOpenItem(item)}
          >
            <span>{item.title}</span>
            <small>{knowledgeKindLabel(item.kind)} / {displaySourceLabel(item.sourcePath)}</small>
          </button>
        ))}
      </div>
      {detail ? (
        <article className="knowledge-detail" data-knowledge-item-id={detail.id}>
          <header>
            <span>{knowledgeKindLabel(detail.kind)}</span>
            <strong>{detail.title}</strong>
          </header>
          <p>{trimText(detail.summary || detail.excerpt, 220)}</p>
          <pre>{trimText(detail.content || detail.excerpt, 1800)}</pre>
        </article>
      ) : null}
    </WorkbenchPanel>
  );
}

export function TraceTaskRow({ task }: { task: StudioTraceTask }) {
  return (
    <article className={`agent-task-row ${task.status}`} data-source-event-id={task.evidenceIds.at(-1) ?? ""}>
      <div>
        <strong>{task.label}</strong>
        <span>{task.status}</span>
      </div>
      <progress value={task.progress} max={100} />
    </article>
  );
}

export function FigmaDriver(props: {
  figmaStatus: FigmaStatus | null;
  figmaActionResult: FigmaActionResult | null;
  figmaConnecting: boolean;
  figmaActionRunning: boolean;
  figmaError: string | null;
  settingsDraft: StudioConfig | null;
  settingsSavedAt: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onOpen: () => void;
  onAction: (input: FigmaAction | FigmaActionRequest) => void;
  onPatchSettings: (update: (current: StudioConfig) => StudioConfig) => void;
  onSaveSettings: () => void;
}) {
  const figmaActionRunning = props.figmaActionRunning;
  const isBridgeRunning = isFigmaBridgeRunning(props.figmaStatus);
  const isPluginConnected = isFigmaPluginConnected(props.figmaStatus);
  const pluginState = isPluginConnected ? "connected" : "disconnected";
  const bridgeState = props.figmaError
    ? "failed"
    : props.figmaActionRunning
      ? "action running"
      : props.figmaConnecting
        ? "scanning"
        : isBridgeRunning
          ? "running"
          : "stopped";
  const bridgeButtonLabel = props.figmaConnecting
    ? "Scanning"
    : isBridgeRunning
      ? `Running :${props.figmaStatus?.port ?? "--"}`
      : "Start";
  const bridgeButtonDisabled = props.figmaConnecting || props.figmaActionRunning || isBridgeRunning;
  const pluginCopy = props.figmaError ?? (isPluginConnected ? "connected" : isBridgeRunning ? "waiting" : "stopped");
  const lastSync = props.figmaActionResult?.completedAt ? formatTime(props.figmaActionResult.completedAt) : "--";
  return (
    <section
      className="panel figma-driver"
      data-figma-bridge-card="compact"
      data-figma-settings="active-driver"
      data-figma-state={bridgeState}
      data-plugin-state={pluginState}
      data-user-settings="studio-settings"
    >
      <div className="panel-head">
        <div className="figma-heading"><FigmaLogoMark /><div><p className="eyebrow">Figma</p><h2>{pluginCopy}</h2></div></div>
        <span>{props.figmaStatus?.clients.length ?? 0} clients</span>
      </div>
      <div className="driver-grid">
        <label>
          <span>Port</span>
          <input
            inputMode="numeric"
            value={props.settingsDraft?.figma?.preferredPort ?? ""}
            onChange={(event) => props.onPatchSettings((current) => ({
              ...current,
              figma: {
                autoStartBridge: current.figma?.autoStartBridge ?? false,
                preferredPort: event.target.value ? Number(event.target.value) : null,
                portRange: current.figma?.portRange ?? [9223, 9232],
                lastFileKey: current.figma?.lastFileKey ?? null,
                lastConnectedAt: current.figma?.lastConnectedAt ?? null,
              },
            }))}
          />
        </label>
        <div className="bridge-state-copy">
          <span>{props.figmaError ?? `${bridgeState} / ${pluginState}`}</span>
        </div>
      </div>
      <div className="inline-actions">
        <button data-action-id="figma.connect" type="button" onClick={props.onConnect} disabled={bridgeButtonDisabled}>
          {bridgeButtonLabel}
        </button>
        <button data-action-id="figma.disconnect" type="button" onClick={props.onDisconnect} disabled={!props.figmaStatus?.running || props.figmaActionRunning}>Stop</button>
        <button data-action-id="figma.open" type="button" onClick={props.onOpen} disabled={!isBridgeRunning || props.figmaActionRunning}>Open</button>
        <button className="primary" data-action-id="settings.save" type="button" onClick={props.onSaveSettings} disabled={!props.settingsDraft}>Save</button>
      </div>
      <div className="figma-status-grid">
        <span><strong>{props.figmaStatus?.port ?? "--"}</strong> port</span>
        <span><strong>{props.figmaStatus?.clients.length ?? 0}</strong> clients</span>
        <span><strong>{props.figmaStatus?.bridgeStatus ?? "stopped"}</strong> bridge</span>
        <span><strong>{lastSync}</strong> last sync</span>
      </div>
      <div className="figma-clients">
        {(props.figmaStatus?.clients ?? []).map((client) => (
          <article key={client.id}>
            <strong>{client.file || client.id}</strong>
            <span>{client.editor} · {client.lastPing ?? client.connectedAt}</span>
          </article>
        ))}
        {props.figmaStatus?.clients.length === 0 ? <p className="empty">No clients</p> : null}
      </div>
      <div className="figma-actions">
        {FIGMA_ACTIONS.map((action) => (
          <button
            className={action.primary ? "primary" : ""}
            data-action-id={`figma.action.${action.id}`}
            disabled={!isPluginConnected || figmaActionRunning}
            key={action.id}
            type="button"
            onClick={() => props.onAction(action.id)}
          >
            {action.label}
          </button>
        ))}
      </div>
      <div className="figma-actions figma-mutation-actions" data-figma-mutating-actions="scratch-agent">
        {FIGMA_MUTATING_ACTIONS.map((action) => (
          <button
            key={action.label}
            data-action-id={`figma.action.${action.request.action}.scratch`}
            type="button"
            disabled={!isPluginConnected || figmaActionRunning}
            onClick={() => props.onAction(action.request)}
          >
            {action.label}
          </button>
        ))}
      </div>
      {props.figmaActionResult ? (
        <pre>{formatDataPreview(props.figmaActionResult).slice(0, 1800)}</pre>
      ) : null}
      <div className="settings-actions">
        <span>{props.settingsSavedAt ? `saved ${props.settingsSavedAt}` : "local settings"}</span>
      </div>
    </section>
  );
}

export function DesignSystemReviewSurface(props: {
  artifact: DesignSystemArtifact | null;
  figmaStatus?: FigmaStatus | null;
  onReviewSection: (
    artifactId: string,
    sectionId: string,
    reviewState: DesignSystemArtifactReviewState,
    comment?: string,
  ) => void;
  onUseSystem: (artifact: DesignSystemArtifact) => void;
}) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set([
    "section:brand",
    "section:type",
    "section:colors",
    "section:spacing",
    "section:components",
    "section:screens",
    "section:accessibility",
    "section:drift",
    "section:handoff",
  ]));
  const artifact = props.artifact;

  function toggle(sectionId: string) {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  if (!artifact) {
    return (
      <section className="design-system-review empty-review" data-design-system-artifact="review-surface" aria-label="Design system artifact">
        <header className="artifact-review-head">
          <div>
            <p className="eyebrow">Design system</p>
            <h2>No artifact</h2>
          </div>
          <span>waiting</span>
        </header>
        <p className="empty">No trace</p>
      </section>
    );
  }

  return (
    <section className="design-system-review" data-design-system-artifact="review-surface" data-artifact-acceptance-state={artifact.status} aria-label={artifact.title}>
      <header className="artifact-review-head">
        <div>
          <p className="eyebrow">Review</p>
          <h2>{artifact.title}</h2>
          <p>{artifact.createdByHarness} / {artifact.sourceWorkspace ? displaySourceLabel(artifact.sourceWorkspace) : "local"}</p>
        </div>
        <div className="artifact-review-actions">
          <label className="checkbox-row"><input type="checkbox" checked={artifact.status === "published"} readOnly /> Published</label>
          <label className="checkbox-row"><input type="checkbox" checked={artifact.status === "published"} readOnly /> Default</label>
          <button data-action-id="artifact.use-system" type="button" onClick={() => props.onUseSystem(artifact)}>Use</button>
        </div>
      </header>

      <DesignSystemSandbox artifact={artifact} figmaStatus={props.figmaStatus ?? null} />
      <AgenticDesignSystemContract artifact={artifact} />
      <SourceReferenceChips refs={artifact.sourceRefs.slice(0, 8)} />
      <ArtifactResolvedEvidence artifact={artifact} />

      <div className="artifact-review-list">
        {artifact.sections.map((section) => {
          const open = openSections.has(section.id);
          return (
            <article className="review-section" data-review-section={section.kind} data-review-state={section.reviewState} key={section.id}>
              <button className="review-section-trigger" data-action-id={`artifact.section.${section.kind}`} type="button" onClick={() => toggle(section.id)}>
                <span>{open ? "v" : ">"}</span>
                <strong>{section.title}</strong>
                <small>{section.summary}</small>
                <em>{reviewStateLabel(section.reviewState)}</em>
              </button>
              {open ? (
                <div className="review-section-body">
                  <div className="review-toolbar">
                    <button
                      data-action-id={`artifact.review.${section.kind}.looks_good`}
                      data-review-action="looks_good"
                      type="button"
                      onClick={() => props.onReviewSection(artifact.id, section.id, "looks_good", `${section.title} verified in Studio.`)}
                    >
                      OK
                    </button>
                    <button
                      data-action-id={`artifact.review.${section.kind}.needs_work`}
                      data-review-action="needs_work"
                      type="button"
                      onClick={() => props.onReviewSection(artifact.id, section.id, "needs_work", `${section.title} needs a follow-up pass.`)}
                    >
                      Fix
                    </button>
                  </div>
                  <ArtifactPreview artifact={artifact} section={section} />
                  <SourceReferenceChips refs={section.sourceRefs} />
                  <FormattedMessage text={section.content} />
                  {section.comments.length ? (
                    <div className="review-comments" data-review-comments={section.id}>
                      {section.comments.map((comment, index) => <p key={`${section.id}-comment-${index}`}>{comment}</p>)}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ArtifactResolvedEvidence({ artifact }: { artifact: DesignSystemArtifact }) {
  const assets = artifact.assets ?? [];
  const tokens = artifact.tokens ?? [];
  if (assets.length === 0 && tokens.length === 0) return null;
  return (
    <div className="artifact-resolved-evidence" data-artifact-assets="resolved" data-token-evidence="resolved">
      {assets.length ? (
        <section>
          <strong>Resolved assets</strong>
          {assets.slice(0, 6).map((asset) => (
            <span key={asset.id}>{asset.label}</span>
          ))}
        </section>
      ) : null}
      {tokens.length ? (
        <section>
          <strong>Token evidence</strong>
          {tokens.slice(0, 8).map((token) => (
            <span key={token.id}>{token.name}: {token.value}</span>
          ))}
        </section>
      ) : null}
    </div>
  );
}

export function SourceReferenceChips({ refs }: { refs: DesignSystemArtifact["sourceRefs"] }) {
  if (refs.length === 0) return null;
  return (
    <div className="source-reference-chips" data-source-reference-chips>
      {refs.map((ref) => (
        <FileReferenceChip
          key={ref.id}
          label={ref.label}
          path={`${ref.sourcePath ?? ref.url ?? ref.label}${ref.line ? `:${ref.line}` : ""}`}
        />
      ))}
    </div>
  );
}

function DesignSystemSandbox({ artifact, figmaStatus }: { artifact: DesignSystemArtifact; figmaStatus: FigmaStatus | null }) {
  const bridge = isFigmaPluginConnected(figmaStatus) ? "plugin connected" : isFigmaBridgeRunning(figmaStatus) ? "bridge running" : "bridge stopped";
  return (
    <section className="design-system-sandbox" data-design-system-sandbox="local-container">
      <article><strong>Reference container</strong><span>{artifact.sections.length} sections / {artifact.sourceRefs.length} sources</span></article>
      <article><strong>Agent playground</strong><span>{artifact.createdByHarness} / JSON artifact</span></article>
      <article><strong>Figma compatibility</strong><span>{bridge}{figmaStatus?.port ? ` / :${figmaStatus.port}` : ""}</span></article>
      <article><strong>Developer handoff</strong><span>tokens / components / source refs</span></article>
    </section>
  );
}

function AgenticDesignSystemContract({ artifact }: { artifact: DesignSystemArtifact }) {
  const roles = artifact.agentic?.roles ?? FALLBACK_AGENTIC_ROLES;
  const references: AgenticOpenSourceReferences = artifact.agentic?.openSourceReferences ?? FALLBACK_AGENTIC_OPEN_SOURCE_REFERENCES;
  const patterns: AgenticInteractionPatterns = artifact.agentic?.interactionPatterns ?? FALLBACK_AGENTIC_INTERACTION_PATTERNS;
  if (roles.length === 0) return null;
  return (
    <section className="agentic-design-system" data-agentic-design-system="role-contract">
      <header>
        <strong>Agentic contract</strong>
        <span>{artifact.agentic?.source.name ?? "Agentic UI"} / {artifact.agentic?.source.access ?? "local"}</span>
      </header>
      <div className="agentic-role-grid">
        {roles.map((role) => (
          <article className="agentic-role-card" data-agentic-role-card={role.id} key={role.id}>
            <strong>{role.label}</strong>
            <span>{role.atomicLevel} / {role.surface}</span>
            <small>{role.requiredSignals.join(" / ")}</small>
          </article>
        ))}
      </div>
      <div className="agentic-output-contract">
        <span>{(artifact.agentic?.outputSections ?? FALLBACK_AGENTIC_OUTPUT_SECTIONS).join(" / ")}</span>
      </div>
      <div className="agentic-pattern-source-list" data-agentic-pattern-source="artifact-contract">
        {references.slice(0, 6).map((reference) => (
          <article className="agentic-pattern-source-card" data-agentic-pattern-source={reference.name} key={reference.name}>
            <strong>{reference.name}</strong>
            <span>{reference.license} / {reference.category}</span>
            <small>{reference.mappedRoles.join(" / ")}</small>
          </article>
        ))}
      </div>
      <div className="agentic-interaction-pattern-list">
        {patterns.slice(0, 5).map((pattern) => (
          <article className="agentic-role-card" data-agentic-pattern={pattern.id} key={pattern.id}>
            <strong>{pattern.label}</strong>
            <span>{pattern.source}</span>
            <small>{pattern.requiredSignals.join(" / ")}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function ArtifactPreview({ artifact, section }: { artifact: DesignSystemArtifact; section: DesignSystemArtifactSection }) {
  if (section.preview.kind === "brand") return <BrandPreview artifact={artifact} section={section} />;
  if (section.preview.kind === "typography") return <TypographyPreview artifact={artifact} section={section} />;
  if (section.preview.kind === "tokens") return <TokenPreview artifact={artifact} section={section} />;
  if (section.preview.kind === "spacing") return <SpacingPreview artifact={artifact} section={section} />;
  if (section.preview.kind === "components") return <ComponentPreview artifact={artifact} section={section} />;
  return (
    <div className={`artifact-preview preview-${section.preview.kind}`} data-artifact-preview={section.preview.kind}>
      {section.preview.items.map((item, index) => (
        <article key={`${section.id}-preview-${index}`}>
          <strong>{item.label}</strong>
          <span>{item.value}</span>
          {item.detail ? <small>{item.detail}</small> : null}
        </article>
      ))}
    </div>
  );
}

function BrandPreview({ artifact, section }: { artifact: DesignSystemArtifact; section: DesignSystemArtifactSection }) {
  const assets = (artifact.assets ?? []).filter((asset) => asset.kind === "brand" || asset.kind === "logo").slice(0, 6);
  if (assets.length) {
    return (
      <div className="artifact-preview visual-reference brand-reference" data-artifact-preview="brand-lockups">
        {assets.map((asset) => (
          <article key={asset.id}>
            {asset.previewUrl ? <img className="brand-asset-img" alt={asset.label} src={asset.previewUrl} /> : <span className="brand-mark" aria-hidden="true">{asset.label.slice(0, 1)}</span>}
            <strong>{asset.label}</strong>
            <small>{displaySourceLabel(asset.sourcePath)}</small>
          </article>
        ))}
      </div>
    );
  }
  return (
    <div className="artifact-preview visual-reference brand-reference" data-artifact-preview="brand-lockups">
      {["transparent", "on surface", "on light"].map((tone) => (
        <article key={tone}>
          <span className="brand-mark" aria-hidden="true">{section.title.slice(0, 1)}</span>
          <strong>{tone}</strong>
          <small>{section.summary}</small>
        </article>
      ))}
    </div>
  );
}

function TypographyPreview({ artifact, section }: { artifact: DesignSystemArtifact; section: DesignSystemArtifactSection }) {
  const typeTokens = (artifact.tokens ?? []).filter((token) => token.kind === "typography").slice(0, 4);
  const labels = typeTokens.length ? typeTokens.map((token) => `${token.name} / ${token.line ?? "src"}`) : ["H1 / 32 / 700", "H2 / 24 / 600", "Body / 15 / 400", "Meta / 13 / 400"];
  return (
    <div className="typography-reference visual-reference" data-artifact-preview="type-ramp">
      {labels.map((label, index) => (
        <p className={`type-sample type-sample-${index}`} key={label}><span>{label}</span>{typeTokens[index]?.value ?? section.preview.items[index]?.label ?? "Design system text"}</p>
      ))}
    </div>
  );
}

function TokenPreview({ artifact, section }: { artifact: DesignSystemArtifact; section: DesignSystemArtifactSection }) {
  const resolved = (artifact.tokens ?? []).filter((token) => token.kind === "color").slice(0, 12);
  if (resolved.length) {
    return (
      <div className="token-reference visual-reference" data-artifact-preview="token-swatches">
        {resolved.map((token) => <article key={token.id}><span style={{ background: token.value }} /><strong>{token.name}</strong><small>{token.value}</small></article>)}
      </div>
    );
  }
  const tokens = ["surface", "muted", "accent", "ok", "danger"];
  return (
    <div className="token-reference visual-reference" data-artifact-preview="token-swatches">
      {tokens.map((token) => <article className={`swatch-${token}`} key={token}><span /><strong>{token}</strong><small>{section.summary}</small></article>)}
    </div>
  );
}

function SpacingPreview({ artifact, section }: { artifact: DesignSystemArtifact; section: DesignSystemArtifactSection }) {
  const resolved = (artifact.tokens ?? []).filter((token) => ["spacing", "radius", "shadow"].includes(token.kind)).slice(0, 6);
  if (resolved.length) {
    return (
      <div className="spacing-reference visual-reference" data-artifact-preview="spacing-scale">
        {resolved.map((token) => <article key={token.id}><span /><strong>{token.name}</strong><small>{token.value}</small></article>)}
      </div>
    );
  }
  return (
    <div className="spacing-reference visual-reference" data-artifact-preview="spacing-scale">
      {["none", "sm", "md", "glow"].map((label) => <article className={`space-${label}`} key={label}><span /><strong>{label}</strong><small>{section.summary}</small></article>)}
    </div>
  );
}

function ComponentPreview({ artifact, section }: { artifact: DesignSystemArtifact; section: DesignSystemArtifactSection }) {
  const componentTokens = (artifact.tokens ?? []).filter((token) => token.kind !== "color").slice(0, 6);
  return (
    <div className="component-reference visual-reference" data-artifact-preview="component-playground">
      <div className="component-tabs" data-component-tabs="preview-variants-states">{["Preview", "Variants", "States", "Responsive", "Data"].map((label) => <span className={label === "Preview" ? "active" : ""} key={label}>{label}</span>)}</div>
      <div className="component-lab" data-component-lab="playground-sandbox">
        <div className="component-stage">
          {["Primary", "Secondary", "Outline", "Danger", "Disabled"].map((label) => <span className="component-button" key={label}>{label}</span>)}
          <article><strong>Component inventory</strong><span>{section.preview.items.map((item) => item.label).join(" / ")}</span></article>
        </div>
        <aside className="component-inspector" data-component-inspector="props-tokens-source">
          <strong>Props</strong><span>variant / state / source refs</span>
          <strong>Tokens used</strong><span>{componentTokens.map((token) => token.name).join(" / ") || section.sourceRefs.slice(0, 3).map((ref) => ref.label).join(" / ") || "token refs pending"}</span>
          <strong>Agent output</strong><span>{section.summary}</span>
        </aside>
      </div>
      <div className="component-console" data-component-console="agent-cli"><span>runtime ready</span><span>tests traced</span><span>diff linked</span></div>
    </div>
  );
}

function reviewStateLabel(state: DesignSystemArtifactReviewState): string {
  if (state === "looks_good") return "looks good";
  if (state === "needs_work") return "needs work";
  return "needs review";
}

export function InputModeSwitcher(props: {
  value: StudioInputMode;
  onChange: (mode: StudioInputMode) => void;
}) {
  const modes: Array<{ id: StudioInputMode; label: string }> = [
    { id: "agent", label: "Agent" },
    { id: "terminal", label: "Terminal" },
    { id: "auto", label: "Auto" },
  ];
  return (
    <div className="input-mode-switcher" data-input-mode-switcher="agent-terminal-auto" aria-label="Input mode">
      {modes.map((mode) => (
        <button
          aria-pressed={props.value === mode.id}
          className={props.value === mode.id ? "active" : ""}
          data-action-id={`input-mode.${mode.id}`}
          key={mode.id}
          type="button"
          onClick={() => props.onChange(mode.id)}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}

type DesignChangelogFilter = "all" | "agent" | "manual" | "needs-evidence" | "archived";

export function DesignChangelogPage(props: {
  entries: DesignChangelogEntry[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void | Promise<void>;
  onCreate: (entry: DesignChangelogCreateInput) => void | Promise<void>;
  onUpdate: (id: string, patch: DesignChangelogPatchInput) => void | Promise<void>;
  onArchive: (id: string) => void | Promise<void>;
  onRestore: (id: string) => void | Promise<void>;
  onExport: () => void | Promise<void>;
}) {
  const [filter, setFilter] = useState<DesignChangelogFilter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(() => changelogDraft());
  const filteredEntries = props.entries.filter((entry) => matchesDesignChangelogFilter(entry, filter));
  const selectedEntry = editingId ? props.entries.find((entry) => entry.id === editingId) ?? null : null;

  function openNewEntry() {
    setEditingId(null);
    setDraft(changelogDraft());
  }

  function openEntry(entry: DesignChangelogEntry) {
    setEditingId(entry.id);
    setDraft(changelogDraft(entry));
  }

  function saveEntry() {
    const tags = draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
    const payload = {
      title: draft.title,
      summary: draft.summary,
      bodyMarkdown: draft.bodyMarkdown,
      tags,
      authoredBy: "human" as const,
      sessionId: selectedEntry?.sessionId ?? null,
      harness: selectedEntry?.harness ?? null,
      action: selectedEntry?.action ?? null,
      eventIds: selectedEntry?.eventIds ?? [],
      fileRefs: selectedEntry?.fileRefs ?? [],
      captureWarnings: selectedEntry?.captureWarnings ?? [],
    };
    if (selectedEntry) void props.onUpdate(selectedEntry.id, payload);
    else void props.onCreate(payload);
  }

  return (
    <section className="design-changelog-page" data-design-changelog-page="design-memory" aria-label="Design changelog">
      <header className="design-changelog-header">
        <div>
          <p className="eyebrow">Changelog / Design memory</p>
          <h2>Design decisions and system changes</h2>
          <span>{props.entries.length} local entries in .memoire/project-memory/changelog</span>
        </div>
        <div className="design-changelog-actions">
          <button data-action-id="design-changelog.refresh" type="button" onClick={() => void props.onRefresh()} disabled={props.loading}>
            {props.loading ? "Refreshing" : "Refresh"}
          </button>
          <button data-action-id="design-changelog.new" type="button" onClick={openNewEntry}>New entry</button>
          <button data-action-id="design-changelog.export" type="button" onClick={() => void props.onExport()}>Export</button>
        </div>
      </header>

      <div className="design-changelog-filters" role="tablist" aria-label="Changelog filters">
        <button aria-selected={filter === "all"} className={filter === "all" ? "active" : ""} data-design-changelog-filter="all" data-action-id="design-changelog.filter.all" type="button" onClick={() => setFilter("all")}>All</button>
        <button aria-selected={filter === "agent"} className={filter === "agent" ? "active" : ""} data-design-changelog-filter="agent" data-action-id="design-changelog.filter.agent" type="button" onClick={() => setFilter("agent")}>Agent captured</button>
        <button aria-selected={filter === "manual"} className={filter === "manual" ? "active" : ""} data-design-changelog-filter="manual" data-action-id="design-changelog.filter.manual" type="button" onClick={() => setFilter("manual")}>Manual</button>
        <button aria-selected={filter === "needs-evidence"} className={filter === "needs-evidence" ? "active" : ""} data-design-changelog-filter="needs-evidence" data-action-id="design-changelog.filter.needs-evidence" type="button" onClick={() => setFilter("needs-evidence")}>Needs evidence</button>
        <button aria-selected={filter === "archived"} className={filter === "archived" ? "active" : ""} data-design-changelog-filter="archived" data-action-id="design-changelog.filter.archived" type="button" onClick={() => setFilter("archived")}>Archived</button>
      </div>

      {props.error ? <p className="design-changelog-warning">{props.error}</p> : null}

      <div className="design-changelog-layout">
        <div className="design-changelog-list" data-design-changelog-list="timeline">
          {filteredEntries.map((entry) => (
            <article className="design-changelog-card" data-design-changelog-entry={entry.id} data-status={entry.status} key={entry.id}>
              <button data-action-id={`design-changelog.edit.${entry.id}`} type="button" onClick={() => openEntry(entry)}>
                <span>{entry.authoredBy === "human" ? "Manual" : "Agent captured"}</span>
                <strong>{entry.title}</strong>
                <small>{entry.harness ?? "studio"} / {entry.action ?? "design"} / {formatTime(entry.updatedAt)}</small>
                <p>{entry.summary}</p>
                <span>{entry.tags.slice(0, 4).join(" / ") || "untagged"}</span>
                <span>{entry.fileRefs.length} files / {entry.eventIds.length} events</span>
              </button>
              {entry.captureWarnings.length > 0 ? (
                <p className="design-changelog-warning">{entry.captureWarnings[0]}</p>
              ) : null}
            </article>
          ))}
          {filteredEntries.length === 0 ? <p className="empty">No changelog entries for this filter.</p> : null}
        </div>

        <aside className="design-changelog-editor" data-design-changelog-editor="local-project-memory" aria-label="Changelog editor">
          <div className="drawer-section-head">
            <span>{selectedEntry ? "Edit entry" : "New entry"}</span>
            <small>{selectedEntry?.status ?? "active"}</small>
          </div>
          <label>
            <span>Title</span>
            <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
          </label>
          <label>
            <span>Summary</span>
            <input value={draft.summary} onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))} />
          </label>
          <label>
            <span>Tags</span>
            <input value={draft.tags} onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))} placeholder="tokens, figma, studio" />
          </label>
          <label>
            <span>Markdown body</span>
            <textarea value={draft.bodyMarkdown} onChange={(event) => setDraft((current) => ({ ...current, bodyMarkdown: event.target.value }))} />
          </label>
          {selectedEntry ? (
            <div className="design-changelog-file-refs" data-design-changelog-file-refs="linked-evidence">
              <strong>Evidence</strong>
              <span>{selectedEntry.sessionId ?? "manual entry"}</span>
              {selectedEntry.fileRefs.slice(0, 6).map((file) => (
                <small key={file.path}>{file.path} / {file.kind} / +{file.insertions} -{file.deletions}</small>
              ))}
              {selectedEntry.captureWarnings.map((warning) => (
                <p className="design-changelog-warning" key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
          <div className="design-changelog-editor-actions">
            <button data-action-id="design-changelog.save" type="button" onClick={saveEntry} disabled={!draft.title.trim() || !draft.summary.trim()}>Save</button>
            {selectedEntry?.status === "archived" ? (
              <button data-action-id={`design-changelog.restore.${selectedEntry.id}`} type="button" onClick={() => void props.onRestore(selectedEntry.id)}>Restore</button>
            ) : null}
            {selectedEntry && selectedEntry.status !== "archived" ? (
              <button data-action-id={`design-changelog.archive.${selectedEntry.id}`} type="button" onClick={() => void props.onArchive(selectedEntry.id)}>Archive</button>
            ) : null}
            <button data-action-id="design-changelog.cancel" type="button" onClick={openNewEntry}>Clear</button>
          </div>
        </aside>
      </div>
    </section>
  );
}

function changelogDraft(entry?: DesignChangelogEntry) {
  return {
    title: entry?.title ?? "",
    summary: entry?.summary ?? "",
    bodyMarkdown: entry?.bodyMarkdown ?? "## Decision\n\n\n## Evidence\n\n",
    tags: entry?.tags.join(", ") ?? "",
  };
}

function matchesDesignChangelogFilter(entry: DesignChangelogEntry, filter: DesignChangelogFilter): boolean {
  if (filter === "archived") return entry.status === "archived";
  if (entry.status === "archived") return false;
  if (filter === "agent") return entry.authoredBy !== "human";
  if (filter === "manual") return entry.authoredBy === "human";
  if (filter === "needs-evidence") return entry.captureWarnings.length > 0 || entry.fileRefs.length === 0;
  return true;
}

type CommandPaletteRowKind = "navigation" | "harness" | "session" | "knowledge" | "empty";
type CommandPaletteIcon = "settings" | "figma" | "plugins" | "automations" | "changelog" | "advanced" | "claude" | "codex" | "hermes" | "session" | "knowledge" | "search" | "close";
type CommandPaletteRow = {
  id: string;
  kind: CommandPaletteRowKind;
  icon: CommandPaletteIcon;
  label: string;
  detail: string;
  run: () => void;
  disabled?: boolean;
};

export function CommandPalette(props: {
  open: boolean;
  query: string;
  compatibility: StudioCompatibilitySnapshot | null;
  sessions: SessionSummary[];
  knowledgeItems: StudioKnowledgeItem[];
  onQueryChange: (query: string) => void;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenSettingsSection: (section: string) => void;
  onOpenFigma: () => void;
  onOpenPlugins: () => void;
  onOpenAutomations: () => void;
  onOpenChangelog: () => void;
  onSelectHarness: (id: Harness["id"]) => void;
  onOpenSession: (session: SessionSummary) => void;
  onOpenKnowledgeItem: (item: StudioKnowledgeItem) => void;
}) {
  if (!props.open) return null;
  const query = props.query.toLowerCase();
  const harnessRows: CommandPaletteRow[] = (props.compatibility?.harnesses ?? [])
    .filter((harness) => isCoreHarness(harness.id))
    .filter((harness) => `${harness.label} ${harness.provider} ${harness.authStatus}`.toLowerCase().includes(query))
    .slice(0, 8)
    .map((harness) => ({
      id: `harness.select.${harness.id}`,
      kind: "harness",
      icon: harnessIcon(harness.id),
      label: harness.label,
      detail: `${harness.authStatus} · ${harness.requiredSetup[0] ?? "ready"}`,
      run: () => props.onSelectHarness(harness.id),
    }));
  const sessionRows: CommandPaletteRow[] = props.sessions
    .filter((session) => `${session.prompt} ${session.harness} ${session.status}`.toLowerCase().includes(query))
    .slice(0, 5)
    .map((session) => ({
      id: `session.open.${session.id}`,
      kind: "session",
      icon: "session",
      label: trimText(session.prompt, 64),
      detail: `${session.harness} · ${session.status}`,
      run: () => props.onOpenSession(session),
    }));
  const knowledgeRows: CommandPaletteRow[] = props.knowledgeItems
    .filter((item) => `${item.title} ${item.summary} ${item.tags.join(" ")}`.toLowerCase().includes(query))
    .slice(0, 5)
    .map((item) => ({
      id: `knowledge.open.${item.id}`,
      kind: "knowledge",
      icon: "knowledge",
      label: item.title,
      detail: `${knowledgeKindLabel(item.kind)} · ${displaySourceLabel(item.sourcePath)}`,
      run: () => props.onOpenKnowledgeItem(item),
    }));
  const navigationRows: CommandPaletteRow[] = [
    { id: "settings.open", kind: "navigation" as const, icon: "settings" as const, label: "Settings", detail: "Open Studio settings", run: props.onOpenSettings },
    { id: "command.open.figma", kind: "navigation" as const, icon: "figma" as const, label: "Figma Bridge", detail: "Open bridge status and plugin actions", run: props.onOpenFigma },
    { id: "command.open.plugins", kind: "navigation" as const, icon: "plugins" as const, label: "Plugins", detail: "Open Mémoire Notes marketplace", run: props.onOpenPlugins },
    { id: "command.open.automations", kind: "navigation" as const, icon: "automations" as const, label: "Automations", detail: "Open scheduled Studio work", run: props.onOpenAutomations },
    { id: "command.open.changelog", kind: "navigation" as const, icon: "changelog" as const, label: "Changelog", detail: "Open local design memory entries", run: props.onOpenChangelog },
    { id: "command.open.advanced", kind: "navigation" as const, icon: "advanced" as const, label: "Advanced Tools", detail: "Open tools, browser, and runtime diagnostics", run: () => props.onOpenSettingsSection("Advanced") },
  ].filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(query));
  const commandPaletteRows: CommandPaletteRow[] = [...navigationRows, ...harnessRows, ...sessionRows, ...knowledgeRows];
  const rows = commandPaletteRows.length > 0 ? commandPaletteRows : [{
    id: "command-palette.empty",
    kind: "empty" as const,
    icon: "search" as const,
    label: "No matching actions",
    detail: "Try searching settings, harnesses, sessions, notes, or files.",
    run: () => undefined,
    disabled: true,
  }];
  return (
    <div className="modal-backdrop command-palette-backdrop" data-command-palette="warp-style" role="dialog" aria-modal="true" aria-label="Command palette">
      <section className="command-palette-panel">
        <header>
          <label className="command-palette-search" data-command-palette-search="actions">
            <span className="command-palette-icon" data-command-palette-icon="search"><CommandPaletteIconGlyph name="search" /></span>
            <input autoFocus value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder="Search actions, sessions, notes, files..." />
          </label>
          <button className="command-palette-close" data-action-id="command-palette.close" type="button" onClick={props.onClose}>
            <span className="command-palette-icon" data-command-palette-icon="close"><CommandPaletteIconGlyph name="close" /></span>
            <span>Close</span>
          </button>
        </header>
        <div className="command-palette-list" data-command-nav="studio-surfaces">
          {rows.map((row) => (
            <button
              data-action-id={row.id}
              data-command-palette-empty={row.kind === "empty" ? "true" : undefined}
              data-command-palette-row={row.kind}
              disabled={row.disabled}
              key={row.id}
              type="button"
              onClick={row.run}
            >
              <span className="command-palette-icon" data-command-palette-icon={row.icon}><CommandPaletteIconGlyph name={row.icon} /></span>
              <span>
                <strong>{row.label}</strong>
                <small>{row.detail}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function harnessIcon(id: Harness["id"]): CommandPaletteIcon {
  if (id === "claude-code") return "claude";
  if (id === "hermes") return "hermes";
  return "codex";
}

function CommandPaletteIconGlyph({ name }: { name: CommandPaletteIcon }) {
  if (name === "settings") return <StudioLineIcon><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.7-1L14.5 3h-5l-.3 3a8 8 0 0 0-1.7 1L5.1 6l-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .3 0 .7.1 1l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 1.7 1l.3 3h5l.3-3a8 8 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1Z" /></StudioLineIcon>;
  if (name === "figma") return <StudioLineIcon><circle cx="9" cy="6" r="3" /><circle cx="15" cy="6" r="3" /><circle cx="9" cy="12" r="3" /><circle cx="15" cy="12" r="3" /><circle cx="9" cy="18" r="3" /></StudioLineIcon>;
  if (name === "plugins") return <StudioLineIcon><path d="M8 4h8v5h4v8h-5v3H7v-5H4V7h4V4Z" /></StudioLineIcon>;
  if (name === "automations") return <StudioLineIcon><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></StudioLineIcon>;
  if (name === "changelog") return <StudioLineIcon><path d="M7 4h10v16H7V4Z" /><path d="M10 8h4M10 12h4M10 16h3" /></StudioLineIcon>;
  if (name === "advanced") return <StudioLineIcon><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2" /><circle cx="15" cy="17" r="2" /></StudioLineIcon>;
  if (name === "claude") return <StudioLineIcon><path d="M12 4 5 20M12 4l7 16M8 13h8" /></StudioLineIcon>;
  if (name === "codex") return <StudioLineIcon><rect x="5" y="5" width="14" height="14" rx="3" /><path d="M9 9h6v6H9z" /></StudioLineIcon>;
  if (name === "hermes") return <StudioLineIcon><path d="M5 18 12 4l7 14M8 13h8" /><path d="M9 20h6" /></StudioLineIcon>;
  if (name === "session") return <StudioLineIcon><path d="M5 6h14v12H5z" /><path d="M8 10h8M8 14h5" /></StudioLineIcon>;
  if (name === "knowledge") return <StudioLineIcon><path d="M6 5h9l3 3v11H6V5Z" /><path d="M9 12h6M9 16h4" /></StudioLineIcon>;
  if (name === "close") return <StudioLineIcon><path d="m7 7 10 10M17 7 7 17" /></StudioLineIcon>;
  return <StudioLineIcon><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></StudioLineIcon>;
}

export function AutomationCenter(props: {
  open: boolean;
  automations: StudioAutomationDefinition[];
  templates: StudioAutomationTemplate[];
  runsByAutomation: Record<string, StudioAutomationRun[]>;
  scheduler: StudioAutomationSchedulerStatus | null;
  projectRoot: string;
  busyId: string | null;
  onClose: () => void;
  onRefresh: () => void | Promise<void>;
  onCreate: (input: Partial<StudioAutomationDefinition> & { templateId?: string }) => void | Promise<void>;
  onUpdate: (id: string, patch: Partial<StudioAutomationDefinition>) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onRunNow: (id: string) => void | Promise<void>;
  onLoadRuns: (id: string) => void | Promise<void>;
  onInstallScheduler: () => void | Promise<void>;
  onUninstallScheduler: () => void | Promise<void>;
}) {
  const orderedTemplates = sortAutomationTemplates(props.templates);
  const [selectedId, setSelectedId] = useState(props.automations[0]?.id ?? "");
  const selectedAutomation = props.automations.find((automation) => automation.id === selectedId) ?? props.automations[0] ?? null;
  const selectedRuns = selectedAutomation ? props.runsByAutomation[selectedAutomation.id] ?? [] : [];
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<StudioAutomationDefinition> & { templateId?: string }>(() =>
    automationDraftFromTemplate(orderedTemplates[0], props.projectRoot),
  );

  if (!props.open) return null;

  function openCreate(template?: StudioAutomationTemplate) {
    setDraft(automationDraftFromTemplate(template ?? orderedTemplates[0], props.projectRoot));
    setEditingId(null);
    setModalMode("create");
  }

  function openEdit(automation: StudioAutomationDefinition) {
    setDraft({
      ...automation,
      codex: { ...normalizeCodexUiConfig(automation.codex) },
    });
    setEditingId(automation.id);
    setModalMode("edit");
  }

  function patchDraft(update: Partial<StudioAutomationDefinition> & { templateId?: string }) {
    setDraft((current) => ({ ...current, ...update }));
  }

  function patchDraftCodex(update: Partial<StudioCodexConfig>) {
    setDraft((current) => ({
      ...current,
      codex: {
        ...normalizeCodexUiConfig(current.codex),
        ...update,
      },
    }));
  }

  async function submitAutomation(event: FormEvent) {
    event.preventDefault();
    if (modalMode === "edit" && editingId) {
      await props.onUpdate(editingId, draft);
    } else {
      await props.onCreate(draft);
    }
    setModalMode(null);
    setEditingId(null);
  }

  const schedulerInstalled = Boolean(props.scheduler?.installed);
  const isSchedulerBusy = props.busyId === "scheduler";

  return (
    <div className="modal-backdrop automations-backdrop" data-automations-center="studio" role="dialog" aria-modal="true" aria-label="Studio automations">
      <section className="automations-panel">
        <header className="automations-header">
          <div>
            <span>Studio Automations</span>
            <h2>Codex design harness scheduler</h2>
          </div>
          <div className="inline-actions">
            <button data-action-id="automations.refresh" type="button" onClick={() => void props.onRefresh()}>Refresh</button>
            <button data-action-id="automations.close" type="button" onClick={props.onClose}>Close</button>
          </div>
        </header>

        <section className="automation-scheduler-strip" data-automation-scheduler-status={schedulerInstalled ? "installed" : "missing"}>
          <div>
            <strong>{schedulerInstalled ? "Scheduler installed" : "Scheduler not installed"}</strong>
            <span>{props.scheduler?.message ?? "Runtime scheduler unavailable"}</span>
            <small>{props.scheduler?.plistPath ?? "LaunchAgent status will appear after runtime connects"}</small>
          </div>
          <div className="inline-actions">
            <button data-action-id="automations.scheduler.install" type="button" onClick={() => void props.onInstallScheduler()} disabled={isSchedulerBusy}>
              Install
            </button>
            <button data-action-id="automations.scheduler.uninstall" type="button" onClick={() => void props.onUninstallScheduler()} disabled={isSchedulerBusy || !schedulerInstalled}>
              Uninstall
            </button>
          </div>
        </section>

        <section className="automation-template-row" data-automation-template-picker="design-harness">
          {orderedTemplates.map((template) => (
            <button
              data-action-id={`automations.template.${template.id}`}
              data-template-id={template.id}
              key={template.id}
              type="button"
              onClick={() => openCreate(template)}
            >
              <strong>{template.name}</strong>
              <span>{template.description}</span>
            </button>
          ))}
        </section>

        <div className="automations-grid">
          <aside className="automation-list" data-automation-list="workspace-store">
            <div className="drawer-section-head">
              <span>Automations</span>
              <button data-action-id="automations.create" type="button" onClick={() => openCreate()}>Create</button>
            </div>
            {props.automations.map((automation) => {
              const runs = props.runsByAutomation[automation.id] ?? [];
              const lastRun = runs[0];
              const busy = props.busyId === automation.id;
              return (
                <article className="automation-row" data-automation-status={automation.status.toLowerCase()} key={automation.id}>
                  <button
                    className={automation.id === selectedAutomation?.id ? "active" : ""}
                    data-action-id={`automations.select.${automation.id}`}
                    type="button"
                    onClick={() => setSelectedId(automation.id)}
                  >
                    <strong>{automation.name}</strong>
                    <span>{automation.harness} / {automation.action} / {automation.mutationPolicy}</span>
                    <small>Next {formatAutomationDate(automation.nextRunAt)}</small>
                  </button>
                  <div className="automation-row-actions">
                    <button data-action-id={`automations.pause.${automation.id}`} type="button" onClick={() => void props.onUpdate(automation.id, { status: automation.status === "ACTIVE" ? "PAUSED" : "ACTIVE" })} disabled={busy}>
                      {automation.status === "ACTIVE" ? "Pause" : "Resume"}
                    </button>
                    <button data-action-id={`automations.run.${automation.id}`} type="button" onClick={() => void props.onRunNow(automation.id)} disabled={busy}>
                      Run now
                    </button>
                    <button data-action-id={`automations.edit.${automation.id}`} type="button" onClick={() => openEdit(automation)} disabled={busy}>
                      Edit
                    </button>
                    <button data-action-id={`automations.history.${automation.id}`} type="button" onClick={() => void props.onLoadRuns(automation.id)}>
                      History
                    </button>
                    <button data-action-id={`automations.delete.${automation.id}`} type="button" onClick={() => void props.onDelete(automation.id)} disabled={busy}>
                      Delete
                    </button>
                  </div>
                  <small className="automation-last-status">Last {lastRun?.status ?? formatAutomationDate(automation.lastRunAt)}</small>
                </article>
              );
            })}
            {props.automations.length === 0 ? <p className="empty">No automations yet.</p> : null}
          </aside>

          <section className="automation-detail" data-automation-detail="codex-run-history">
            {selectedAutomation ? (
              <>
                <div className="automation-detail-head">
                  <div>
                    <span>{selectedAutomation.status}</span>
                    <h3>{selectedAutomation.name}</h3>
                  </div>
                  <div className="automation-metrics">
                    <span>{selectedAutomation.harness}</span>
                    <span>{selectedAutomation.codex?.model ?? "gpt-5.5"}</span>
                    <span>{selectedAutomation.codex?.reasoningEffort ?? "xhigh"}</span>
                  </div>
                </div>
                <div className="automation-detail-grid">
                  <article><span>Schedule</span><strong>{rruleSummary(selectedAutomation.rrule)}</strong></article>
                  <article><span>Next run</span><strong>{formatAutomationDate(selectedAutomation.nextRunAt)}</strong></article>
                  <article><span>Permissions</span><strong>{selectedAutomation.permissionMode}</strong></article>
                  <article><span>Writes</span><strong>{selectedAutomation.mutationPolicy}</strong></article>
                </div>
                <pre className="automation-prompt-preview">{selectedAutomation.prompt}</pre>
                <div className="drawer-section-head">
                  <span>Run history</span>
                  <button data-action-id={`automations.detail.history.${selectedAutomation.id}`} type="button" onClick={() => void props.onLoadRuns(selectedAutomation.id)}>
                    Refresh history
                  </button>
                </div>
                <div className="automation-run-list">
                  {selectedRuns.map((run) => (
                    <article className="automation-run-row" data-run-status={run.status} key={run.id}>
                      <strong>{run.status}</strong>
                      <span>{formatAutomationDate(run.startedAt)} to {formatAutomationDate(run.completedAt)}</span>
                      <small>{run.sessionId ?? run.error ?? "No session"}</small>
                    </article>
                  ))}
                  {selectedRuns.length === 0 ? <p className="empty">No run history loaded.</p> : null}
                </div>
              </>
            ) : (
              <div className="automation-empty-state">
                <strong>Codex is ready for scheduled design work.</strong>
                <span>Create a template automation to run audits, Figma pulls, app-build reviews, or research refreshes from the Studio runtime.</span>
              </div>
            )}
          </section>
        </div>
      </section>

      {modalMode ? (
        <section className="automation-modal" data-automation-editor={modalMode}>
          <form onSubmit={(event) => void submitAutomation(event)}>
            <header>
              <strong>{modalMode === "edit" ? "Edit automation" : "Create automation"}</strong>
              <button data-action-id="automations.editor.close" type="button" onClick={() => setModalMode(null)}>Close</button>
            </header>
            <div className="settings-field-grid">
              <label>
                <span>Template</span>
                <select
                  value={draft.templateId ?? orderedTemplates[0]?.id ?? ""}
                  onChange={(event) => {
                    const template = orderedTemplates.find((candidate) => candidate.id === event.target.value);
                    setDraft(automationDraftFromTemplate(template, props.projectRoot));
                  }}
                >
                  {orderedTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
              </label>
              <label>
                <span>Name</span>
                <input value={draft.name ?? ""} onChange={(event) => patchDraft({ name: event.target.value })} />
              </label>
              <label>
                <span>Schedule</span>
                <input value={draft.rrule ?? ""} onChange={(event) => patchDraft({ rrule: event.target.value })} />
              </label>
              <label>
                <span>Status</span>
                <select value={draft.status ?? "ACTIVE"} onChange={(event) => patchDraft({ status: event.target.value as StudioAutomationDefinition["status"] })}>
                  <option value="ACTIVE">Active</option>
                  <option value="PAUSED">Paused</option>
                </select>
              </label>
              <label>
                <span>Mutation policy</span>
                <select value={draft.mutationPolicy ?? "review"} onChange={(event) => patchDraft({ mutationPolicy: event.target.value as StudioAutomationMutationPolicy })}>
                  <option value="review">Review only</option>
                  <option value="read_only">Read only</option>
                  <option value="allow_writes">Allow writes</option>
                </select>
              </label>
              <label>
                <span>Permission mode</span>
                <select value={draft.permissionMode ?? "plan"} onChange={(event) => patchDraft({ permissionMode: event.target.value as StudioPermissionMode })}>
                  <option value="plan">Plan</option>
                  <option value="guarded">Guarded</option>
                  <option value="full_access">Full access</option>
                </select>
              </label>
              <label>
                <span>Codex model</span>
                <select value={draft.codex?.model ?? "gpt-5.5"} onChange={(event) => patchDraftCodex({ model: event.target.value })}>
                  {CODEX_MODEL_OPTIONS.map((model) => <option key={model} value={model}>{model}</option>)}
                </select>
              </label>
              <label>
                <span>Reasoning</span>
                <select value={draft.codex?.reasoningEffort ?? "xhigh"} onChange={(event) => patchDraftCodex({ reasoningEffort: event.target.value as StudioCodexReasoningEffort })}>
                  {CODEX_REASONING_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
            </div>
            <label className="automation-prompt-field">
              <span>Prompt</span>
              <textarea value={draft.prompt ?? ""} onChange={(event) => patchDraft({ prompt: event.target.value })} />
            </label>
            <div className="inline-actions">
              <button data-action-id="automations.editor.save" type="submit" disabled={props.busyId === "create" || props.busyId === editingId || !draft.prompt?.trim() || !draft.name?.trim()}>
                Save
              </button>
              <button data-action-id="automations.editor.cancel" type="button" onClick={() => setModalMode(null)}>Cancel</button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}

function sortAutomationTemplates(templates: StudioAutomationTemplate[]): StudioAutomationTemplate[] {
  return [...templates].sort((left, right) => {
    const leftIndex = AUTOMATION_TEMPLATE_ORDER.indexOf(left.id);
    const rightIndex = AUTOMATION_TEMPLATE_ORDER.indexOf(right.id);
    return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
  });
}

function automationDraftFromTemplate(template: StudioAutomationTemplate | undefined, projectRoot: string): Partial<StudioAutomationDefinition> & { templateId?: string } {
  return {
    templateId: template?.id ?? "design-system-audit",
    kind: template?.kind ?? "cron",
    name: template?.name ?? "Design System Audit",
    prompt: template?.prompt ?? "Run a Mémoire design-system audit for this workspace.",
    status: "ACTIVE",
    rrule: template?.rrule ?? "FREQ=DAILY;BYHOUR=9;BYMINUTE=0;BYSECOND=0",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago",
    harness: template?.harness ?? "codex",
    action: template?.action ?? "audit",
    chatMode: template?.chatMode ?? "review",
    permissionMode: template?.permissionMode ?? "plan",
    mutationPolicy: template?.mutationPolicy ?? "review",
    codex: normalizeCodexUiConfig(undefined),
    cwd: projectRoot,
  };
}

function rruleSummary(rrule: string): string {
  const parts = Object.fromEntries(rrule.split(";").map((part) => part.split("=")).filter((part) => part.length === 2));
  if (parts.FREQ === "MINUTELY") return `Every ${parts.INTERVAL ?? "1"} minutes`;
  if (parts.FREQ === "WEEKLY") return `Weekly ${parts.BYDAY ?? ""} ${parts.BYHOUR ?? "9"}:${parts.BYMINUTE ?? "00"}`.trim();
  if (parts.FREQ === "DAILY") return `Daily ${parts.BYHOUR ?? "9"}:${String(parts.BYMINUTE ?? "0").padStart(2, "0")}`;
  return rrule;
}

function formatAutomationDate(value: string | null | undefined): string {
  if (!value) return "never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${formatTime(value)}`;
}

export function SettingsPanel(props: {
  open: boolean;
  activeSection: string;
  status: StudioStatus | null;
  config: StudioConfig | null;
  compatibility: StudioCompatibilitySnapshot | null;
  computerStatus: StudioComputerStatus | null;
  figmaStatus: FigmaStatus | null;
  figmaConnecting: boolean;
  harnesses: Harness[];
  marketplaceNotes: MarketplaceNotesPayload | null;
  marketplaceBusyId: string | null;
  marketplaceError: string | null;
  marketplaceDownloadJobs: Record<string, StudioDownloadJob>;
  selectedMarketplaceNoteId: string | null;
  noteForks: NoteForkSummary[];
  selectedNoteForkId: string | null;
  noteForkFiles: NoteForkFile[];
  selectedNoteForkFile: string | null;
  noteForkValidation: NoteForkValidation | null;
  noteForkDiff: NoteForkDiff | null;
  noteForkPrHandoff: NoteForkPrHandoff | null;
  studioTools: StudioToolDefinition[];
  browserStatus: StudioBrowserStatus | null;
  onClose: () => void;
  onSectionChange: (section: string) => void;
  onRefresh: () => void | Promise<void>;
  onRefreshMarketplace: () => void | Promise<void>;
  onInstallMarketplaceNote: (noteId: string) => void | Promise<void>;
  onRemoveMarketplaceNote: (name: string) => void | Promise<void>;
  onForkMarketplaceNote: (noteId: string) => void | Promise<void>;
  onMarketplaceSelectionChange: (noteId: string) => void;
  onSelectNoteFork: (name: string) => void | Promise<void>;
  onSelectNoteForkFile: (path: string) => void;
  onUpdateNoteForkFile: (path: string, content: string) => void | Promise<void>;
  onValidateNoteFork: () => void | Promise<void>;
  onExportNoteForkPr: () => void | Promise<void>;
  onOpenAutomationsCenter: () => void;
  onPatchConfig: (update: (current: StudioConfig) => StudioConfig) => void;
  onSave: () => void;
  onComputerCapture: () => void;
  onConnectFigma: () => void | Promise<void>;
  onOpenFigma: () => void | Promise<void>;
  onOpenMacOSPermission: (permission: string) => void | Promise<void>;
  onSelectHarness: (id: Harness["id"]) => void;
  onSelectWorkspace: () => void | Promise<void>;
  onCompleteSetup: () => void | Promise<void>;
}) {
  if (!props.open) return null;
  const sections = ["Setup", "General", "Codex", "Agents", "Providers", "Permissions", "Figma", "Plugins", "Automations", "Download", "Advanced"];
  const downloadItems = buildDownloadReadyItems({ status: props.status, config: props.config });
  const harnessRows = props.compatibility?.harnesses ?? props.harnesses.map((harness) => ({
    id: harness.id,
    label: harness.label,
    setupStatus: harness.installed ? "ready" : "needs_action",
    setupAction: harness.installed ? "Ready" : `Install ${harness.command}`,
    setupCommand: harness.installed ? null : `Install ${harness.command}`,
    authStatus: harness.authStatus ?? (harness.installed ? "ready" : "missing"),
    authMessage: harness.authMessage ?? (harness.installed ? "Ready" : `Run ${harness.command} login`),
    installed: harness.installed,
    enabled: harness.enabled,
  }));
  const coreHarnessRows = harnessRows.filter((harness) => isCoreHarness(harness.id));
  const codexHarness = coreHarnessRows.find((harness) => harness.id === "codex");
  const codexConfig = normalizeCodexUiConfig(props.config?.codex);
  const providers = props.config?.providers ?? {};
  const permissions = props.computerStatus?.permissions ?? props.config?.computer?.permissions ?? {
    accessibility: "unknown",
    screenRecording: "unknown",
    automation: "unknown",
    fileAccess: "unknown",
  };
  const [marketplaceQuery, setMarketplaceQuery] = useState("");
  const [marketplaceCategoryFilter, setMarketplaceCategoryFilter] = useState("all");
  const [marketplaceSourceFilter, setMarketplaceSourceFilter] = useState("all");

  function patchCodexConfig(update: Partial<StudioCodexConfig>) {
    props.onPatchConfig((current) => ({
      ...current,
      codex: {
        ...normalizeCodexUiConfig(current.codex),
        ...update,
      },
    }));
  }

  function renderGeneral() {
    return (
      <div className="settings-general-surface" data-settings-section-content="general">
        <div className="settings-section-grid">
          <article data-setup-completion="first-run"><span>Setup</span><strong>{props.config?.setup?.completedAt ? "complete" : "needs setup"}</strong></article>
          <article><span>Input</span><strong>{props.config?.ui?.inputMode ?? "agent"}</strong></article>
          <article><span>Harnesses</span><strong>{coreHarnessRows.filter((harness) => harness.enabled).length}</strong></article>
          <article><span>Computer</span><strong>{props.computerStatus?.available ? "ready" : "limited"}</strong></article>
        </div>
        <div className="settings-field-grid">
          <label>
            <span>Default harness</span>
            <select value={isCoreHarness(props.config?.defaultHarness ?? "codex") ? props.config?.defaultHarness ?? "codex" : "codex"} onChange={(event) => props.onPatchConfig((current) => ({ ...current, defaultHarness: event.target.value as Harness["id"] }))}>
              {props.harnesses.map((harness) => <option key={harness.id} value={harness.id}>{harness.label}</option>)}
            </select>
          </label>
          <label>
            <span>Input mode</span>
            <select value={props.config?.ui?.inputMode ?? "agent"} onChange={(event) => props.onPatchConfig((current) => ({
              ...current,
              ui: {
                theme: current.ui?.theme ?? "dark",
                inputMode: event.target.value as StudioInputMode,
                commandPaletteEnabled: current.ui?.commandPaletteEnabled ?? true,
                toolbeltLayout: current.ui?.toolbeltLayout ?? "compact",
              },
            }))}>
              <option value="agent">Agent</option>
              <option value="terminal">Terminal</option>
              <option value="auto">Auto</option>
            </select>
          </label>
        </div>
      </div>
    );
  }

  function renderCodex() {
    const workspaceRoots = props.config?.workspaceRoots ?? [];
    const codexAuthMessage = codexHarness && "authMessage" in codexHarness && typeof codexHarness.authMessage === "string"
      ? codexHarness.authMessage
      : "Run codex login --device-auth";
    return (
      <div className="codex-settings-surface" data-settings-section-content="codex">
        <div className="settings-section-grid">
          <article data-codex-auth="status">
            <span>Codex auth</span>
            <strong>{codexHarness?.authStatus ?? "checking"}</strong>
            <small>{codexAuthMessage}</small>
          </article>
          <article>
            <span>Model</span>
            <strong>{codexConfig.model}</strong>
            <small>model_reasoning_effort={codexConfig.reasoningEffort}</small>
          </article>
          <article>
            <span>Repositories</span>
            <strong>{workspaceRoots.length}</strong>
            <small>{props.status?.projectRoot ?? workspaceRoots[0] ?? "No workspace"}</small>
          </article>
          <article>
            <span>Plan default</span>
            <strong>{codexConfig.planModeDefault ? "on" : "off"}</strong>
            <small>read-only first pass</small>
          </article>
        </div>
        <div className="settings-field-grid">
          <label>
            <span>Codex model</span>
            <select value={codexConfig.model} onChange={(event) => patchCodexConfig({ model: event.target.value })}>
              {CODEX_MODEL_OPTIONS.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
          </label>
          <label>
            <span>Thinking</span>
            <select value={codexConfig.reasoningEffort} onChange={(event) => patchCodexConfig({ reasoningEffort: event.target.value as StudioCodexReasoningEffort })}>
              {CODEX_REASONING_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span>Approval</span>
            <select value={codexConfig.approvalPolicy} onChange={(event) => patchCodexConfig({ approvalPolicy: event.target.value as StudioCodexApprovalPolicy })}>
              {CODEX_APPROVAL_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
        </div>
        <div className="settings-toggle-list">
          <label className="checkbox-row">
            <input type="checkbox" checked={codexConfig.planModeDefault} onChange={(event) => patchCodexConfig({ planModeDefault: event.target.checked })} />
            <span>Use plan mode by default for new Codex runs</span>
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={codexConfig.webSearch} onChange={(event) => patchCodexConfig({ webSearch: event.target.checked })} />
            <span>Enable Codex live web search for research and audit actions</span>
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={codexConfig.skipGitRepoCheck} onChange={(event) => patchCodexConfig({ skipGitRepoCheck: event.target.checked })} />
            <span>Allow non-git repositories with --skip-git-repo-check</span>
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={codexConfig.includeMemoireCommands} onChange={(event) => patchCodexConfig({ includeMemoireCommands: event.target.checked })} />
            <span>Inject Mémoire command ladder into Codex prompts</span>
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={codexConfig.includeCodexCommands} onChange={(event) => patchCodexConfig({ includeCodexCommands: event.target.checked })} />
            <span>Inject Codex readiness commands into prompts</span>
          </label>
        </div>
        <div className="setup-list" data-codex-repositories="workspaceRoots">
          {workspaceRoots.map((root) => (
            <article className="setup-action-row" key={root}>
              <strong>{compactName(root)}</strong>
              <span>{root}</span>
              <div className="inline-actions">
                <button data-action-id={`settings.codex.copy-repository.${root}`} type="button" onClick={() => void copyText(root)}>Copy path</button>
              </div>
            </article>
          ))}
          {workspaceRoots.length === 0 ? <span className="empty">No repositories configured.</span> : null}
        </div>
        <div className="inline-actions">
          <button data-action-id="settings.codex.login" type="button" onClick={() => void copyText("codex login --device-auth")}>Copy login command</button>
          <button data-action-id="settings.codex.add-repository" type="button" onClick={props.onSelectWorkspace}>Add repository</button>
        </div>
      </div>
    );
  }

  function renderAgents() {
    return (
      <div className="setup-list" data-settings-section-content="agents">
        {coreHarnessRows.map((harness) => (
          <article className="setup-action-row" key={harness.id}>
            <strong>{harness.label}</strong>
            <span>{harness.setupStatus} · {harness.setupAction}</span>
            <div className="inline-actions">
              <button data-action-id={`settings.harness.select.${harness.id}`} type="button" onClick={() => props.onSelectHarness(harness.id)}>Use</button>
              {harness.setupCommand ? <button data-action-id={`settings.harness.copy.${harness.id}`} type="button" onClick={() => void copyText(harness.setupCommand ?? "")}>Copy command</button> : null}
            </div>
          </article>
        ))}
      </div>
    );
  }

  function renderProviders() {
    return (
      <div className="settings-field-grid" data-settings-section-content="providers">
        <article><strong>Anthropic</strong><span>{providers.anthropic?.enabled ? providers.anthropic.envKey : "disabled"}</span></article>
        <article><strong>OpenAI</strong><span>{providers.openai?.enabled ? providers.openai.envKey : "disabled"}</span></article>
        <article><strong>Ollama</strong><span>{providers.ollama?.baseUrl ?? "http://127.0.0.1:11434"}</span></article>
      </div>
    );
  }

  function renderPermissions() {
    return (
      <>
        <div className="settings-field-grid" data-settings-section-content="permissions">
          <label>
            <span>Shell policy</span>
            <select value={props.config?.permissions?.shell ?? "approval"} onChange={(event) => props.onPatchConfig((current) => ({
              ...current,
              permissions: {
                workspaceWrite: current.permissions?.workspaceWrite ?? "approval",
                shell: event.target.value as "allow" | "approval" | "block",
                computer: current.permissions?.computer ?? "approval",
                figma: current.permissions?.figma ?? "allow",
                allowlist: current.permissions?.allowlist ?? [],
                denylist: current.permissions?.denylist ?? [],
              },
            }))}>
              <option value="approval">Approval</option>
              <option value="allow">Allow</option>
              <option value="block">Block</option>
            </select>
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={props.config?.computer?.enabled ?? false} onChange={(event) => props.onPatchConfig((current) => ({
              ...current,
              computer: {
                enabled: event.target.checked,
                allowedApps: current.computer?.allowedApps ?? ["Figma"],
                requireApproval: current.computer?.requireApproval ?? true,
                permissions: current.computer?.permissions ?? {
                  accessibility: "unknown",
                  screenRecording: "unknown",
                  automation: "unknown",
                  fileAccess: "unknown",
                },
              },
            }))} />
            <span>Enable Computer</span>
          </label>
        </div>
        <div className="permission-grid">
          {Object.entries(permissions).map(([permission, value]) => (
            <button data-action-id={`settings.permission.${permission}`} key={permission} type="button" onClick={() => props.onOpenMacOSPermission(permission)}>
              <strong>{permissionLabel(permission)}</strong>
              <span>{value}</span>
            </button>
          ))}
        </div>
      </>
    );
  }

  function renderFigma() {
    return (
      <div className="setup-card" data-settings-section-content="figma">
        <span>Figma</span>
        <strong>{figmaStatusLabel(props.figmaStatus)}</strong>
        <p>{props.compatibility?.tools.figma.setupAction ?? "Start the bridge and connect the plugin."}</p>
        <div className="inline-actions">
          <button data-action-id="figma.connect" type="button" onClick={props.onConnectFigma} disabled={props.figmaConnecting}>{props.figmaConnecting ? "Starting" : "Start bridge"}</button>
          <button data-action-id="figma.open" type="button" onClick={props.onOpenFigma}>Open Figma</button>
        </div>
      </div>
    );
  }

  function renderPlugins() {
    const notes = props.marketplaceNotes?.notes ?? [];
    const summary = props.marketplaceNotes?.summary;
    const categories = Object.keys(summary?.categories ?? {}).sort();
    const filteredNotes = notes.filter((note) => {
      const categoryMatch = marketplaceCategoryFilter === "all" || note.category === marketplaceCategoryFilter;
      const sourceMatch = marketplaceSourceFilter === "all" || marketplaceSourceBucket(note) === marketplaceSourceFilter;
      const query = marketplaceQuery.trim().toLowerCase();
      if (!query) return categoryMatch && sourceMatch;
      const haystack = `${note.title} ${note.name} ${note.description} ${note.tags.join(" ")} ${note.category}`.toLowerCase();
      return categoryMatch && sourceMatch && haystack.includes(query);
    });
    const selectedMarketplaceNote = notes.find((note) => note.id === props.selectedMarketplaceNoteId)
      ?? filteredNotes[0]
      ?? notes[0]
      ?? null;
    const note = selectedMarketplaceNote;
    const selectedDownloadJob = note ? props.marketplaceDownloadJobs[note.id] : null;
    const selectedFork = props.noteForks.find((fork) => fork.name === props.selectedNoteForkId) ?? props.noteForks[0] ?? null;
    const selectedForkFile = props.noteForkFiles.find((file) => file.path === props.selectedNoteForkFile) ?? props.noteForkFiles[0] ?? null;
    const sourceFilters = [
      { id: "all", label: "All" },
      { id: "official", label: "Official" },
      { id: "community", label: "Community" },
      { id: "installed", label: "Installed" },
      { id: "forks", label: "Forks" },
      { id: "updates", label: "Updates" },
    ];
    return (
      <div className="plugins-settings-surface" data-settings-section-content="plugins" data-marketplace-notes="memoire-notes" data-plugin-marketplace-layout="vscode-split">
        <div className="drawer-section-head">
          <span>Marketplace</span>
          <button data-action-id="settings.plugins.refresh" type="button" onClick={() => void props.onRefreshMarketplace()}>Refresh</button>
        </div>
        {props.marketplaceError ? <p className="error">{props.marketplaceError}</p> : null}
        <div className="marketplace-layout">
          <aside className="marketplace-filter-rail" data-marketplace-filter-rail="notes">
            <label>
              <span>Search</span>
              <input value={marketplaceQuery} onChange={(event) => setMarketplaceQuery(event.target.value)} placeholder="Search Marketplace" />
            </label>
            <div className="marketplace-stats">
              <article><span>Total</span><strong>{summary?.total ?? notes.length}</strong></article>
              <article><span>Installed</span><strong>{summary?.installed ?? notes.filter((note) => note.installed).length}</strong></article>
              <article><span>Installable</span><strong>{summary?.installable ?? notes.filter((note) => note.installable).length}</strong></article>
            </div>
            <nav aria-label="Marketplace categories">
              <button className={marketplaceCategoryFilter === "all" ? "active" : ""} type="button" onClick={() => setMarketplaceCategoryFilter("all")}>All</button>
              {categories.map((category) => (
                <button className={marketplaceCategoryFilter === category ? "active" : ""} key={category} type="button" onClick={() => setMarketplaceCategoryFilter(category)}>
                  {category}
                </button>
              ))}
            </nav>
            <nav aria-label="Marketplace sources" data-marketplace-source-filter="official-community-forks">
              {sourceFilters.map((filter) => (
                <button className={marketplaceSourceFilter === filter.id ? "active" : ""} key={filter.id} type="button" onClick={() => setMarketplaceSourceFilter(filter.id)}>
                  {filter.label}
                </button>
              ))}
            </nav>
            <small>{props.marketplaceNotes?.remote?.status ?? "offline"} remote / {props.marketplaceNotes?.community?.status ?? "offline"} community</small>
          </aside>
          <div className="marketplace-note-results" data-marketplace-note-results="dense-list">
            {filteredNotes.map((note) => {
              const job = props.marketplaceDownloadJobs[note.id];
              return (
                <button
                  className={selectedMarketplaceNote?.id === note.id ? "marketplace-result-row active" : "marketplace-result-row"}
                  data-note-source={note.source}
                  key={note.id}
                  type="button"
                  onClick={() => props.onMarketplaceSelectionChange(note.id)}
                >
                  <span>
                    <strong>{note.title}</strong>
                    <small>{note.name} / {note.version} / {marketplaceSourceLabel(note.source)}</small>
                  </span>
                  <p>{note.description}</p>
                  <span className="marketplace-result-meta">
                    <small>{note.category}</small>
                    <small>{marketplaceSourceBucket(note)}</small>
                    <small>{marketplaceNoteFreshness(note)}</small>
                    {job ? <small>{job.status} {job.progress}%</small> : null}
                  </span>
                </button>
              );
            })}
            {!props.marketplaceNotes ? <p className="empty">Plugin catalog not loaded.</p> : null}
            {props.marketplaceNotes && filteredNotes.length === 0 ? <p className="empty">No Mémoire Notes found.</p> : null}
          </div>
          <section className="marketplace-note-detail" data-marketplace-note-detail="quick-install">
            {note ? (
              <>
                <div>
                  <span>{note.category} / {note.version}</span>
                  <h3>{note.title}</h3>
                  <p>{note.description}</p>
                  <small title={note.sourcePath}>{displaySourceLabel(note.sourcePath)}</small>
                </div>
                <div className="marketplace-note-actions">
                  {note.tags.slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                <div className="marketplace-detail-grid">
                  <article><span>Source</span><strong>{marketplaceSourceLabel(note.source)}</strong></article>
                  <article><span>Freshness</span><strong>{marketplaceNoteFreshness(note)}</strong></article>
                  <article><span>Install</span><strong>{note.installed ? "installed" : note.installable ? "available" : "locked"}</strong></article>
                </div>
                {note.sourceRepo || note.contributionUrl ? (
                  <div className="marketplace-detail-grid">
                    <article><span>Review</span><strong>{note.reviewStatus ?? "official"}</strong></article>
                    <article><span>Repo</span><strong>{note.sourceRepo ? displaySourceLabel(note.sourceRepo) : "community"}</strong></article>
                    <article><span>Forkable</span><strong>{note.isForkable ? "yes" : "install first"}</strong></article>
                  </div>
                ) : null}
                {selectedDownloadJob ? (
                  <div className="marketplace-progress">
                    <span>{selectedDownloadJob.message}</span>
                    <progress value={selectedDownloadJob.progress} max={100} />
                  </div>
                ) : null}
                <div className="inline-actions">
                  {note.installable && !note.installed ? (
                    <button data-action-id={`settings.plugins.install.${note.id}`} type="button" onClick={() => void props.onInstallMarketplaceNote(note.id)} disabled={props.marketplaceBusyId === note.id}>
                      {props.marketplaceBusyId === note.id ? "Installing" : "Install"}
                    </button>
                  ) : null}
                  {note.installed && !note.builtIn ? (
                    <button data-action-id={`settings.plugins.remove.${note.name}`} type="button" onClick={() => void props.onRemoveMarketplaceNote(note.name)} disabled={props.marketplaceBusyId === note.name}>
                      Remove
                    </button>
                  ) : null}
                  {note.isForkable ? (
                    <button data-action-id={`settings.plugins.fork.${note.id}`} type="button" onClick={() => void props.onForkMarketplaceNote(note.id)} disabled={props.marketplaceBusyId === note.id}>
                      Fork
                    </button>
                  ) : null}
                  <button data-action-id={`settings.plugins.copy-install.${note.name}`} type="button" onClick={() => void copyText(`memi notes install ${note.name}`)}>Copy command</button>
                  {note.contributionUrl ? <button data-action-id={`settings.plugins.improve.${note.name}`} type="button" onClick={() => void copyText(note.contributionUrl ?? "")}>Improve this Note</button> : null}
                </div>
              </>
            ) : (
              <p className="empty">Select a Note to view details.</p>
            )}
          </section>
        </div>
        <section className="note-fork-editor" data-note-fork-editor="markdown-review">
          <div className="drawer-section-head">
            <span>Fork Review</span>
            <div className="inline-actions">
              <button type="button" onClick={() => void props.onValidateNoteFork()} disabled={!selectedFork}>Validate</button>
              <button type="button" onClick={() => void props.onExportNoteForkPr()} disabled={!selectedFork}>Submit for Review</button>
            </div>
          </div>
          {selectedFork ? (
            <div className="note-fork-layout">
              <aside>
                {props.noteForks.map((fork) => (
                  <button className={selectedFork.name === fork.name ? "active" : ""} key={fork.name} type="button" onClick={() => void props.onSelectNoteFork(fork.name)}>
                    <strong>{fork.name}</strong>
                    <small>{fork.reviewStatus} / forked from {fork.forkOf.name}</small>
                  </button>
                ))}
                {props.noteForkFiles.map((file) => (
                  <button className={selectedForkFile?.path === file.path ? "active" : ""} key={file.path} type="button" onClick={() => props.onSelectNoteForkFile(file.path)}>
                    {file.path}
                  </button>
                ))}
              </aside>
              <div>
                {selectedForkFile ? (
                  <textarea
                    aria-label="Note fork markdown editor"
                    defaultValue={selectedForkFile.content}
                    key={`${selectedFork?.name ?? "fork"}:${selectedForkFile.path}`}
                    onBlur={(event) => void props.onUpdateNoteForkFile(selectedForkFile.path, event.target.value)}
                  />
                ) : <p className="empty">Select a fork file.</p>}
              </div>
              <aside>
                <strong>Validation</strong>
                {props.noteForkValidation ? (
                  <p>{props.noteForkValidation.ok ? "Ready for review" : `${props.noteForkValidation.issues.length} issue(s)`}</p>
                ) : <p>No validation run.</p>}
                <strong>Diff</strong>
                <p>{props.noteForkDiff ? `${props.noteForkDiff.files.length} changed file(s)` : "No diff loaded."}</p>
                <strong>PR handoff</strong>
                {props.noteForkPrHandoff ? <pre>{props.noteForkPrHandoff.commands.join("\n")}</pre> : <p>Validate and submit to generate commands.</p>}
              </aside>
            </div>
          ) : (
            <p className="empty">Fork a Note to edit and submit community improvements.</p>
          )}
        </section>
      </div>
    );
  }

  function renderAutomationsSettings() {
    return (
      <div className="automations-settings-surface" data-settings-section-content="automations" data-settings-automations="launcher">
        <div className="settings-section-grid">
          <article><span>Scheduler</span><strong>Studio runtime</strong><small>LaunchAgent managed by Automations Center.</small></article>
          <article><span>Templates</span><strong>4</strong><small>Audit, Figma pull, build review, research refresh.</small></article>
          <article><span>Runs</span><strong>Local</strong><small>Sessions stay in this workspace history.</small></article>
          <article><span>Writes</span><strong>Policy bound</strong><small>Each automation carries a mutation policy.</small></article>
        </div>
        <div className="setup-card">
          <span>Automations</span>
          <strong>Scheduled design harness work</strong>
          <p>Create, pause, run, inspect history, and manage the local scheduler.</p>
          <div className="inline-actions">
            <button data-action-id="settings.automations.open" type="button" onClick={props.onOpenAutomationsCenter}>Open Automations Center</button>
          </div>
        </div>
      </div>
    );
  }

  function renderAdvanced() {
    const enabledTools = props.studioTools.filter((tool) => tool.enabled);
    return (
      <div className="advanced-settings-surface" data-settings-section-content="advanced" data-settings-advanced="tools-browser">
        <div className="settings-section-grid">
          <article><span>Tools</span><strong>{enabledTools.length}/{props.studioTools.length}</strong><small>Runtime tool broker</small></article>
          <article><span>Browser</span><strong>{props.browserStatus?.enabled ? "enabled" : "disabled"}</strong><small>{props.browserStatus?.message ?? "Browser status unavailable"}</small></article>
          <article><span>Sessions</span><strong>{props.browserStatus?.activeSessions ?? 0}</strong><small>Browser automation sessions</small></article>
          <article><span>MCP</span><strong>{props.config?.enabledTools?.mcp ? "enabled" : "disabled"}</strong><small>External agent bridge tools</small></article>
        </div>
        <div className="agentic-pattern-source-list" data-agentic-pattern-source="settings-advanced">
          {FALLBACK_AGENTIC_OPEN_SOURCE_REFERENCES.map((reference) => (
            <article className="agentic-pattern-source-card" data-agentic-pattern-source={reference.name} key={reference.name}>
              <strong>{reference.name}</strong>
              <span>{reference.license} / {reference.category}</span>
              <small>{reference.mappedRoles.join(" / ")}</small>
            </article>
          ))}
        </div>
        <div className="setup-list compact" data-advanced-tool-list="studio-tools">
          {props.studioTools.map((tool) => (
            <article className="setup-action-row" key={tool.id}>
              <strong>{tool.label}</strong>
              <span>{tool.category} / {tool.enabled ? "enabled" : "disabled"} / {tool.requiresApproval ? "approval" : "direct"}</span>
              <div className="inline-actions">
                <button data-action-id={`settings.advanced.copy-tool.${tool.id}`} type="button" onClick={() => void copyText(tool.id)}>Copy id</button>
              </div>
            </article>
          ))}
          {props.studioTools.length === 0 ? <span className="empty">No Studio tools reported by the runtime.</span> : null}
        </div>
      </div>
    );
  }

  function renderDownload() {
    return (
      <div className="download-ready-panel" data-download-ready="settings-about" data-settings-section-content="download">
        <div className="drawer-section-head">
          <span>Download Ready</span>
          <button data-action-id="download.copy-dmg-path" type="button" onClick={() => void copyText(expectedDmgPath(props.status))}>Copy DMG path</button>
        </div>
        <div className="download-ready-list" data-download-ready="macos-dmg">
          {downloadItems.map((item) => <article key={item.id}><strong>{item.label}</strong><span>{item.detail}</span></article>)}
        </div>
      </div>
    );
  }

  function renderSetup() {
    return (
      <section className="settings-setup-surface" data-settings-setup="macos-download-readiness">
        <div className="setup-card" data-setup-step="install-source">
          <span>Welcome</span>
          <strong>@sarveshsea/memoire@0.16.3</strong>
          <p>{props.status?.projectRoot ?? "Waiting for Studio runtime"}</p>
        </div>
        <div className="setup-card" data-setup-step="workspace">
          <span>Workspace</span>
          <strong>{props.config?.workspaceRoots?.[0] ?? props.status?.projectRoot ?? "No workspace"}</strong>
          <p>Local runs, memory, and history use this root.</p>
          <div className="inline-actions">
            <button data-action-id="workspace.change" type="button" onClick={props.onSelectWorkspace}>Change workspace</button>
          </div>
        </div>
        {renderAgents()}
        {renderProviders()}
        {renderFigma()}
        {renderPermissions()}
        {renderDownload()}
        <div className="settings-actions">
          <span>{props.config?.setup?.completedAt ? `completed ${props.config.setup.completedAt}` : "setup state not completed"}</span>
          <button className="primary" data-action-id="setup.finish" type="button" onClick={props.onCompleteSetup}>Mark setup complete</button>
        </div>
      </section>
    );
  }

  function renderSection() {
    if (props.activeSection === "Setup") return renderSetup();
    if (props.activeSection === "Codex") return renderCodex();
    if (props.activeSection === "Agents") return renderAgents();
    if (props.activeSection === "Providers") return renderProviders();
    if (props.activeSection === "Permissions") return renderPermissions();
    if (props.activeSection === "Figma") return renderFigma();
    if (props.activeSection === "Plugins") return renderPlugins();
    if (props.activeSection === "Automations") return renderAutomationsSettings();
    if (props.activeSection === "Download") return renderDownload();
    if (props.activeSection === "Advanced") return renderAdvanced();
    return renderGeneral();
  }

  return (
    <div className="modal-backdrop settings-backdrop" data-settings-panel="warp-style" data-user-settings="studio-settings" role="dialog" aria-modal="true" aria-label="Studio settings">
      <section className="settings-panel">
        <aside>
          <strong>Settings</strong>
          {sections.map((section) => (
            <button
              className={props.activeSection === section ? "active" : ""}
              data-action-id={`settings.section.${section.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              key={section}
              type="button"
              onClick={() => props.onSectionChange(section)}
            >
              {section}
            </button>
          ))}
        </aside>
        <main>
          <header>
            <div>
              <p className="eyebrow">{props.activeSection}</p>
              <h2>Studio Settings</h2>
            </div>
            <div className="inline-actions">
              <button data-action-id="runtime.refresh" type="button" onClick={props.onRefresh}>Refresh</button>
              <button data-action-id="settings.close" type="button" onClick={props.onClose}>Close</button>
              <button className="primary" data-action-id="settings.save" type="button" onClick={props.onSave} disabled={!props.config}>Save</button>
            </div>
          </header>
          {renderSection()}
          <div className="settings-actions">
            <span>{props.computerStatus?.message ?? "Computer state unavailable"}</span>
            <button data-action-id="computer.action" type="button" onClick={props.onComputerCapture}>
              Check screen permission
            </button>
          </div>
        </main>
      </section>
    </div>
  );
}

export function BlockBody({ block }: { block: TerminalBlock }) {
  if (block.events.some((event) => event.type === "token_usage")) return <TokenUsageStrip block={block} />;
  if (block.kind === "command_trace") return <CommandTraceBlock block={block} />;
  if (block.kind === "session_result" || block.events.some((event) => ["research_note", "design_decision", "artifact", "design_system_artifact", "acceptance_statement"].includes(event.type) || Boolean(asEventRecord(event.data).sectionLabel))) {
    return (
      <div className="result-body" data-structured-result="sectioned">
        <StructuredResultSections block={block} />
        {block.data ? <details className="result-details">
          <summary>Data</summary>
          <pre className="result-pre">{formatDataPreview(block.data)}</pre>
        </details> : null}
      </div>
    );
  }
  return <TuiInlineBlock block={block} />;
}

export function StructuredResultSections({ block }: { block: TerminalBlock }) {
  const sections = resultSectionsForBlock(block);
  return (
    <div className="structured-result-sections">
      {sections.map((section, index) => (
        <article className="result-section" data-result-section={section.label} key={`${section.label}-${index}`}>
          <strong>{resultSectionTitle(section.label, section.message)}</strong>
          <FormattedMessage text={resultSectionBody(section.label, section.message)} />
        </article>
      ))}
    </div>
  );
}

export function CommandTraceBlock({ block }: { block: TerminalBlock }) {
  const commandEvent = block.events.find((event) => event.type === "terminal_command");
  const outputEvent = block.events.find((event) => event.type === "terminal_output");
  const data = asEventRecord(outputEvent?.data ?? commandEvent?.data);
  const exitCode = typeof data.exit_code === "number" ? `exit ${data.exit_code}` : pickEventString(data, "status") ?? "command";
  const command = commandEvent?.message ?? block.messages[0];
  const output = stripAnsi(outputEvent?.message.trim() ?? "");
  return (
    <div className="command-trace-block">
      <div className="command-row" data-command-state={exitCode}>
        <span>cmd</span>
        <code title={command}>{command}</code>
        <small>{exitCode}</small>
      </div>
      {output ? (
        <details className="tui-inline" data-tui-inline="command-output">
          <summary>{trimText(firstMeaningfulLine(output), 86)}</summary>
          <pre>{output}</pre>
        </details>
      ) : null}
    </div>
  );
}

export function TuiInlineBlock({ block }: { block: TerminalBlock }) {
  const output = stripAnsi(block.messages.join("\n").trimEnd() || block.title);
  const preview = firstMeaningfulLine(output);
  const longOutput = output.split(/\r?\n/).length > 8 || output.length > 520;
  if (!longOutput) return <pre className="tui-output" data-tui-inline="plain">{output}</pre>;
  return (
    <details className="tui-inline" data-tui-inline="collapsible">
      <summary>{trimText(preview, 110)}</summary>
      <pre>{output}</pre>
    </details>
  );
}

export function TokenUsageStrip({ block }: { block: TerminalBlock }) {
  const data = asEventRecord(block.events[0]?.data);
  const usage = asEventRecord(data.usage);
  const pairs = Object.entries(usage).filter(([, value]) => typeof value === "number");
  return (
    <div className="token-usage-strip">
      {pairs.length ? pairs.map(([key, value]) => <span key={key}>{eventLabel(key)} {String(value)}</span>) : <span>{block.messages.join("").trim() || "Token usage"}</span>}
    </div>
  );
}

export function FormattedMessage({ text }: { text: string }) {
  const nodes = formattedNodes(text);
  return (
    <div className="formatted-message">
      {nodes.map((node, index) => {
        if (node.kind === "table") return <FormattedTable key={index} rows={node.rows} />;
        if (node.kind === "heading") return <h4 key={index}>{formatInlineMessage(node.text)}</h4>;
        return node.kind === "li"
          ? <li key={index}>{formatInlineMessage(node.text)}</li>
          : <p key={index}>{formatInlineMessage(node.text)}</p>;
      })}
    </div>
  );
}

type FormattedNode =
  | { kind: "p" | "li" | "heading"; text: string }
  | { kind: "table"; rows: string[][] };

function formattedNodes(text: string): FormattedNode[] {
  const nodes: FormattedNode[] = [];
  let tableRows: string[][] = [];

  function flushTable() {
    if (tableRows.length > 0) nodes.push({ kind: "table", rows: tableRows });
    tableRows = [];
  }

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushTable();
      continue;
    }
    if (isMarkdownTableLine(trimmed)) {
      if (!isMarkdownTableSeparator(trimmed)) tableRows.push(markdownTableCells(trimmed));
      continue;
    }
    flushTable();
    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      nodes.push({ kind: "li", text: bullet[1] });
      continue;
    }
    const heading = trimmed.replace(/^#{1,6}\s+/, "");
    nodes.push({ kind: looksLikeResultHeading(heading) ? "heading" : "p", text: heading });
  }
  flushTable();
  return nodes;
}

function FormattedTable({ rows }: { rows: string[][] }) {
  const [head, ...body] = rows;
  if (!head) return null;
  return (
    <div className="result-table-wrap">
      <table className="result-table">
        {body.length ? (
          <thead>
            <tr>{head.map((cell, index) => <th key={index}>{formatInlineMessage(cell)}</th>)}</tr>
          </thead>
        ) : null}
        <tbody>
          {(body.length ? body : [head]).map((row, rowIndex) => (
            <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{formatInlineMessage(cell)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatInlineMessage(text: string) {
  return inlineParts(text).map((part, index) => {
    if (part.kind === "link") return <FileReferenceChip key={index} label={part.label} path={part.target} />;
    if (part.kind === "code") return <code key={index}>{part.text}</code>;
    return <span key={index}>{part.text}</span>;
  });
}

type InlinePart =
  | { kind: "text" | "code"; text: string }
  | { kind: "link"; label: string; target: string };

function inlineParts(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let index = 0;
  while (index < text.length) {
    const codeStart = text.indexOf("`", index);
    const linkStart = text.indexOf("[", index);
    const nextStart = [codeStart, linkStart].filter((value) => value >= 0).sort((left, right) => left - right)[0] ?? -1;
    if (nextStart < 0) {
      if (index < text.length) parts.push({ kind: "text", text: text.slice(index) });
      break;
    }
    if (nextStart > index) parts.push({ kind: "text", text: text.slice(index, nextStart) });
    if (nextStart === codeStart) {
      const codeEnd = text.indexOf("`", codeStart + 1);
      if (codeEnd < 0) {
        parts.push({ kind: "text", text: text.slice(codeStart) });
        break;
      }
      parts.push({ kind: "code", text: text.slice(codeStart + 1, codeEnd) });
      index = codeEnd + 1;
      continue;
    }
    const link = readMarkdownLink(text, linkStart);
    if (!link) {
      parts.push({ kind: "text", text: text.slice(linkStart, linkStart + 1) });
      index = linkStart + 1;
      continue;
    }
    parts.push({ kind: "link", label: link.label, target: link.target });
    index = link.end;
  }
  return parts;
}

function readMarkdownLink(text: string, start: number): { label: string; target: string; end: number } | null {
  const labelEnd = text.indexOf("](", start);
  if (labelEnd < 0) return null;
  const targetStart = labelEnd + 2;
  let depth = 0;
  for (let cursor = targetStart; cursor < text.length; cursor += 1) {
    const char = text[cursor];
    if (char === "(") depth += 1;
    if (char === ")") {
      if (depth === 0) return { label: text.slice(start + 1, labelEnd), target: text.slice(targetStart, cursor), end: cursor + 1 };
      depth -= 1;
    }
  }
  return null;
}

export function FileReferenceChip({ label, path }: { label: string; path: string }) {
  const compact = compactFileLabel(label, path);
  return (
    <button
      className="file-reference-chip file-chip"
      data-action-id={`source-ref.copy.${actionIdSegment(path)}`}
      title={path}
      type="button"
      onClick={() => void navigator.clipboard?.writeText(path)}
    >
      {compact}
    </button>
  );
}

function actionIdSegment(value: string): string {
  return value
    .replace(/^file:\/\//u, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 72) || "item";
}

function resultSectionsForBlock(block: TerminalBlock): Array<{ label: string; message: string }> {
  if (block.events.length === 1) {
    const event = block.events[0];
    const data = asEventRecord(event.data);
    const sectionLabel = pickEventString(data, "sectionLabel") ?? event.type;
    const raw = pickEventString(data, "rawResult");
    if (event.type === "session_result" && raw) return parseResultSections(raw);
    if (["research_note", "design_decision", "tool_call", "artifact", "design_system_artifact", "session_result", "acceptance_statement"].includes(event.type) || data.sectionLabel) {
      return [{ label: sectionLabel, message: event.message }];
    }
  }
  const parsed = parseResultSections(block.messages.join("\n"));
  return parsed.length ? parsed : [{ label: block.title, message: block.messages.join("\n").trim() || block.title }];
}

function parseResultSections(text: string): Array<{ label: string; message: string }> {
  const pattern = /^\s*(?:[-*]\s*)?(?:#{1,6}\s*)?(?:\*\*)?([A-Za-z][A-Za-z0-9 _/-]{2,64})(?:\*\*)?\s*:?\s*(.*)$/;
  const sections: Array<{ label: string; lines: string[] }> = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(pattern);
    const sectionLabel = match ? normalizeResultSectionLabel(match[1]) : null;
    if (match && sectionLabel && isExplicitResultSectionLine(line, match[1])) {
      sections.push({ label: sectionLabel, lines: match[2]?.trim() ? [match[2].trim()] : [] });
      continue;
    }
    sections.at(-1)?.lines.push(line);
  }
  return sections.map((section) => ({ label: section.label, message: section.lines.join("\n").trim() })).filter((section) => section.message);
}

function isExplicitResultSectionLine(line: string, label: string): boolean {
  if (/^\s*(?:[-*]\s*)?(?:#{1,6}\s+|\*\*)/.test(line)) return true;
  return ["research_note", "design_decision", "tool_call", "artifact", "design_system_artifact", "session_result", "acceptance_statement"].includes(label.trim().toLowerCase());
}

function normalizeResultSectionLabel(label: string): string | null {
  const normalized = label.trim().replace(/[_/-]+/g, " ").replace(/\s+/g, " ").toLowerCase();
  const exact = normalized.replaceAll(" ", "_");
  if (["research_note", "design_decision", "tool_call", "artifact", "design_system_artifact", "session_result", "acceptance_statement"].includes(exact)) return exact;
  if (/^(research|research notes?|research findings?|findings|evidence)$/.test(normalized)) return "research_note";
  if (/^(design decisions?|decisions?|recommendations?)$/.test(normalized)) return "design_decision";
  if (/^(commands?|commands run|tool calls?|tools?)$/.test(normalized)) return "tool_call";
  if (/^(artifacts?|files changed|outputs?|deliverables?)$/.test(normalized)) return "artifact";
  if (/^(acceptance criteria|acceptance statement|verification|checks?)$/.test(normalized)) return "acceptance_statement";
  if (/^(summary|result|session result|next steps|handoff)$/.test(normalized)) return "session_result";
  return null;
}

function resultSectionTitle(label: string, message = ""): string {
  if (label === "artifact" || label === "design_system_artifact") {
    const artifactTitle = extractArtifactTitle(message);
    if (artifactTitle) return artifactTitle;
  }
  if (label === "research_note") return "Research";
  if (label === "design_decision") return "Decision";
  if (label === "acceptance_statement") return "Accept";
  if (label === "tool_call") return "Tools";
  if (label === "session_result") return "Result";
  return eventLabel(label);
}

function resultSectionBody(label: string, message: string): string {
  if (label !== "artifact" && label !== "design_system_artifact") return message;
  const artifactTitle = extractArtifactTitle(message);
  if (!artifactTitle) return message;
  const lines = message.split(/\r?\n/);
  const index = lines.findIndex((line) => line.trim().replace(/:$/, "") === artifactTitle);
  if (index < 0) return message;
  return [...lines.slice(0, index), ...lines.slice(index + 1)].join("\n").trim();
}

function extractArtifactTitle(message: string): string | null {
  const first = message.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  if (!first) return null;
  const normalized = first.replace(/^#{1,6}\s+/, "").replace(/:$/, "").trim();
  if (!normalized || normalized.length > 88) return null;
  if (!/\b(design|artifact|pull|system|audit|inventory|trace)\b/i.test(normalized)) return null;
  return normalized;
}

function isMarkdownTableLine(line: string): boolean {
  return line.includes("|") && line.split("|").length >= 3;
}

function isMarkdownTableSeparator(line: string): boolean {
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(line);
}

function markdownTableCells(line: string): string[] {
  return line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function looksLikeResultHeading(text: string): boolean {
  if (!text.endsWith(":")) return false;
  const normalized = text.replace(/:$/, "").trim();
  return normalized.length > 3 && normalized.length <= 80 && !normalized.includes("|");
}

function compactFileLabel(label: string, path: string): string {
  const target = path.replace(/^file:\/\//, "");
  const filename = target.split("/").at(-1) ?? label;
  const line = target.match(/:(\d+)$/)?.[1];
  return line ? `${filename.replace(/:\d+$/, "")}:${line}` : filename;
}

export function buildTerminalBlocks(input: {
  session: SessionSummary | null;
  events: StudioEvent[];
  harnessLabel: string;
  action: StudioAction;
  prompt: string;
}): TerminalBlock[] {
  const blocks: TerminalBlock[] = [];
  const hasUserChatMessage = input.events.some((event) => event.type === "chat_message");
  if (input.session && !hasUserChatMessage) {
    blocks.push({
      id: "run-context",
      kind: "run_context",
      title: "You",
      meta: `${input.harnessLabel} / ${input.action}`,
      timestamp: input.session.startedAt,
      messages: [trimText(input.prompt, 360)],
      events: [],
    });
  }

  let activeGroup: TerminalBlock | null = null;
  for (let index = 0; index < input.events.length; index += 1) {
    const event = input.events[index];
    if (event.type === "reference_trace") continue;
    if (event.type === "terminal_command") {
      const next = input.events[index + 1];
      const pairedOutput = next?.type === "terminal_output" ? next : null;
      blocks.push({
        id: `command_trace-${event.id}`,
        kind: "command_trace",
        title: "Command",
        meta: pairedOutput ? "command / output" : "command",
        timestamp: pairedOutput?.timestamp ?? event.timestamp,
        messages: pairedOutput ? [event.message, pairedOutput.message] : [event.message],
        data: pairedOutput?.data ?? event.data,
        events: pairedOutput ? [event, pairedOutput] : [event],
      });
      if (pairedOutput) index += 1;
      activeGroup = null;
      continue;
    }
    const kind = blockKindForEvent(event);
    if ((kind === "stdout_group" || kind === "stderr_group") && activeGroup !== null && activeGroup.kind === kind) {
      activeGroup.messages.push(event.message);
      activeGroup.events.push(event);
      activeGroup.timestamp = event.timestamp;
      continue;
    }

    activeGroup = {
      id: `${kind}-${event.id}`,
      kind,
      title: titleForBlock(kind, event),
      meta: metaForBlock(kind, event),
      timestamp: event.timestamp,
      messages: [event.message],
      data: event.data,
      events: [event],
    };
    blocks.push(activeGroup);
  }

  return ensureUniqueTerminalBlockIds(blocks);
}

function ensureUniqueTerminalBlockIds(blocks: TerminalBlock[]): TerminalBlock[] {
  const seenBlockIds = new Map<string, number>();
  return blocks.map((block) => {
    const seenCount = seenBlockIds.get(block.id) ?? 0;
    seenBlockIds.set(block.id, seenCount + 1);
    if (seenCount === 0) return block;
    return { ...block, id: `${block.id}-${seenCount + 1}` };
  });
}

export function isFigmaBridgeRunning(status: FigmaStatus | null): boolean {
  return status?.bridgeStatus === "running" || status?.running === true;
}

export function figmaStatusLabel(status: FigmaStatus | null): string {
  if (isFigmaPluginConnected(status)) return "Figma connected";
  if (isFigmaBridgeRunning(status)) return `Figma :${status?.port ?? "--"}`;
  return "Figma stopped";
}

export function expectedDmgPath(status: StudioStatus | null): string {
  const root = status?.projectRoot ?? "$PROJECT_ROOT";
  return `${root}/apps/studio/src-tauri/target/release/bundle/dmg/Mémoire Studio_0.16.3_aarch64.dmg`;
}

function buildDownloadReadyItems(input: { status: StudioStatus | null; config: StudioConfig | null }): Array<{ id: string; label: string; detail: string }> {
  return [
    { id: "version", label: "App version", detail: "@sarveshsea/memoire@0.16.3" },
    { id: "dmg", label: "DMG", detail: expectedDmgPath(input.status) },
    { id: "icon", label: "Bundle icon", detail: "Mémoire flower assets in Tauri bundle metadata" },
    { id: "pack", label: "Package dry run", detail: "npm run pack:dry-run size gate" },
    { id: "build", label: "Release gates", detail: "Studio build, Tauri build, and check:release" },
    {
      id: "setup",
      label: "Setup saved",
      detail: input.config?.setup?.completedAt ? `completed ${input.config.setup.completedAt}` : "pending first-run wizard completion",
    },
  ];
}

function normalizeCodexUiConfig(config: Partial<StudioCodexConfig> | null | undefined): StudioCodexConfig {
  return { ...DEFAULT_CODEX_UI_CONFIG, ...(config ?? {}) };
}

function permissionLabel(value: string): string {
  if (value === "screenRecording") return "Screen Recording";
  if (value === "fileAccess") return "Files and Folders";
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

export function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function trimText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

function firstMeaningfulLine(value: string): string {
  return value.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "Output";
}

export function filterContextItems(items: ProjectMemoryItem[], query: string, filter: string): ProjectMemoryItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  return items.filter((item) => {
    const haystack = `${item.title} ${item.summary} ${item.kind} ${item.status} ${item.tags.join(" ")} ${item.sourcePath}`.toLowerCase();
    const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
    const matchesFilter = filter === "all" || outputItemMatches(filter, item, null);
    return matchesQuery && matchesFilter;
  });
}

export function filterKnowledgeItems(items: StudioKnowledgeItem[], query: string, filter: string): StudioKnowledgeItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  return items.filter((item) => {
    const haystack = `${item.title} ${item.summary} ${item.kind} ${item.status} ${item.tags.join(" ")} ${item.sourcePath}`.toLowerCase();
    const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
    const matchesFilter = filter === "all" || item.kind === filter || item.tags.includes(filter);
    return matchesQuery && matchesFilter;
  });
}

export function deriveSessionStatus(session: SessionSummary | null, events: StudioEvent[]): SessionSummary["status"] | "standby" {
  if (!session) return "standby";
  let latestTerminal: StudioEvent | null = null;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type === "session_done" || event.type === "session_error") {
      latestTerminal = event;
      break;
    }
  }
  if (!latestTerminal) return session.status;
  if (latestTerminal.type === "session_error") return "failed";
  if (latestTerminal.message.toLowerCase().includes("cancel")) return "cancelled";
  return "completed";
}

function isFigmaPluginConnected(status: FigmaStatus | null): boolean {
  return status?.pluginStatus === "connected" || status?.connectionState === "connected";
}

function blockKindForEvent(event: StudioEvent): TerminalBlockKind {
  if (event.type === "stdout") return "stdout_group";
  if (event.type === "terminal_output") return "stdout_group";
  if (event.type === "terminal_command") return "command_trace";
  if (event.type === "stderr" || event.type === "session_error") return "stderr_group";
  if (event.type === "chat_message") return "run_context";
  if (event.type === "session_result") return "session_result";
  if (ARTIFACT_EVENT_TYPES.has(event.type)) return "artifact_group";
  if (AGENTIC_EVENT_TYPES.has(event.type)) return "agentic_group";
  return "lifecycle";
}

function titleForBlock(kind: TerminalBlockKind, event: StudioEvent): string {
  if (event.type === "chat_message") return "You";
  if (event.type === "terminal_command" || event.type === "terminal_output") return "Terminal";
  if (event.type.startsWith("research_") || event.type === "research_note") return "Research";
  if (event.type === "design_artifact" || event.type === "design_system_artifact" || event.type === "figma_candidate") return "Design";
  if (event.type === "preview_ready" || event.type === "design_preview") return "Preview";
  if (event.type === "marketplace_download") return "Marketplace";
  if (event.type === "handoff_bundle") return "Handoff";
  if (event.type === "auth_state") return "Auth";
  if (kind === "stdout_group") return "Output";
  if (kind === "stderr_group") return event.type === "session_error" ? "Error" : "Warnings";
  if (kind === "session_result") return "Result";
  if (kind === "artifact_group") return "Artifact";
  if (kind === "agentic_group") return event.type === "tool_call" ? "Tool" : eventLabel(event.type);
  return eventLabel(event.type);
}

function metaForBlock(kind: TerminalBlockKind, event: StudioEvent): string {
  if (event.type === "chat_message") {
    const data = asEventRecord(event.data);
    return [pickEventString(data, "harness"), pickEventString(data, "chatMode"), pickEventString(data, "permissionMode")]
      .filter(Boolean)
      .join(" / ") || "user";
  }
  if (event.type === "terminal_command") return "command";
  if (event.type === "terminal_output") return "output";
  if (event.type.startsWith("research_")) return eventLabel(event.type);
  if (kind === "stdout_group") return "stdout";
  if (kind === "stderr_group") return event.type === "session_error" ? "session" : "stderr";
  if (kind === "session_result") return "parsed JSON";
  if (kind === "artifact_group") return eventLabel(event.type);
  if (kind === "agentic_group") return eventLabel(event.type);
  return "lifecycle";
}

function asEventRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function pickEventString(value: Record<string, unknown>, key: string): string | null {
  const candidate = value[key];
  return typeof candidate === "string" && candidate.trim() ? candidate : null;
}

function deriveOutputItems(
  tab: OutputTabId,
  memoryItems: ProjectMemoryItem[],
  artifactEvents: StudioEvent[],
  latestResult: StudioEvent | null,
): Array<{ id: string; title: string; meta: string; summary: string }> {
  const eventItems = artifactEvents
    .filter((event) => outputEventMatches(tab, event))
    .map((event) => ({
      id: event.id,
      title: eventLabel(event.type),
      meta: formatTime(event.timestamp),
      summary: event.message,
    }));
  const memoryOutputItems = memoryItems
    .filter((item) => outputItemMatches(tab, item, null))
    .map((item) => ({
      id: item.id,
      title: item.title,
      meta: item.kind,
      summary: item.summary || item.sourcePath,
    }));
  const resultItems = latestResult && tab === "handoff"
    ? [{ id: latestResult.id, title: "Session result", meta: "handoff", summary: latestResult.message }]
    : [];
  return [...eventItems, ...resultItems, ...memoryOutputItems];
}

function outputEventMatches(tab: string, event: StudioEvent): boolean {
  const haystack = `${event.type} ${event.message}`.toLowerCase();
  if (tab === "screens") return /screenshot|design_preview|video/.test(haystack);
  if (tab === "components") return /component|file_change|artifact/.test(haystack);
  if (tab === "tokens") return /token/.test(haystack);
  if (tab === "specs") return /spec|artifact|file_change/.test(haystack);
  if (tab === "audit") return /audit|accessibility|wcag/.test(haystack);
  if (tab === "references") return /reference|refs|source/.test(haystack);
  if (tab === "handoff") return /handoff|result|export|patch/.test(haystack);
  return false;
}

function outputItemMatches(tab: string, item: ProjectMemoryItem, _event: StudioEvent | null): boolean {
  const haystack = `${item.kind} ${item.title} ${item.summary} ${item.tags.join(" ")} ${item.sourcePath}`.toLowerCase();
  if (tab === "page" || tab === "screens") return /page|screen|preview|home|changelog/.test(haystack);
  if (tab === "component" || tab === "components") return /component|atom|molecule|organism|button|card/.test(haystack);
  if (tab === "token" || tab === "tokens") return /token|color|typography|spacing|radius/.test(haystack);
  if (tab === "specs") return item.kind === "spec" || /spec/.test(haystack);
  if (tab === "audit") return /audit|wcag|accessibility/.test(haystack);
  if (tab === "reference" || tab === "references") return /reference|source|refer/.test(haystack);
  if (tab === "markdown") return /\.mdx?$/i.test(item.sourcePath);
  if (tab === "yaml") return /\.ya?ml$/i.test(item.sourcePath);
  if (tab === "handoff") return /handoff|export|patch|result/.test(haystack);
  return false;
}

function memoryFilterCounts(items: ProjectMemoryItem[]) {
  return [
    { id: "all", label: "All", count: items.length },
    { id: "page", label: "Pages", count: items.filter((item) => /page|home|changelog/i.test(`${item.kind} ${item.tags.join(" ")}`)).length },
    { id: "component", label: "Components", count: items.filter((item) => /component|atom|molecule|organism/i.test(`${item.title} ${item.tags.join(" ")}`)).length },
    { id: "token", label: "Tokens", count: items.filter((item) => /token|color|type|spacing/i.test(`${item.title} ${item.tags.join(" ")}`)).length },
    { id: "reference", label: "References", count: items.filter((item) => /reference|source|refer/i.test(`${item.title} ${item.tags.join(" ")} ${item.sourcePath}`)).length },
    { id: "markdown", label: "Markdown", count: items.filter((item) => /\.mdx?$/i.test(item.sourcePath)).length },
    { id: "yaml", label: "YAML", count: items.filter((item) => /\.ya?ml$/i.test(item.sourcePath)).length },
  ];
}

function knowledgeKindLabel(kind: StudioKnowledgeItem["kind"]): string {
  if (kind === "agent-capture") return "Captured";
  if (kind === "design-reference") return "Reference";
  return kind.replace(/^\w/, (char) => char.toUpperCase());
}

function compactName(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? pathname;
}

function activityGlyph(kind: StudioActivityItem["kind"]): string {
  if (kind === "thinking") return ".";
  if (kind === "reading_file") return "[]";
  if (kind === "searching") return "?";
  if (kind === "listing") return "=";
  if (kind === "writing_file") return "W";
  if (kind === "browser_action") return "B";
  if (kind === "figma_action") return "F";
  if (kind === "mcp_call") return "M";
  if (kind === "computer_action") return "C";
  if (kind === "using_tool") return "*";
  return ">";
}

function activityMeta(activity: StudioActivityItem): string {
  const target = activity.targetPath ? displaySourceLabel(activity.targetPath) : null;
  const prefix = activity.kind === "reading_file"
    ? "read"
    : activity.kind === "searching"
      ? "search"
      : activity.kind === "listing"
        ? "list"
        : activity.kind === "writing_file"
          ? "write"
          : activity.kind === "running_command"
            ? "run"
            : activity.kind === "thinking"
              ? "think"
              : activity.kind === "browser_action"
                ? "browser"
                : activity.kind === "figma_action"
                  ? "figma"
                  : activity.kind === "mcp_call"
                    ? "mcp"
                    : activity.kind === "computer_action"
                      ? "computer"
                      : "tool";
  return [prefix, activity.status, target ?? trimText(activity.summary, 72)].filter(Boolean).join(" / ");
}

function displaySourceLabel(sourcePath: string | null | undefined): string {
  if (!sourcePath) return "--";
  const normalized = sourcePath.replaceAll("\\", "/");
  const noteIndex = normalized.lastIndexOf("/notes/");
  if (noteIndex >= 0) return `notes/${compactName(normalized)}`;
  if (normalized.startsWith("notes/")) return `notes/${compactName(normalized)}`;
  const skillIndex = normalized.lastIndexOf("/skills/");
  if (skillIndex >= 0) return `skills/${compactName(normalized)}`;
  if (normalized.startsWith("skills/")) return `skills/${compactName(normalized)}`;
  if (normalized.startsWith(".memoire/")) return normalized.split("/").slice(-2).join("/");
  if (normalized.startsWith("preview/")) return normalized;
  if (normalized.startsWith("specs/")) return normalized.split("/").slice(-2).join("/");
  const parts = normalized.split("/").filter(Boolean);
  return parts.length > 2 ? parts.slice(-2).join("/") : normalized;
}

function marketplaceSourceLabel(source: MarketplaceNotesPayload["notes"][number]["source"]): string {
  if (source === "community-catalog") return "Community";
  if (source === "local-fork") return "Fork";
  if (source === "remote-catalog") return "Remote";
  if (source === "installed-note") return "Installed";
  if (source === "built-in-note") return "Built in";
  if (source === "workspace-skill") return "Workspace";
  return "Skill";
}

function marketplaceSourceBucket(note: MarketplaceNotesPayload["notes"][number]): string {
  if (note.source === "local-fork") return "forks";
  if (note.source === "community-catalog" || note.reviewStatus === "approved") return "community";
  if (note.installed) return "installed";
  if (note.builtIn) return "official";
  return "updates";
}

function marketplaceNoteFreshness(note: MarketplaceNotesPayload["notes"][number]): string {
  if (note.freshnessStatus === "stale") return "Stale";
  if (note.freshnessStatus === "unverified") return "Unverified";
  if (!note.lastResearchedAt) return "Unverified";
  const researched = Date.parse(note.lastResearchedAt);
  if (!Number.isFinite(researched)) return "Unverified";
  const ageDays = Math.max(0, Math.floor((Date.now() - researched) / 86400000));
  const budget = note.freshnessDays ?? 90;
  return ageDays > budget ? "Stale" : `${ageDays}d fresh`;
}

function eventLabel(type: string): string {
  return type.replace(/_/g, " ");
}

function formatDataPreview(data: unknown): string {
  if (data === undefined || data === null) return "No data.";
  return JSON.stringify(data, null, 2);
}

function formatLogPayload(event: StudioEvent): string {
  const preview = event.data === undefined ? "" : ` ${formatDataPreview(event.data)}`;
  return `${event.message}${preview}`.trim();
}

export async function copyText(value: string) {
  if (!value.trim()) return;
  await navigator.clipboard?.writeText(value).catch(() => undefined);
}
