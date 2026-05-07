import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("studio harness console UI", () => {
  it("renders Scenario Lab V2 model swarm controls and live data surfaces", async () => {
    const app = await readFile(join(process.cwd(), "apps", "studio", "src", "App.tsx"), "utf-8");
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");

    expect(app).toContain("callStudioTool");
    expect(app).toContain('data-scenario-lab="model-swarm-simulation"');
    expect(app).toContain('data-scenario-model-matrix="codex-first"');
    expect(app).toContain('data-scenario-cohort-editor="research-backed"');
    expect(app).toContain('data-scenario-live-graph="round-state"');
    expect(app).toContain('data-scenario-transcript-viewer="model-memory"');
    expect(app).toContain('data-scenario-cost-panel="budget"');
    expect(app).toContain('data-scenario-compare-view="hypothesis-matrix"');
    expect(app).toContain('data-scenario-figjam-export="mermaid-jam"');
    expect(app).toContain("simulation.models");
    expect(app).toContain("simulation.run_matrix");
    expect(app).toContain("simulation.transcript");
    expect(app).toContain("research.design_package");
    expect(app).toContain("mermaid_jam.export");
    expect(app).toContain("scenario.export_figjam");
    expect(css).toContain(".scenario-model-matrix");
    expect(css).toContain(".scenario-transcript-viewer");
    expect(css).toContain(".scenario-cost-panel");
    expect(css).toContain(".scenario-figjam-export");
  });

  it("renders a single harness-first console as the default macOS shell", async () => {
    const app = await readFile(join(process.cwd(), "apps", "studio", "src", "App.tsx"), "utf-8");
    const components = await readFile(join(process.cwd(), "apps", "studio", "src", "workbench-components.tsx"), "utf-8");
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");
    const ui = `${app}\n${components}`;

    expect(app).toContain('data-studio-shell="harness-console"');
    expect(app).toContain('data-studio-workbench="harness-console"');
    expect(app).toContain('data-harness-readiness="compact"');
    expect(app).toContain('data-chat-workbench="input-output"');
    expect(app).toContain('data-chat-transcript="continuous"');
    expect(app).toContain('data-output-renderer="inline"');
    expect(app).toContain('data-output-first="design-research-terminal"');
    expect(app).toContain('data-message-feed="chat-output"');
    expect(app).toContain('data-block-feed="terminal-blocks"');
    expect(app).toContain('data-conversation-scroll="activity-output"');
    expect(app).toContain("const scrollRegionRef = useRef<HTMLElement | null>(null)");
    expect(app).toContain("const bottomAnchorRef = useRef<HTMLDivElement | null>(null)");
    expect(app).toContain('ref={scrollRegionRef}');
    expect(app).toContain('onScroll={handleConversationScroll}');
    expect(app).toContain('data-auto-scroll-state={userPinnedToBottom ? "pinned" : "paused"}');
    expect(app).toContain('data-agent-thinking-state={agentThinkingState}');
    expect(app).toContain('data-latest-anchor');
    expect(app).toContain('data-action-id="conversation.scroll-latest"');
    expect(app).toContain('data-codex-power-strip="sandbox"');
    expect(app).toContain("function HarnessChip");
    expect(app).toContain("data-harness-chip={props.kind}");
    expect(app).toContain('kind="harness"');
    expect(app).toContain('kind="access"');
    expect(app).toContain('kind="reasoning"');
    expect(app).toContain('kind="action"');
    expect(app).toContain('kind="status"');
    expect(app).toContain("<StudioControlIcon name={props.icon}");
    expect(app).toContain('data-harness-readiness-contract="compact"');
    expect(app).toContain('data-composer-agent-state="codex-workbench"');
    expect(app).toContain("ProjectSidebar");
    expect(app).not.toContain("SessionStack");
    expect(app).toContain("ChangedFilesPanel");
    expect(ui).toContain('data-project-sidebar="codex-style"');
    expect(ui).toContain('data-sidebar-settings="bottom-pinned"');
    expect(ui).not.toContain('data-cli-session-sidebar="projects"');
    expect(ui).toContain('data-changed-files-panel="inline-review"');
    expect(app).toContain("permissionModePowerLabel(permissionMode)");
    expect(app).toContain("permissionModePowerDetail(permissionMode)");
    expect(app).toContain('data-action-id="codex.plan-mode.toggle"');
    expect(app).toContain("codexReasoningLabel(settingsDraft?.codex?.reasoningEffort");
    expect(app).toContain('data-message-composer="warp-claude"');
    expect(app).toContain('const [permissionMode, setPermissionMode] = useState<StudioPermissionMode>("guarded")');
    expect(app).toContain("captureAttachment");
    expect(app).toContain("AttachmentShelf");
    expect(app).toContain("handlePromptPaste");
    expect(app).toContain("handleComposerDrop");
    expect(ui).toContain('data-attachment-shelf="composer-materials"');
    expect(app).toContain('type="file"');
    expect(app).toContain("actionsForHarness(currentHarness)");
    expect(app).toContain("resolveHarnessAction(selectedAction, currentHarness)");
    expect(app).toContain("PRIMARY_HARNESS_IDS");
    expect(app).toContain("primaryHarnesses(harnesses)");
    expect(app).toContain('const [selectedHarness, setSelectedHarness] = useState<HarnessId>("codex")');
    expect(app).toContain("attachWorkspaceContext");
    expect(app).toContain('data-action-id="attachment.add"');
    expect(app).not.toContain('data-action-id="voice.input"');
    expect(app).toContain("CHAT_MODES");
    expect(app).toContain("PERMISSION_MODES");
    expect(app).toContain("chatMode");
    expect(app).toContain("permissionMode");
    expect(app).toContain('data-command-editor="bottom-pinned"');
    expect(app).toContain('data-action-id="session.run"');
    expect(app).toContain('data-action-id="session.cancel"');
    expect(css).toContain(".console-layout");
    expect(css).toContain(".project-sidebar");
    expect(css).toContain(".harness-console-shell");
    expect(css).toContain(".harness-readiness-row");
  });

  it("renders Codex/Antigravity-style chat quality-of-life controls around the composer", async () => {
    const app = await readFile(join(process.cwd(), "apps", "studio", "src", "App.tsx"), "utf-8");
    const components = await readFile(join(process.cwd(), "apps", "studio", "src", "workbench-components.tsx"), "utf-8");
    const ui = `${app}\n${components}`;

    expect(app).toContain("ChatQualityLayer");
    expect(app).toContain("chatSearchQuery");
    expect(app).toContain("chatMemoryPins");
    expect(app).toContain("memoire.studio.chatMemoryPins");
    expect(app).toContain("filterTerminalBlocksByQuery(terminalBlocks, chatSearchQuery)");
    expect(app).toContain("handleChatFollowUp");
    expect(app).toContain("pinCurrentChatMemory");
    expect(app).toContain("branchCurrentChat");
    expect(app).toContain("copyCurrentVerificationReceipt");
    expect(app).toContain("visibleTerminalBlocks.map((block)");
    expect(ui).toContain('data-chat-qol="codex-antigravity"');
    expect(ui).toContain('data-chat-live-plan="current-run"');
    expect(ui).toContain('data-chat-search="conversation"');
    expect(ui).toContain('data-follow-up-chips="contextual"');
    expect(ui).toContain('data-memory-pins="session"');
    expect(ui).toContain('data-artifact-shelf="chat-evidence"');
    expect(ui).toContain('data-verification-receipt="run"');
    expect(ui).toContain('data-approval-queue="inline"');
    expect(ui).toContain('data-parallel-agent-lanes="mini"');
    expect(ui).toContain('data-action-id="chat.branch-current"');
    expect(ui).toContain('data-action-id="chat.pin-memory"');
    expect(ui).toContain('data-action-id="chat.copy-verification"');
    expect(components).toContain("export function ChatQualityLayer");
    expect(components).toContain("export function filterTerminalBlocksByQuery");
    expect(components).toContain("deriveChatFollowUps");
    expect(components).toContain("deriveVerificationSignals");
  });

  it("renders the Studio topbar as an ultra-compact icon/status strip", async () => {
    const app = await readFile(join(process.cwd(), "apps", "studio", "src", "App.tsx"), "utf-8");
    const components = await readFile(join(process.cwd(), "apps", "studio", "src", "workbench-components.tsx"), "utf-8");
    const headerStart = app.indexOf('<header className="console-topbar"');
    const headerEnd = app.indexOf("</header>", headerStart);
    const header = app.slice(headerStart, headerEnd);

    expect(header).toContain('data-topbar-density="thirty-percent"');
    expect(header).toContain('data-icon-topbar="memoire-compact"');
    expect(header).not.toContain("memoire-wordmark");
    expect(header).not.toContain(">Mémoire<");
    expect(header).toContain('data-topbar-tags="left-compact"');
    expect(header).toContain('<StudioControlIcon name="command" />');
    expect(header).toContain('<StudioControlIcon name="details" />');
    expect(header).toContain('<StudioControlIcon name="light" />');
    expect(header).toContain('<StudioControlIcon name="dark" />');
    expect(header).toContain('<StudioControlIcon name="settings" />');
    expect(header).toContain('aria-label="Command"');
    expect(header).toContain('aria-label="Details"');
    expect(header).toContain('aria-label="Light mode"');
    expect(header).toContain('aria-label="Dark mode"');
    expect(header).toContain('aria-label="Settings"');
    expect(header).toContain('title="Settings"');
    expect(header).toContain('data-action-id="settings.open"');
    expect(components).toContain('name: "attach" | "mode" | "access" | "plan" | "harness" | "action" | "command" | "details" | "light" | "dark" | "settings"');
  });

  it("groups sessions in a collapsible project sidebar with settings pinned at the bottom", async () => {
    const app = await readFile(join(process.cwd(), "apps", "studio", "src", "App.tsx"), "utf-8");
    const components = await readFile(join(process.cwd(), "apps", "studio", "src", "workbench-components.tsx"), "utf-8");
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");

    expect(app).toContain("projectSidebarCollapsed");
    expect(app).toContain("expandedProjectIds");
    expect(app).toContain("memoire.studio.projectSidebarCollapsed");
    expect(app).toContain("memoire.studio.expandedProjectIds");
    expect(app).toContain("onOpenSettings={() => openSettingsPanel()}");
    expect(app).not.toContain("onOpenSettings={openSettingsPanel}");
    expect(components).toContain("function groupSessionsByProject");
    expect(components).toContain('data-project-folder-row');
    expect(components).toContain('data-project-session-row');
    expect(components).toContain('className="project-session-copy"');
    expect(components).toContain('<i className="project-session-status"');
    expect(components).toContain('data-action-id="sidebar.collapse"');
    expect(components).toContain('data-action-id="settings.open.sidebar"');
    expect(components).toContain("session.harness} / {session.action ?? \"run\"} / {session.status}");
    expect(css).toContain("--project-sidebar-width:");
    expect(css).toContain("--project-sidebar-collapsed-width:");
    expect(css).toContain('[data-sidebar-collapsed="true"]');
  });

  it("wires sidebar actions to concrete Studio surfaces and uses one clean monochrome icon pack", async () => {
    const app = await readFile(join(process.cwd(), "apps", "studio", "src", "App.tsx"), "utf-8");
    const components = await readFile(join(process.cwd(), "apps", "studio", "src", "workbench-components.tsx"), "utf-8");
    const ui = `${app}\n${components}`;
    const buttonBlocks = Array.from(ui.matchAll(/<button\b[\s\S]*?<\/button>/g)).map((match) => match[0]);
    const unwiredButtons = buttonBlocks.filter((button) => !button.includes("onClick=") && !button.includes("disabled="));

    expect(unwiredButtons).toEqual([]);
    expect(app).toContain("function openCommandPalette");
    expect(app).toContain("openCommandPalette()");
    expect(app).toContain("function openPluginsSurface()");
    expect(app).toContain("function openFigmaSurface()");
    expect(app).toContain("function openAutomationsSurface()");
    expect(app).toContain("function openChangelogSurface()");
    expect(app).toContain("onOpenPlugins={openPluginsSurface}");
    expect(app).toContain("onOpenFigma={openFigmaSurface}");
    expect(app).toContain("onOpenAutomations={openAutomationsSurface}");
    expect(app).toContain("onOpenChangelog={openChangelogSurface}");
    expect(app).toContain('openDetailsDrawer("figma")');
    expect(app).toContain("const [automationsOpen, setAutomationsOpen]");
    expect(app).toContain("listAutomations");
    expect(app).toContain("getAutomationTemplates");
    expect(app).toContain("AutomationCenter");
    expect(app).toContain("setAutomationsOpen(true)");
    expect(app).not.toContain('onOpenPlugins={() => openSettingsPanel("Figma")}');
    expect(app).not.toContain('onOpenAutomations={() => openSettingsPanel("Permissions")}');
    expect(components).toContain("onOpenPlugins: () => void");
    expect(components).toContain("onOpenAutomations: () => void");
    expect(components).toContain("onOpenChangelog: () => void");
    expect(components).toContain('data-action-id="changelog.open.sidebar"');
    expect(components).not.toContain("onOpenDetails: () => void");
    expect(components).toContain('data-icon-pack="memoire-line"');
    expect(components).toContain('focusable="false"');
    expect(components).toContain("function StudioLineIcon");
  });

  it("renders Plugins as a VS Code-style marketplace with download progress", async () => {
    const app = await readFile(join(process.cwd(), "apps", "studio", "src", "App.tsx"), "utf-8");
    const api = await readFile(join(process.cwd(), "apps", "studio", "src", "studio-api.ts"), "utf-8");
    const components = await readFile(join(process.cwd(), "apps", "studio", "src", "workbench-components.tsx"), "utf-8");
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");

    expect(api).toContain("subscribeDownloadEvents");
    expect(api).toContain("forkMarketplaceNote");
    expect(api).toContain("validateNoteFork");
    expect(api).toContain("exportNoteForkPr");
    expect(app).toContain("marketplaceDownloadJobs");
    expect(app).toContain("selectedNoteForkId");
    expect(app).toContain("selectedMarketplaceNoteId");
    expect(app).toContain("onMarketplaceSelectionChange");
    expect(app).toContain("handleForkMarketplaceNote");
    expect(app).toContain("handleValidateNoteFork");
    expect(app).toContain("handleExportNoteForkPr");
    expect(app).toContain("subscribeDownloadEvents(result.job.id");
    expect(components).toContain('data-plugin-marketplace-layout="vscode-split"');
    expect(components).toContain('data-marketplace-filter-rail="notes"');
    expect(components).toContain('data-marketplace-source-filter="official-community-forks"');
    expect(components).toContain('data-note-fork-editor="markdown-review"');
    expect(components).toContain('data-marketplace-note-results="dense-list"');
    expect(components).toContain('data-marketplace-note-detail="quick-install"');
    expect(components).toContain('placeholder="Search Marketplace"');
    expect(components).toContain("marketplaceCategoryFilter");
    expect(components).toContain("marketplaceSourceFilter");
    expect(components).toContain("selectedMarketplaceNote");
    expect(components).toContain("Fork");
    expect(components).toContain("Validate");
    expect(components).toContain("Submit for Review");
    expect(css).toContain(".marketplace-layout");
    expect(css).toContain(".marketplace-filter-rail");
    expect(css).toContain(".marketplace-note-results");
    expect(css).toContain(".marketplace-note-detail");
    expect(css).toContain(".marketplace-progress");
    expect(css).toContain(".note-fork-editor");
  });

  it("opens a native automations center with the design harness templates", async () => {
    const app = await readFile(join(process.cwd(), "apps", "studio", "src", "App.tsx"), "utf-8");
    const components = await readFile(join(process.cwd(), "apps", "studio", "src", "workbench-components.tsx"), "utf-8");
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");
    const automationCore = await readFile(join(process.cwd(), "src", "studio", "automations.ts"), "utf-8");

    expect(app).toContain("getAutomationSchedulerStatus");
    expect(app).toContain("runAutomationNow");
    expect(app).toContain("installAutomationScheduler");
    expect(components).toContain('data-automations-center="studio"');
    expect(components).toContain('data-automation-template-picker="design-harness"');
    expect(components).toContain("AUTOMATION_TEMPLATE_ORDER");
    expect(components).toContain('"design-system-audit"');
    expect(components).toContain('"figma-token-component-pull"');
    expect(components).toContain('"codex-app-build-review"');
    expect(components).toContain('"research-reference-refresh"');
    expect(components).toContain('data-automation-editor={modalMode}');
    expect(components).toContain("onRunNow");
    expect(components).toContain("onInstallScheduler");
    expect(css).toContain(".automations-panel");
    expect(css).toContain(".automation-template-row");
    expect(automationCore).toContain('model: "gpt-5.5"');
    expect(automationCore).toContain('reasoningEffort: "xhigh"');
    expect(automationCore).toContain('mutationPolicy: "review"');
    expect(automationCore).toContain('permissionMode: "plan"');
  });

  it("keeps the default harness surface focused on Claude Code, Codex, and Hermes", async () => {
    const app = await readFile(join(process.cwd(), "apps", "studio", "src", "App.tsx"), "utf-8");
    const components = await readFile(join(process.cwd(), "apps", "studio", "src", "workbench-components.tsx"), "utf-8");
    const ui = `${app}\n${components}`;

    expect(ui).toContain('"claude-code", "codex", "hermes"');
    expect(ui).toContain("CORE_HARNESS_IDS");
    expect(ui).toContain("coreHarnessRows");
    expect(app).toContain("visibleHarnesses.map((harness)");
    expect(app).not.toContain("harnesses.map((harness) => (");
  });

  it("removes permanent dashboard rails, tabs, trace cards, and secondary nav from the default shell", async () => {
    const app = await readFile(join(process.cwd(), "apps", "studio", "src", "App.tsx"), "utf-8");
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");

    expect(app).not.toContain('data-agent-tools-rail="studio-actions"');
    expect(app).not.toContain('className="context-rail studio-context-rail"');
    expect(app).not.toContain("secondary-surface-nav");
    expect(app).not.toContain("<TracePanel");
    expect(app).not.toContain("<OutputTabs");
    expect(app).not.toContain('data-status-footer="studio-sync"');
    expect(css).not.toContain(".agent-tools-rail");
    expect(css).not.toContain(".studio-context-rail");
    expect(css).not.toContain(".secondary-surface-nav");
    expect(css).not.toContain(".studio-status-footer");
    expect(css).not.toContain(".artifact-tabs");
    expect(css).not.toContain(".phase-tracker");
  });

  it("keeps Figma, memory, knowledge, reference trace, trace, and logs available in a hidden details drawer", async () => {
    const app = await readFile(join(process.cwd(), "apps", "studio", "src", "App.tsx"), "utf-8");
    const components = await readFile(join(process.cwd(), "apps", "studio", "src", "workbench-components.tsx"), "utf-8");
    const ui = `${app}\n${components}`;

    expect(app).toContain('data-run-details-drawer="hidden-power-surfaces"');
    expect(app).toContain('data-details-drawer-layout="sectioned"');
    expect(app).toContain('data-details-section-nav');
    expect(app).toContain('data-details-active-section={detailsSection}');
    expect(app).toContain("DETAILS_DRAWER_SECTIONS");
    expect(app).toContain('id: "run", label: "Run"');
    expect(app).toContain('id: "changes", label: "Changes"');
    expect(app).toContain('id: "figma", label: "Figma"');
    expect(app).toContain('id: "memory", label: "Memory"');
    expect(app).toContain('data-action-id={`details.section.${section.id}`}');
    expect(app).toContain('detailsSection === "run"');
    expect(app).toContain('detailsSection === "changes"');
    expect(app).toContain('detailsSection === "figma"');
    expect(app).toContain('detailsSection === "memory"');
    expect(app).toContain('data-action-id="details.open"');
    expect(app).toContain('data-recent-runs');
    expect(app).toContain("FigmaDriver");
    expect(app).toContain("ContextRail");
    expect(app).toContain("getFigmaStatus");
    expect(app).toContain("getKnowledgeIndex");
    expect(app).toContain("getSessionTrace");
    expect(app).toContain("getDesignSystemTrace");
    expect(app).toContain("openSessionSummary(nextSessions[0])");
    expect(ui).toContain('data-figma-bridge-card="compact"');
    expect(ui).toContain('data-knowledge-reader="design-reference-reader"');
    expect(ui).toContain('data-reference-trace="package-sources"');
    expect(ui).toContain("ReferenceTracePanel");
    expect(ui).toContain('data-agent-tasks="trace-tasks"');
    expect(ui).toContain('data-agent-logs="raw-events"');
    expect(app).toContain('data-design-system-trace="backend-review"');
    expect(app).toContain('data-action-id="design-trace.review"');
    expect(app).toContain('data-action-id="design-trace.refresh"');
    expect(ui).toContain('data-agentic-design-system="role-contract"');
    expect(ui).toContain('data-agentic-role-card');
    expect(ui).toContain('data-agentic-pattern-source');
    expect(ui).toContain("artifact.agentic?.openSourceReferences");
    expect(ui).toContain("artifact.agentic?.interactionPatterns");
    expect(ui).toContain("artifact.agentic?.roles");
    expect(ui).toContain("message_composer");
    expect(ui).toContain("tool_trace");
    expect(ui).toContain("artifact_review");
  });

  it("renders readable composer controls and a resizable chat workspace", async () => {
    const app = await readFile(join(process.cwd(), "apps", "studio", "src", "App.tsx"), "utf-8");
    const components = await readFile(join(process.cwd(), "apps", "studio", "src", "workbench-components.tsx"), "utf-8");
    const ui = `${app}\n${components}`;

    expect(app).toContain('data-composer-controls="readable"');
    expect(app).not.toContain('data-composer-controls="single-line"');
    expect(app).toContain("StudioControlIcon");
    expect(components).toContain("export function StudioControlIcon");
    expect(components).toContain('data-icon-pack="memoire-line"');
    expect(app).toContain('className="composer-select"');
    expect(app).toContain('className="composer-control-label"');
    expect(app).toContain('className="composer-control-text"');
    expect(app).toContain("<span>Mode</span>");
    expect(app).toContain("<span>Access</span>");
    expect(app).toContain("<span>Harness</span>");
    expect(app).toContain("<span>Action</span>");
    expect(app).toContain('aria-label="Mode"');
    expect(app).toContain('aria-label="Access"');
    expect(app).toContain('aria-label="Harness"');
    expect(app).toContain('aria-label="Action"');
    expect(app).toContain('aria-label="Toggle plan mode"');
    const composerControls = app.match(/<div className="composer-controls"[\s\S]*?<div className="workspace-status-row"/)?.[0] ?? "";
    expect(composerControls).not.toContain('className="model-chip"');
    expect(composerControls).not.toContain('className="power-chip"');
    expect(app).not.toContain("harnessModelLabel(");
    expect(ui).toContain('data-composer-control="mode"');
    expect(ui).toContain('data-composer-control="access"');
    expect(ui).toContain('data-composer-control="harness"');
    expect(ui).toContain('data-composer-control="action"');
    expect(app).toContain("CHAT_RAIL_WIDTH_KEY");
    expect(app).toContain("chatRailWidthPercent");
    expect(app).toContain("handleChatRailPointerDown");
    expect(app).toContain('data-agent-workbench="resizable-conversation-artifacts"');
    expect(app).toContain('data-chat-resize-handle="conversation-artifact"');
    expect(app).toContain('"--chat-rail-width"');
    expect(app).toContain('data-command-editor="bottom-pinned"');
    expect(app).toContain('className="conversation-scroll-region"');
  });

  it("deduplicates rendered terminal block ids so repeated events do not create React key warnings", async () => {
    const components = await readFile(join(process.cwd(), "apps", "studio", "src", "workbench-components.tsx"), "utf-8");

    expect(components).toContain("return ensureUniqueTerminalBlockIds(blocks)");
    expect(components).toContain("function ensureUniqueTerminalBlockIds");
    expect(components).toContain("const seenBlockIds = new Map<string, number>()");
    expect(components).toContain("id: `${block.id}-${seenCount + 1}`");
  });

  it("keeps command palette and settings as the advanced access points", async () => {
    const app = await readFile(join(process.cwd(), "apps", "studio", "src", "App.tsx"), "utf-8");
    const components = await readFile(join(process.cwd(), "apps", "studio", "src", "workbench-components.tsx"), "utf-8");
    const ui = `${app}\n${components}`;

    expect(app).toContain('data-action-id="command-palette.open"');
    expect(app).toContain('data-action-id="settings.open"');
    expect(app).toContain('event.key === "," && (event.metaKey || event.ctrlKey)');
    expect(app).toContain('event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)');
    expect(ui).toContain('data-command-palette="warp-style"');
    expect(ui).toContain('data-command-nav="studio-surfaces"');
    expect(ui).toContain("type CommandPaletteRow");
    expect(ui).toContain("const commandPaletteRows: CommandPaletteRow[]");
    expect(ui).toContain('data-command-palette-search="actions"');
    expect(ui).toContain('data-command-palette-row={row.kind}');
    expect(ui).toContain('data-command-palette-icon={row.icon}');
    expect(ui).toContain('data-command-palette-empty={row.kind === "empty" ? "true" : undefined}');
    expect(ui).toContain('id: "command.open.figma"');
    expect(ui).toContain('id: "command.open.plugins"');
    expect(ui).toContain('id: "command.open.automations"');
    expect(ui).toContain('id: "command.open.changelog"');
    expect(ui).toContain('id: "command.open.advanced"');
    expect(ui).toContain('data-settings-panel="warp-style"');
    expect(ui).toContain('data-settings-section-content="codex"');
    expect(ui).toContain("model_reasoning_effort");
    expect(ui).toContain("codex login --device-auth");
    expect(ui).toContain("workspaceRoots");
    expect(ui).toContain('data-action-id="settings.codex.add-repository"');
    expect(ui).toContain('data-download-ready="settings-about"');
    expect(ui).toContain("props.compatibility?.harnesses");
    expect(ui).toContain("computerStatus");
    expect(ui).toContain("Check screen permission");
  });

  it("renders explicit feature-backed settings sections for plugins, automations, and advanced tools", async () => {
    const app = await readFile(join(process.cwd(), "apps", "studio", "src", "App.tsx"), "utf-8");
    const components = await readFile(join(process.cwd(), "apps", "studio", "src", "workbench-components.tsx"), "utf-8");
    const ui = `${app}\n${components}`;

    expect(components).toContain('"Plugins", "Automations", "Download", "Advanced"');
    for (const section of ["general", "codex", "agents", "providers", "permissions", "figma", "plugins", "automations", "download", "advanced"]) {
      expect(ui).toContain(`data-settings-section-content="${section}"`);
    }
    expect(ui).toContain('data-marketplace-notes="memoire-notes"');
    expect(ui).toContain('data-action-id="settings.plugins.refresh"');
    expect(ui).toContain('data-action-id={`settings.plugins.install.${note.id}`}');
    expect(ui).toContain('data-action-id={`settings.plugins.remove.${note.name}`}');
    expect(ui).toContain('data-settings-automations="launcher"');
    expect(ui).toContain('data-action-id="settings.automations.open"');
    expect(ui).toContain('data-settings-advanced="tools-browser"');
    expect(ui).toContain('data-agentic-pattern-source="settings-advanced"');
    expect(ui).toContain("props.studioTools");
    expect(app).toContain("getMarketplaceNotes");
    expect(app).toContain("listStudioTools");
    expect(app).toContain("getBrowserStatus");
  });

  it("keeps macOS setup inside Settings instead of blocking the console", async () => {
    const app = await readFile(join(process.cwd(), "apps", "studio", "src", "App.tsx"), "utf-8");
    const components = await readFile(join(process.cwd(), "apps", "studio", "src", "workbench-components.tsx"), "utf-8");
    const ui = `${app}\n${components}`;

    expect(app).not.toContain('data-studio-shell="setup-wizard"');
    expect(app).toContain('data-studio-shell="harness-console"');
    expect(app).toContain("finishSetup");
    expect(app).toContain("openComputerTarget");
    expect(ui).not.toContain("SetupWizard");
    expect(ui).toContain('data-settings-setup="macos-download-readiness"');
    expect(ui).toContain('data-setup-step="install-source"');
    expect(ui).toContain('data-setup-step="workspace"');
    expect(ui).toContain('data-download-ready="macos-dmg"');
    expect(ui).toContain('data-action-id="setup.finish"');
    expect(ui).toContain('data-action-id="download.copy-dmg-path"');
    expect(ui).not.toContain('data-action-id="setup.open"');
    expect(ui).toContain("Mémoire Studio_0.16.3_aarch64.dmg");
    expect(ui).not.toContain('data-agent-tools-rail="studio-actions"');
  });

  it("keeps backend APIs available and exposes marketplace notes through Settings plugins", async () => {
    const app = await readFile(join(process.cwd(), "apps", "studio", "src", "App.tsx"), "utf-8");
    const components = await readFile(join(process.cwd(), "apps", "studio", "src", "workbench-components.tsx"), "utf-8");
    const api = await readFile(join(process.cwd(), "apps", "studio", "src", "studio-api.ts"), "utf-8");
    const rust = await readFile(join(process.cwd(), "apps", "studio", "src-tauri", "src", "lib.rs"), "utf-8");

    expect(api).toContain("getMarketplaceNotes");
    expect(api).toContain("installMarketplaceNote");
    expect(api).toContain("removeMarketplaceNote");
    expect(api).toContain("getAgentKitPlans");
    expect(api).toContain("installAgentKit");
    expect(api).toContain("getDesignSystemTrace");
    expect(api).toContain('"/api/design-system/trace"');
    expect(api).toContain('invoke<AgentKitInstallResult>("agent_install"');
    expect(rust).toContain("fn agent_install");
    expect(app).toContain("marketplaceNotes");
    expect(app).not.toContain("AgentKitPanel");
    expect(components).toContain('data-marketplace-notes="memoire-notes"');
    expect(app).not.toContain('data-agent-kits="memoire-installers"');
  });

  it("keeps harness readiness and Claude-safe run gating in the first-screen path", async () => {
    const app = await readFile(join(process.cwd(), "apps", "studio", "src", "App.tsx"), "utf-8");
    const manifest = await readFile(join(process.cwd(), "src", "studio", "harness-manifest.json"), "utf-8");

    expect(app).toContain("harnessCanRun(currentHarness, effectiveAction)");
    expect(app).toContain("harnessReadinessLabel(currentHarness)");
    expect(app).toContain("findLatestFailureEvent(events)");
    expect(app).toContain("visibleRecentSessions");
    expect(manifest).toContain('"--verbose"');
    expect(manifest).toContain('"claude-stream-json"');
  });

  it("renders structured model results instead of one joined result wall", async () => {
    const components = await readFile(join(process.cwd(), "apps", "studio", "src", "workbench-components.tsx"), "utf-8");
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");

    expect(components).toContain("StructuredResultSections");
    expect(components).toContain("FormattedMessage");
    expect(components).toContain("FileReferenceChip");
    expect(components).toContain("TokenUsageStrip");
    expect(components).toContain("CommandTraceBlock");
    expect(components).toContain("TuiInlineBlock");
    expect(components).toContain('data-tui-inline="collapsible"');
    expect(components).toContain("stripAnsi");
    expect(components).not.toContain('<strong className="result-summary">{block.messages.join("").trim() || "Result"}</strong>');
    expect(css).toContain(".result-section");
    expect(css).toContain(".file-reference-chip");
    expect(css).toContain(".token-usage-strip");
    expect(css).toContain(".command-trace-block");
    expect(css).toContain(".tui-inline");
    expect(css).toContain(".inline-changed-files");
  });

  it("shows an auditable activity timeline for file reads, searches, and running terminals", async () => {
    const app = await readFile(join(process.cwd(), "apps", "studio", "src", "App.tsx"), "utf-8");
    const components = await readFile(join(process.cwd(), "apps", "studio", "src", "workbench-components.tsx"), "utf-8");
    const api = await readFile(join(process.cwd(), "apps", "studio", "src", "studio-api.ts"), "utf-8");
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");

    expect(app).toContain("ActivityTimeline");
    expect(app).toContain("traceModel.activities");
    expect(app).toContain("traceModel.activeProcesses");
    expect(components).toContain("export function ActivityTimeline");
    expect(components).toContain('data-agent-activity="timeline"');
    expect(components).toContain('data-tool-trace-card');
    expect(components).toContain('data-running-terminals="active-processes"');
    expect(components).toContain("activityGlyph");
    expect(components).toContain('"read"');
    expect(components).toContain('"search"');
    expect(components).toContain('"run"');
    expect(components).toContain('data-tool-trace-card');
    expect(api).toContain("StudioActivityItem");
    expect(api).toContain("activeProcesses: StudioActiveProcess[]");
    expect(css).toContain(".activity-timeline");
    expect(css).toContain(".activity-row");
    expect(css).toContain(".running-terminals-strip");
    expect(css).toContain("grid-template-columns: auto minmax(0, 1fr) auto");
  });

  it("renders the design-system workbench with side chat and a main artifact canvas", async () => {
    const app = await readFile(join(process.cwd(), "apps", "studio", "src", "App.tsx"), "utf-8");
    const components = await readFile(join(process.cwd(), "apps", "studio", "src", "workbench-components.tsx"), "utf-8");
    const api = await readFile(join(process.cwd(), "apps", "studio", "src", "studio-api.ts"), "utf-8");
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");

    expect(app).toContain('data-agent-workbench="design-system"');
    expect(app).toContain('data-agent-chat-rail="model-reasoning"');
    expect(app).toContain('data-right-pane-tabs="design-system-research-changelog"');
    expect(app).toContain('role="tablist"');
    expect(app).toContain('data-action-id={`right-pane.tab.${tab.id}`}');
    expect(app).toContain("RIGHT_PANE_TABS");
    expect(app).toContain('id: "design-system", label: "Design System"');
    expect(app).toContain('id: "mirofish-research", label: "Mirofish Research"');
    expect(app).toContain('id: "design-changelog", label: "Changelog"');
    expect(app).toContain('data-artifact-canvas={rightPaneTab}');
    expect(app).toContain('rightPaneTab === "design-system"');
    expect(app).toContain('rightPaneTab === "mirofish-research"');
    expect(app).toContain('rightPaneTab === "design-changelog"');
    expect(app).toContain("DesignSystemReviewSurface");
    expect(app).toContain("renderScenarioLab()");
    expect(app).toContain("listDesignSystemArtifacts");
    expect(app).toContain("reviewDesignSystemArtifactSection");
    expect(components).toContain("DesignSystemReviewSurface");
    expect(components).toContain("DesignSystemSandbox");
    expect(components).toContain("artifact.assets");
    expect(components).toContain("artifact.tokens");
    expect(components).toContain('data-artifact-assets="resolved"');
    expect(components).toContain('data-token-evidence="resolved"');
    expect(components).toContain('data-design-system-artifact="review-surface"');
    expect(components).toContain('data-artifact-acceptance-state');
    expect(components).toContain('data-design-system-sandbox="local-container"');
    expect(components).toContain('data-artifact-preview="brand-lockups"');
    expect(components).toContain('data-artifact-preview="type-ramp"');
    expect(components).toContain('data-artifact-preview="token-swatches"');
    expect(components).toContain('data-artifact-preview="spacing-scale"');
    expect(components).toContain('data-artifact-preview="component-playground"');
    expect(components).toContain('data-component-tabs="preview-variants-states"');
    expect(components).toContain('data-component-lab="playground-sandbox"');
    expect(components).toContain('data-component-inspector="props-tokens-source"');
    expect(components).toContain('data-component-console="agent-cli"');
    expect(components).toContain('data-review-action="looks_good"');
    expect(components).toContain('data-review-action="needs_work"');
    expect(components).toContain('data-action-id="artifact.use-system"');
    expect(components).toContain("SourceReferenceChips");
    expect(api).toContain("listDesignSystemArtifacts");
    expect(api).toContain("captureDesignSystemArtifact");
    expect(api).toContain("reviewDesignSystemArtifactSection");
    expect(api).toContain('"/api/artifacts"');
    expect(css).toContain(".agent-workbench");
    expect(css).toContain(".agent-chat-rail");
    expect(css).toContain(".artifact-canvas");
    expect(css).toContain(".design-system-review");
    expect(css).toContain(".design-system-sandbox");
    expect(css).toContain(".brand-reference");
    expect(css).toContain(".token-reference");
    expect(css).toContain(".component-reference");
  });

  it("renders design changelog in the right pane with editor, filters, and export actions", async () => {
    const app = await readFile(join(process.cwd(), "apps", "studio", "src", "App.tsx"), "utf-8");
    const components = await readFile(join(process.cwd(), "apps", "studio", "src", "workbench-components.tsx"), "utf-8");
    const api = await readFile(join(process.cwd(), "apps", "studio", "src", "studio-api.ts"), "utf-8");
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");
    const ui = `${app}\n${components}`;

    expect(app).toContain("DesignChangelogPage");
    expect(app).toContain("designChangelogEntries");
    expect(app).toContain("listDesignChangelogEntries");
    expect(app).toContain("createDesignChangelogEntry");
    expect(app).toContain("archiveDesignChangelogEntry");
    expect(app).toContain("restoreDesignChangelogEntry");
    expect(app).toContain("exportDesignChangelogMarkdown");
    expect(app).toContain('setRightPaneTab("design-changelog")');
    expect(app).toContain('rightPaneTab === "design-changelog"');
    expect(app).toContain('data-artifact-canvas={rightPaneTab}');
    expect(app).not.toContain('mainSurface === "changelog"');
    expect(ui).toContain('data-design-changelog-page="design-memory"');
    expect(ui).toContain('data-design-changelog-filter="all"');
    expect(ui).toContain('data-design-changelog-filter="agent"');
    expect(ui).toContain('data-design-changelog-filter="manual"');
    expect(ui).toContain('data-design-changelog-filter="needs-evidence"');
    expect(ui).toContain('data-design-changelog-filter="archived"');
    expect(ui).toContain('data-design-changelog-editor="local-project-memory"');
    expect(ui).toContain('data-action-id="design-changelog.new"');
    expect(ui).toContain('data-action-id="design-changelog.export"');
    expect(ui).toContain('data-action-id="design-changelog.save"');
    expect(api).toContain('"/api/design-changelog"');
    expect(api).toContain("DesignChangelogEntry");
    expect(css).toContain(".design-changelog-page");
    expect(css).toContain(".design-changelog-editor");
  });
});
