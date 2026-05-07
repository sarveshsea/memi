import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type ClipboardEvent, type DragEvent, type KeyboardEvent, type PointerEvent } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import {
  cancelSession,
  callStudioTool,
  callComputerAction,
  captureAttachment,
  archiveDesignChangelogEntry,
  connectFigma,
  createAutomation,
  createDesignChangelogEntry,
  deleteAutomation,
  disconnectFigma,
  exportDesignChangelogMarkdown,
  exportNoteForkPr,
  forkMarketplaceNote,
  getAutomationSchedulerStatus,
  getAutomationTemplates,
  getBrowserStatus,
  getCompatibility,
  getComputerStatus,
  getDesignSystemTrace,
  getFigmaStatus,
  getKnowledgeIndex,
  getMarketplaceNotes,
  getNoteForkDiff,
  getNoteForkFiles,
  getKnowledgeItem,
  getProjectMemory,
  getProjectMemoryItem,
  getSessionEvents,
  getSessionTrace,
  getStatus,
  installAutomationScheduler,
  installMarketplaceNote,
  listAutomationRuns,
  listAutomations,
  listDesignChangelogEntries,
  listDesignSystemArtifacts,
  listNoteForks,
  listSessions,
  listHarnesses,
  listStudioTools,
  openComputerTarget,
  openFigma,
  openMermaidJamIntegration,
  refreshKnowledgeIndex,
  refreshProjectMemory,
  removeMarketplaceNote,
  restoreDesignChangelogEntry,
  runFigmaAction,
  saveConfig,
  selectWorkspace,
  startSession,
  subscribeDownloadEvents,
  subscribeSession,
  updateNoteForkFile,
  validateNoteFork,
  reviewDesignSystemArtifactSection,
  runAutomationNow,
  uninstallAutomationScheduler,
  updateAutomation,
  updateDesignChangelogEntry,
  type DesignChangelogCreateInput,
  type DesignChangelogEntry,
  type DesignChangelogPatchInput,
  type DesignSystemArtifact,
  type FigmaAction,
  type FigmaActionRequest,
  type FigmaActionResult,
  type FigmaStatus,
  type Harness,
  type HarnessId,
  type MermaidBoard,
  type MermaidBoardExport,
  type MermaidBoardNodeKind,
  type MarketplaceNotesPayload,
  type NoteForkDiff,
  type NoteForkFile,
  type NoteForkPrHandoff,
  type NoteForkSummary,
  type NoteForkValidation,
  type ProjectMemoryIndex,
  type ProjectMemoryItem,
  type SessionSummary,
  type StudioAction,
  type StudioAutomationDefinition,
  type StudioAutomationRun,
  type StudioAutomationSchedulerStatus,
  type StudioAutomationTemplate,
  type StudioChatMode,
  type StudioCompatibilitySnapshot,
  type StudioConfig,
  type StudioCodexReasoningEffort,
  type StudioBrowserStatus,
  type StudioComputerStatus,
  type StudioDesignSystemTrace,
  type StudioEvent,
  type StudioInputMode,
  type StudioKnowledgeIndex,
  type StudioKnowledgeItem,
  type StudioPermissionMode,
  type StudioStatus,
  type StudioToolDefinition,
  type StudioToolCallResult,
  type StudioTraceSnapshot,
  type StudioAttachment,
  type StudioAttachmentSource,
  type StudioDownloadJob,
} from "./studio-api";
import { deriveStudioTrace, type StudioTraceModel } from "../../../src/studio/view-model";
import {
  CommandBar,
  TerminalBlock as TerminalBlockSurface,
} from "./studio-primitives";
import {
  BlockBody,
  ActivityTimeline,
  AttachmentShelf,
  AutomationCenter,
  ChangedFilesPanel,
  ChatQualityLayer,
  CommandPalette,
  ContextRail,
  DesignChangelogPage,
  DesignSystemReviewSurface,
  FigmaDriver,
  MermaidBoardSurface,
  MemoireLogoMark,
  ProjectSidebar,
  SettingsPanel,
  StudioControlIcon,
  buildTerminalBlocks,
  copyText,
  deriveSessionStatus,
  filterTerminalBlocksByQuery,
  filterContextItems,
  filterKnowledgeItems,
  formatTime,
  isFigmaBridgeRunning,
  trimText,
  type TerminalBlock,
} from "./workbench-components";

const STARTER_PROMPTS = [
  { label: "Hero", prompt: "Hero draft" },
  { label: "Audit", prompt: "Token audit" },
  { label: "Spec", prompt: "Shell spec" },
];

const ACTIONS: Array<{ id: StudioAction; label: string }> = [
  { id: "compose", label: "Compose" },
  { id: "design-doc", label: "Doc" },
  { id: "audit", label: "Audit" },
  { id: "references", label: "Refs" },
  { id: "video", label: "Video" },
  { id: "raw", label: "Raw" },
  { id: "app-build", label: "Build" },
  { id: "self-design", label: "Design" },
  { id: "research", label: "Research" },
  { id: "simulate", label: "Simulate" },
  { id: "fix", label: "Fix" },
  { id: "browser-audit", label: "Browser" },
  { id: "handoff", label: "Handoff" },
];

const CHAT_MODES: Array<{ id: StudioChatMode; label: string }> = [
  { id: "ideate", label: "Ideate" },
  { id: "research", label: "Research" },
  { id: "build", label: "Build" },
  { id: "terminal", label: "Terminal" },
  { id: "review", label: "Review" },
];

const PERMISSION_MODES: Array<{ id: StudioPermissionMode; label: string }> = [
  { id: "plan", label: "Plan" },
  { id: "guarded", label: "Guarded" },
  { id: "full_access", label: "Full access" },
];

type RightPaneTab = "run" | "changes" | "design-system" | "mirofish-research" | "mermaid-board" | "design-changelog" | "figma" | "memory";
type CenterStageMode = "creation" | "chat" | "trace" | "files" | "inspector";
type ScenarioLabNodeKind = "agent" | "finding" | "variable" | "outcome";

interface PaneIntent {
  tab: RightPaneTab;
  reason: string;
  confidence: number;
  sourceEventId?: string;
  highlightIds?: string[];
}

interface ScenarioModelProfile {
  id: string;
  label: string;
  provider: string;
  model: string;
  available: boolean;
}

interface ScenarioTranscriptItem {
  id: string;
  agentId?: string | null;
  modelProfileId: string;
  response: string;
}

interface ScenarioMatrixRunItem {
  hypothesis?: string;
  run?: {
    id: string;
    status: string;
    eventCount: number;
    rounds?: unknown[];
    transcripts?: ScenarioTranscriptItem[];
    costs?: { inputTokens?: number; outputTokens?: number; estimatedCostUsd?: number };
    scorecard?: { adoption?: number; resistance?: number; confidence?: number; risk?: number };
  };
}

interface ScenarioMatrixState {
  runs: ScenarioMatrixRunItem[];
  comparison?: { winnerRunId?: string | null; summary?: string };
}

interface ScenarioDesignPackage {
  id: string;
  brief?: {
    audience?: string[];
    vibePrinciples?: string[];
    visualDirection?: string[];
    openQuestions?: string[];
  };
  specs?: {
    design?: unknown[];
    ia?: unknown[];
    pages?: unknown[];
    components?: unknown[];
    dataviz?: unknown[];
  };
  mermaidArtifacts?: Array<{ id: string; title: string; kind: string; format: string }>;
  warnings?: string[];
}

interface ScenarioFigJamExport {
  id: string;
  title: string;
  kind: string;
  format: string;
  outputPath: string;
  nextSteps?: string[];
}

interface ScenarioLabNode extends SimulationNodeDatum {
  id: string;
  label: string;
  kind: ScenarioLabNodeKind;
}

interface PositionedScenarioLabNode extends ScenarioLabNode {
  x: number;
  y: number;
}

const RIGHT_PANE_TABS: Array<{ id: RightPaneTab; label: string }> = [
  { id: "run", label: "Run" },
  { id: "changes", label: "Changes" },
  { id: "design-system", label: "Design System" },
  { id: "mirofish-research", label: "Mirofish Research" },
  { id: "mermaid-board", label: "Mermaid Board" },
  { id: "design-changelog", label: "Changelog" },
  { id: "figma", label: "Figma" },
  { id: "memory", label: "Memory" },
];
const CENTER_STAGE_MODES: Array<{ id: CenterStageMode; label: string }> = [
  { id: "creation", label: "Creation" },
  { id: "chat", label: "Chat" },
  { id: "trace", label: "Trace" },
  { id: "files", label: "Files" },
  { id: "inspector", label: "Inspector" },
];

const SCENARIO_TOOL_IDS = ["simulation.models", "simulation.run_matrix", "simulation.transcript", "research.design_package", "mermaid_jam.export"] as const;

const PRIMARY_HARNESS_IDS: HarnessId[] = ["claude-code", "codex", "hermes"];
const DEFAULT_PRIMARY_HARNESS_ID: HarnessId = "codex";
const LIVE_EVENT_LIMIT = 220;
const SESSION_EVENT_LIMIT = 120;
const TRACE_REFRESH_DELAY_MS = 350;
const PROJECT_SIDEBAR_COLLAPSED_KEY = "memoire.studio.projectSidebarCollapsed";
const PROJECT_SIDEBAR_EXPANDED_KEY = "memoire.studio.expandedProjectIds";
const CHAT_RAIL_WIDTH_KEY = "memoire.studio.chatRailWidthPercent";
const CHAT_MEMORY_PINS_KEY = "memoire.studio.chatMemoryPins";
const DEFAULT_CHAT_RAIL_WIDTH_PERCENT = 48;
const MIN_CHAT_RAIL_WIDTH_PERCENT = 36;
const MAX_CHAT_RAIL_WIDTH_PERCENT = 68;

interface StudioActionRegistryItem {
  id: string;
  label: string;
  kind: "local" | "runtime";
  surface: "topbar" | "command" | "cockpit" | "context" | "figma" | "settings" | "computer" | "changelog" | "board";
}

const STUDIO_ACTION_REGISTRY: StudioActionRegistryItem[] = [
  { id: "theme.light", label: "Light", kind: "local", surface: "topbar" },
  { id: "theme.dark", label: "Dark", kind: "local", surface: "topbar" },
  { id: "settings.open", label: "Settings", kind: "local", surface: "settings" },
  { id: "command-palette.open", label: "Palette", kind: "local", surface: "command" },
  { id: "input-mode.agent", label: "Agent", kind: "local", surface: "command" },
  { id: "input-mode.terminal", label: "Terminal", kind: "local", surface: "command" },
  { id: "input-mode.auto", label: "Auto", kind: "local", surface: "command" },
  { id: "conversation.scroll-latest", label: "Latest", kind: "local", surface: "command" },
  { id: "session.run", label: "Run", kind: "runtime", surface: "command" },
  { id: "session.cancel", label: "Stop", kind: "runtime", surface: "command" },
  { id: "session.open", label: "Open", kind: "runtime", surface: "cockpit" },
  { id: "runtime.refresh", label: "Refresh", kind: "runtime", surface: "topbar" },
  { id: "memory.refresh", label: "Memory", kind: "runtime", surface: "context" },
  { id: "context.open", label: "Context", kind: "runtime", surface: "context" },
  { id: "knowledge.refresh", label: "Knowledge", kind: "runtime", surface: "context" },
  { id: "knowledge.open", label: "Open", kind: "runtime", surface: "context" },
  { id: "changelog.open.sidebar", label: "Changelog", kind: "local", surface: "changelog" },
  { id: "design-changelog.new", label: "New", kind: "runtime", surface: "changelog" },
  { id: "design-changelog.export", label: "Export", kind: "runtime", surface: "changelog" },
  { id: "right-pane.tab.run", label: "Run", kind: "local", surface: "cockpit" },
  { id: "right-pane.tab.changes", label: "Changes", kind: "local", surface: "cockpit" },
  { id: "right-pane.tab.design-system", label: "System", kind: "local", surface: "cockpit" },
  { id: "right-pane.tab.mirofish-research", label: "Research", kind: "local", surface: "cockpit" },
  { id: "right-pane.tab.mermaid-board", label: "Board", kind: "local", surface: "board" },
  { id: "right-pane.tab.design-changelog", label: "Changelog", kind: "local", surface: "changelog" },
  { id: "right-pane.tab.figma", label: "Figma", kind: "local", surface: "figma" },
  { id: "right-pane.tab.memory", label: "Memory", kind: "local", surface: "context" },
  { id: "board.create", label: "Board", kind: "runtime", surface: "board" },
  { id: "board.add_node", label: "Node", kind: "runtime", surface: "board" },
  { id: "board.export_mermaid_jam", label: "Export", kind: "runtime", surface: "board" },
  { id: "figma.connect", label: "Start", kind: "runtime", surface: "figma" },
  { id: "figma.disconnect", label: "Stop", kind: "runtime", surface: "figma" },
  { id: "figma.open", label: "Open Figma", kind: "runtime", surface: "figma" },
  { id: "figma.action", label: "Figma", kind: "runtime", surface: "figma" },
  { id: "computer.status", label: "Computer", kind: "runtime", surface: "computer" },
  { id: "computer.action", label: "Run", kind: "runtime", surface: "computer" },
];

export function App() {
  const scrollRegionRef = useRef<HTMLElement | null>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);
  const latestScrollRestoringRef = useRef(false);
  const scrollRetryTimeoutsRef = useRef<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const traceRefreshTimerRef = useRef<number | null>(null);
  const pendingTraceSessionIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<StudioStatus | null>(null);
  const [harnesses, setHarnesses] = useState<Harness[]>([]);
  const [selectedHarness, setSelectedHarness] = useState<HarnessId>("codex");
  const [selectedAction, setSelectedAction] = useState<StudioAction>("app-build");
  const [chatMode, setChatMode] = useState<StudioChatMode>("ideate");
  const [permissionMode, setPermissionMode] = useState<StudioPermissionMode>("guarded");
  const [themeMode, setThemeMode] = useState<"light" | "dark">("dark");
  const [inputMode, setInputMode] = useState<StudioInputMode>("agent");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState("Setup");
  const [automationsOpen, setAutomationsOpen] = useState(false);
  const [automations, setAutomations] = useState<StudioAutomationDefinition[]>([]);
  const [automationTemplates, setAutomationTemplates] = useState<StudioAutomationTemplate[]>([]);
  const [automationRuns, setAutomationRuns] = useState<Record<string, StudioAutomationRun[]>>({});
  const [automationScheduler, setAutomationScheduler] = useState<StudioAutomationSchedulerStatus | null>(null);
  const [automationBusyId, setAutomationBusyId] = useState<string | null>(null);
  const [marketplaceNotes, setMarketplaceNotes] = useState<MarketplaceNotesPayload | null>(null);
  const [marketplaceBusyId, setMarketplaceBusyId] = useState<string | null>(null);
  const [marketplaceError, setMarketplaceError] = useState<string | null>(null);
  const [marketplaceDownloadJobs, setMarketplaceDownloadJobs] = useState<Record<string, StudioDownloadJob>>({});
  const [selectedMarketplaceNoteId, setSelectedMarketplaceNoteId] = useState<string | null>(null);
  const [noteForks, setNoteForks] = useState<NoteForkSummary[]>([]);
  const [selectedNoteForkId, setSelectedNoteForkId] = useState<string | null>(null);
  const [noteForkFiles, setNoteForkFiles] = useState<NoteForkFile[]>([]);
  const [selectedNoteForkFile, setSelectedNoteForkFile] = useState<string | null>(null);
  const [noteForkValidation, setNoteForkValidation] = useState<NoteForkValidation | null>(null);
  const [noteForkDiff, setNoteForkDiff] = useState<NoteForkDiff | null>(null);
  const [noteForkPrHandoff, setNoteForkPrHandoff] = useState<NoteForkPrHandoff | null>(null);
  const [designChangelogEntries, setDesignChangelogEntries] = useState<DesignChangelogEntry[]>([]);
  const [designChangelogLoading, setDesignChangelogLoading] = useState(false);
  const [designChangelogError, setDesignChangelogError] = useState<string | null>(null);
  const [studioTools, setStudioTools] = useState<StudioToolDefinition[]>([]);
  const [browserStatus, setBrowserStatus] = useState<StudioBrowserStatus | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState("");
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [chatMemoryPins, setChatMemoryPins] = useState<string[]>(() => readStringArrayPreference(CHAT_MEMORY_PINS_KEY).slice(0, 6));
  const [contextQuery, setContextQuery] = useState("");
  const [contextFilter, setContextFilter] = useState("all");
  const [prompt, setPrompt] = useState(STARTER_PROMPTS[0].prompt);
  const [session, setSession] = useState<SessionSummary | null>(null);
  const [recentSessions, setRecentSessions] = useState<SessionSummary[]>([]);
  const [events, setEvents] = useState<StudioEvent[]>([]);
  const [serverTrace, setServerTrace] = useState<StudioTraceSnapshot | null>(null);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectMemory, setProjectMemory] = useState<ProjectMemoryIndex | null>(null);
  const [knowledgeIndex, setKnowledgeIndex] = useState<StudioKnowledgeIndex | null>(null);
  const [compatibility, setCompatibility] = useState<StudioCompatibilitySnapshot | null>(null);
  const [computerStatus, setComputerStatus] = useState<StudioComputerStatus | null>(null);
  const [designTrace, setDesignTrace] = useState<StudioDesignSystemTrace | null>(null);
  const [designArtifacts, setDesignArtifacts] = useState<DesignSystemArtifact[]>([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [scenarioHypothesis, setScenarioHypothesis] = useState("Research-backed spec changes reduce product risk.");
  const [scenarioVariable, setScenarioVariable] = useState("Evidence strength");
  const [selectedScenarioNode, setSelectedScenarioNode] = useState("agent-pm");
  const [scenarioModels, setScenarioModels] = useState<ScenarioModelProfile[]>([]);
  const [scenarioMatrix, setScenarioMatrix] = useState<ScenarioMatrixState | null>(null);
  const [scenarioTranscripts, setScenarioTranscripts] = useState<ScenarioTranscriptItem[]>([]);
  const [scenarioDesignPackage, setScenarioDesignPackage] = useState<ScenarioDesignPackage | null>(null);
  const [scenarioFigJamExports, setScenarioFigJamExports] = useState<ScenarioFigJamExport[]>([]);
  const [scenarioRunning, setScenarioRunning] = useState(false);
  const [rightPaneTab, setRightPaneTab] = useState<RightPaneTab>("design-system");
  const [centerStageMode, setCenterStageMode] = useState<CenterStageMode>("creation");
  const [paneIntent, setPaneIntent] = useState<PaneIntent | null>(null);
  const [mermaidBoard, setMermaidBoard] = useState<MermaidBoard | null>(null);
  const [mermaidBoardExports, setMermaidBoardExports] = useState<MermaidBoardExport[]>([]);
  const [mermaidBoardLoading, setMermaidBoardLoading] = useState(false);
  const [mermaidBoardError, setMermaidBoardError] = useState<string | null>(null);
  const [knowledgeQuery, setKnowledgeQuery] = useState("");
  const [knowledgeFilter, setKnowledgeFilter] = useState("all");
  const [figmaStatus, setFigmaStatus] = useState<FigmaStatus | null>(null);
  const [figmaActionResult, setFigmaActionResult] = useState<FigmaActionResult | null>(null);
  const [figmaConnecting, setFigmaConnecting] = useState(false);
  const [figmaActionRunning, setFigmaActionRunning] = useState(false);
  const [figmaError, setFigmaError] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<StudioConfig | null>(null);
  const [settingsSavedAt, setSettingsSavedAt] = useState<string | null>(null);
  const [selectedContextItem, setSelectedContextItem] = useState<ProjectMemoryItem | null>(null);
  const [contextItemDetail, setContextItemDetail] = useState<ProjectMemoryItem | null>(null);
  const [selectedKnowledgeItem, setSelectedKnowledgeItem] = useState<StudioKnowledgeItem | null>(null);
  const [knowledgeItemDetail, setKnowledgeItemDetail] = useState<StudioKnowledgeItem | null>(null);
  const [collapsedBlockIds, setCollapsedBlockIds] = useState<Set<string>>(new Set());
  const [userPinnedToBottom, setUserPinnedToBottom] = useState(true);
  const [attachments, setAttachments] = useState<StudioAttachment[]>([]);
  const [projectSidebarCollapsed, setProjectSidebarCollapsed] = useState(() =>
    readBooleanPreference(PROJECT_SIDEBAR_COLLAPSED_KEY, typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches),
  );
  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>(() => readStringArrayPreference(PROJECT_SIDEBAR_EXPANDED_KEY));
  const [chatRailWidthPercent, setChatRailWidthPercent] = useState(() =>
    readNumberPreference(CHAT_RAIL_WIDTH_KEY, DEFAULT_CHAT_RAIL_WIDTH_PERCENT, MIN_CHAT_RAIL_WIDTH_PERCENT, MAX_CHAT_RAIL_WIDTH_PERCENT),
  );

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      if (event.key === "," && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSettingsOpen(true);
      }
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        openCommandPalette();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    return () => {
      if (traceRefreshTimerRef.current !== null) window.clearTimeout(traceRefreshTimerRef.current);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(PROJECT_SIDEBAR_COLLAPSED_KEY, JSON.stringify(projectSidebarCollapsed));
  }, [projectSidebarCollapsed]);

  useEffect(() => {
    window.localStorage.setItem(PROJECT_SIDEBAR_EXPANDED_KEY, JSON.stringify(expandedProjectIds));
  }, [expandedProjectIds]);

  useEffect(() => {
    window.localStorage.setItem(CHAT_RAIL_WIDTH_KEY, JSON.stringify(chatRailWidthPercent));
  }, [chatRailWidthPercent]);

  useEffect(() => {
    window.localStorage.setItem(CHAT_MEMORY_PINS_KEY, JSON.stringify(chatMemoryPins.slice(0, 6)));
  }, [chatMemoryPins]);

  useEffect(() => {
    if (!isFigmaBridgeRunning(figmaStatus)) return;
    const timer = window.setInterval(() => {
      void getFigmaStatus()
        .then(setFigmaStatus)
        .catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [figmaStatus?.bridgeStatus, figmaStatus?.running]);

  useEffect(() => {
    const notes = marketplaceNotes?.notes ?? [];
    if (notes.length === 0) {
      if (selectedMarketplaceNoteId) setSelectedMarketplaceNoteId(null);
      return;
    }
    if (!selectedMarketplaceNoteId || !notes.some((note) => note.id === selectedMarketplaceNoteId)) {
      setSelectedMarketplaceNoteId(notes[0].id);
    }
  }, [marketplaceNotes, selectedMarketplaceNoteId]);

  useEffect(() => {
    if (noteForkFiles.length === 0) {
      if (selectedNoteForkFile) setSelectedNoteForkFile(null);
      return;
    }
    if (!selectedNoteForkFile || !noteForkFiles.some((file) => file.path === selectedNoteForkFile)) {
      setSelectedNoteForkFile(noteForkFiles[0].path);
    }
  }, [noteForkFiles, selectedNoteForkFile]);

  useEffect(() => {
    if (!session) return;
    if (session.source === "persisted" || session.status !== "running") return;
    return subscribeSession(session.id, (event) => {
      setEvents((current) => [...current, event].slice(-LIVE_EVENT_LIMIT));
      scheduleSessionTraceRefresh(event.sessionId);
      if (["artifact", "design_system_artifact", "design_decision", "session_done"].includes(event.type)) {
        window.setTimeout(() => {
          void listDesignSystemArtifacts().then(setDesignArtifacts).catch(() => undefined);
        }, TRACE_REFRESH_DELAY_MS);
      }
    });
  }, [session]);

  const currentHarness = useMemo(
    () => harnesses.find((harness) => harness.id === selectedHarness),
    [harnesses, selectedHarness],
  );
  const visibleHarnesses = useMemo(() => primaryHarnesses(harnesses), [harnesses]);

  const harnessActions = useMemo(() => actionsForHarness(currentHarness), [currentHarness]);
  const effectiveAction: StudioAction = resolveHarnessAction(selectedAction, currentHarness);
  const effectiveActionLabel = harnessActions.find((action) => action.id === effectiveAction)?.label ?? effectiveAction;
  const sessionStatus = deriveSessionStatus(session, events);
  const visibleSessionStatus = isStartingSession ? "starting" : sessionStatus;
  const isSessionActive = isStartingSession || sessionStatus === "running";
  const harnessStatusCopy = harnessReadinessLabel(currentHarness);
  const canRunSession = Boolean(status && prompt.trim() && !isSessionActive && harnessCanRun(currentHarness, effectiveAction));
  const memoryItems = projectMemory?.items ?? [];
  const knowledgeItems = knowledgeIndex?.items ?? [];
  const localTraceModel = useMemo(
    () => deriveStudioTrace({
      session: session ? { id: session.id, action: effectiveAction, status: sessionStatus } : null,
      events,
    }),
    [effectiveAction, events, session, sessionStatus],
  );
  const traceModel: StudioTraceModel = serverTrace && serverTrace.sessionId === session?.id
    ? {
        ...localTraceModel,
        ...serverTrace,
        activities: (serverTrace as Partial<StudioTraceModel>).activities ?? localTraceModel.activities,
        activeProcesses: (serverTrace as Partial<StudioTraceModel>).activeProcesses ?? localTraceModel.activeProcesses,
      }
    : localTraceModel;
  const activeDesignArtifact = useMemo(() => {
    const traceArtifacts = (traceModel.artifacts ?? []) as DesignSystemArtifact[];
    const merged = [...designArtifacts, ...traceArtifacts];
    return merged.find((artifact) => artifact.id === selectedArtifactId)
      ?? traceArtifacts[0]
      ?? designArtifacts[0]
      ?? null;
  }, [designArtifacts, selectedArtifactId, traceModel.artifacts]);
  const lastFailure = useMemo(() => findLatestFailureEvent(events), [events]);
  const latestRun = session ?? recentSessions[0] ?? null;
  const workspaceLabel = status?.projectRoot.split("/").filter(Boolean).at(-1) ?? "workspace";
  const visibleRecentSessions = recentSessions.length ? recentSessions : session ? [session] : [];
  const activeSidebarProjectId = session?.cwd ?? visibleRecentSessions[0]?.cwd ?? status?.projectRoot ?? null;
  useEffect(() => {
    if (!activeSidebarProjectId) return;
    setExpandedProjectIds((current) => current.includes(activeSidebarProjectId) ? current : [activeSidebarProjectId, ...current]);
  }, [activeSidebarProjectId]);
  useEffect(() => {
    const intent = paneIntentForAction(effectiveAction);
    if (!intent) return;
    setPaneIntent(intent);
    setRightPaneTab(intent.tab);
  }, [effectiveAction]);
  useEffect(() => {
    const intent = paneIntentForEvents(events, effectiveAction, lastFailure);
    if (!intent || intent.confidence < 0.75) return;
    setPaneIntent(intent);
    setRightPaneTab(intent.tab);
  }, [effectiveAction, events, lastFailure]);
  useEffect(() => {
    if (rightPaneTab !== "mermaid-board" || !status?.projectRoot || mermaidBoard || mermaidBoardLoading) return;
    void handleCreateMermaidBoard();
  }, [mermaidBoard, mermaidBoardLoading, rightPaneTab, status?.projectRoot]);
  const contextItems = useMemo(
    () => filterContextItems(memoryItems, contextQuery, contextFilter).slice(0, 8),
    [contextFilter, contextQuery, memoryItems],
  );
  const visibleKnowledgeItems = useMemo(
    () => filterKnowledgeItems(knowledgeItems, knowledgeQuery, knowledgeFilter).slice(0, 10),
    [knowledgeFilter, knowledgeItems, knowledgeQuery],
  );
  const workbenchStyle = {
    "--chat-rail-width": `${chatRailWidthPercent}%`,
  } as CSSProperties;

  const terminalBlocks = useMemo(
    () => buildTerminalBlocks({
      session,
      events,
      harnessLabel: currentHarness?.label ?? selectedHarness,
      action: effectiveAction,
      prompt,
    }),
    [currentHarness?.label, effectiveAction, events, prompt, selectedHarness, session],
  );
  const visibleTerminalBlocks = useMemo(
    () => filterTerminalBlocksByQuery(terminalBlocks, chatSearchQuery),
    [chatSearchQuery, terminalBlocks],
  );
  const latestActivity = traceModel.activities.at(-1) ?? null;
  const latestThinkingActivity = [...traceModel.activities].reverse().find((activity) => activity.kind === "thinking") ?? null;
  const latestRunningActivity = [...traceModel.activities].reverse().find((activity) => activity.status === "running") ?? null;
  const hasRunningWork = traceModel.activeProcesses.length > 0
    || traceModel.activities.some((activity) => activity.status === "running" && activity.kind !== "thinking");
  const agentThinkingState: "thinking" | "running" | "idle" | "failed" = lastFailure
    ? "failed"
    : hasRunningWork
      ? "running"
      : isSessionActive
        ? "thinking"
        : "idle";
  const agentLiveLabel = agentThinkingState === "failed"
    ? "Failed"
    : agentThinkingState === "running"
      ? "Running"
      : agentThinkingState === "thinking"
        ? "Thinking"
        : sessionStatus === "completed"
          ? "Done"
          : sessionStatus === "cancelled"
            ? "Stopped"
            : "Idle";
  const agentLiveSummary = lastFailure?.message
    ?? traceModel.activeProcesses[0]?.command
    ?? latestRunningActivity?.summary
    ?? latestThinkingActivity?.summary
    ?? latestActivity?.summary
    ?? visibleSessionStatus;

  useEffect(() => {
    setUserPinnedToBottom(true);
    window.requestAnimationFrame(() => scrollConversationToLatest("auto"));
  }, [session?.id]);

  useEffect(() => {
    if (!userPinnedToBottom) return;
    bottomAnchorRef.current?.scrollIntoView({
      block: "end",
      behavior: isSessionActive ? "smooth" : "auto",
    });
  }, [
    events.length,
    isSessionActive,
    terminalBlocks.length,
    traceModel.activeProcesses.length,
    traceModel.activities.length,
    userPinnedToBottom,
  ]);

  useEffect(() => {
    return () => {
      scrollRetryTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
      scrollRetryTimeoutsRef.current = [];
    };
  }, []);

  async function refresh() {
    try {
      const nextStatus = await getStatus();
      const [
        nextHarnesses,
        nextMemory,
        nextKnowledge,
        nextFigma,
        nextSessions,
        nextCompatibility,
        nextComputer,
        nextDesignTrace,
        nextArtifacts,
        nextMarketplaceNotes,
        nextDesignChangelogEntries,
        nextStudioTools,
        nextBrowserStatus,
        nextAutomations,
        nextAutomationTemplates,
        nextAutomationScheduler,
      ] = await Promise.all([
        nextStatus.harnesses ? Promise.resolve(nextStatus.harnesses) : listHarnesses(),
        getProjectMemory().catch(() => null),
        getKnowledgeIndex().catch(() => null),
        getFigmaStatus().catch(() => null),
        listSessions().catch(() => []),
        getCompatibility().catch(() => null),
        getComputerStatus().catch(() => null),
        getDesignSystemTrace().catch(() => null),
        listDesignSystemArtifacts().catch(() => []),
        getMarketplaceNotes().catch(() => null),
        listDesignChangelogEntries().catch(() => []),
        listStudioTools().catch(() => []),
        getBrowserStatus().catch(() => null),
        listAutomations().catch(() => []),
        getAutomationTemplates().catch(() => []),
        getAutomationSchedulerStatus().catch(() => null),
      ]);
      setStatus(nextStatus);
      setHarnesses(nextHarnesses);
      setSettingsDraft(nextStatus.config);
      setSelectedHarness(normalizePrimaryHarness(nextStatus.config.defaultHarness, nextHarnesses));
      setInputMode(nextStatus.config.ui?.inputMode ?? "agent");
      if (!session && nextStatus.config.codex?.planModeDefault) setPermissionMode("plan");
      setProjectMemory(nextMemory);
      setKnowledgeIndex(nextKnowledge);
      setFigmaStatus(nextFigma);
      setRecentSessions(nextSessions);
      setCompatibility(nextCompatibility);
      setComputerStatus(nextComputer);
      setDesignTrace(nextDesignTrace);
      setDesignArtifacts(nextArtifacts);
      setMarketplaceNotes(nextMarketplaceNotes);
      setDesignChangelogEntries(nextDesignChangelogEntries);
      setStudioTools(nextStudioTools);
      setBrowserStatus(nextBrowserStatus);
      setAutomations(nextAutomations);
      setAutomationTemplates(nextAutomationTemplates);
      setAutomationScheduler(nextAutomationScheduler);
      if (!selectedArtifactId && nextArtifacts[0]) setSelectedArtifactId(nextArtifacts[0].id);
      if (!session && nextSessions[0]) {
        await openSessionSummary(nextSessions[0]);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function scheduleSessionTraceRefresh(sessionId: string) {
    pendingTraceSessionIdRef.current = sessionId;
    if (traceRefreshTimerRef.current !== null) return;
    traceRefreshTimerRef.current = window.setTimeout(() => {
      traceRefreshTimerRef.current = null;
      const nextSessionId = pendingTraceSessionIdRef.current;
      pendingTraceSessionIdRef.current = null;
      void refreshSessionTrace(nextSessionId);
    }, TRACE_REFRESH_DELAY_MS);
  }

  async function refreshSessionTrace(sessionId = session?.id ?? null) {
    if (!sessionId) {
      setServerTrace(null);
      return;
    }
    try {
      const payload = await getSessionTrace(sessionId);
      setServerTrace(payload.trace);
    } catch {
      setServerTrace(null);
    }
  }

  async function openSessionSummary(nextSession: SessionSummary) {
    setSession(nextSession);
    setServerTrace(null);
    setCollapsedBlockIds(new Set());
    setSelectedAction((nextSession.action as StudioAction | undefined) ?? "raw");
    setSelectedHarness(normalizePrimaryHarness(nextSession.harness, harnesses));
    setChatMode(nextSession.chatMode ?? "ideate");
    setPermissionMode(nextSession.permissionMode ?? "guarded");
    try {
      const [eventPayload, tracePayload] = await Promise.all([
        getSessionEvents(nextSession.id, SESSION_EVENT_LIMIT),
        getSessionTrace(nextSession.id),
      ]);
      setEvents(eventPayload.events);
      setServerTrace(tracePayload.trace);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function openSettingsPanel(section = settingsDraft?.setup?.completedAt ? "General" : "Setup") {
    setSettingsSection(section);
    setSettingsOpen(true);
  }

  async function refreshMarketplaceNotes() {
    try {
      const [nextMarketplace, nextForks] = await Promise.all([
        getMarketplaceNotes({ refresh: true }),
        listNoteForks(),
      ]);
      setMarketplaceNotes(nextMarketplace);
      setNoteForks(nextForks);
      setMarketplaceError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMarketplaceError(message);
      setError(message);
    }
  }

  async function refreshDesignChangelog() {
    setDesignChangelogLoading(true);
    try {
      setDesignChangelogEntries(await listDesignChangelogEntries());
      setDesignChangelogError(null);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setDesignChangelogError(message);
      setError(message);
    } finally {
      setDesignChangelogLoading(false);
    }
  }

  async function handleCreateDesignChangelogEntry(input: DesignChangelogCreateInput) {
    try {
      await createDesignChangelogEntry(input);
      await refreshDesignChangelog();
      await refreshMemory();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setDesignChangelogError(message);
      setError(message);
    }
  }

  async function handleUpdateDesignChangelogEntry(id: string, patch: DesignChangelogPatchInput) {
    try {
      await updateDesignChangelogEntry(id, patch);
      await refreshDesignChangelog();
      await refreshMemory();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setDesignChangelogError(message);
      setError(message);
    }
  }

  async function handleArchiveDesignChangelogEntry(id: string) {
    try {
      await archiveDesignChangelogEntry(id);
      await refreshDesignChangelog();
      await refreshMemory();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setDesignChangelogError(message);
      setError(message);
    }
  }

  async function handleRestoreDesignChangelogEntry(id: string) {
    try {
      await restoreDesignChangelogEntry(id);
      await refreshDesignChangelog();
      await refreshMemory();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setDesignChangelogError(message);
      setError(message);
    }
  }

  async function handleExportDesignChangelog() {
    try {
      await copyText(await exportDesignChangelogMarkdown());
      setDesignChangelogError(null);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setDesignChangelogError(message);
      setError(message);
    }
  }

  async function handleInstallMarketplaceNote(noteId: string) {
    setMarketplaceBusyId(noteId);
    try {
      const result = await installMarketplaceNote({ noteId });
      setMarketplaceDownloadJobs((current) => ({ ...current, [noteId]: result.job }));
      subscribeDownloadEvents(result.job.id, (event) => {
        setMarketplaceDownloadJobs((current) => {
          const previous = current[noteId] ?? result.job;
          const status = event.type === "completed" ? "completed" : event.type === "failed" ? "failed" : previous.status;
          return {
            ...current,
            [noteId]: {
              ...previous,
              status,
              progress: event.progress,
              message: event.message,
              updatedAt: event.timestamp,
              completedAt: event.type === "completed" || event.type === "failed" ? event.timestamp : previous.completedAt,
              error: event.type === "failed" ? event.message : previous.error,
            },
          };
        });
        if (event.type === "completed") void refreshMarketplaceNotes();
      });
      setMarketplaceNotes(result.marketplace);
      setMarketplaceError(null);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMarketplaceError(message);
      setError(message);
    } finally {
      setMarketplaceBusyId(null);
    }
  }

  async function handleRemoveMarketplaceNote(name: string) {
    setMarketplaceBusyId(name);
    try {
      setMarketplaceNotes(await removeMarketplaceNote(name));
      setMarketplaceError(null);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMarketplaceError(message);
      setError(message);
    } finally {
      setMarketplaceBusyId(null);
    }
  }

  async function handleForkMarketplaceNote(noteId: string) {
    setMarketplaceBusyId(noteId);
    try {
      const result = await forkMarketplaceNote(noteId);
      setMarketplaceNotes(result.marketplace);
      setNoteForks(await listNoteForks());
      setSelectedNoteForkId(result.fork.name);
      setNoteForkFiles(await getNoteForkFiles(result.fork.name));
      setSelectedNoteForkFile(null);
      setNoteForkValidation(null);
      setNoteForkDiff(null);
      setNoteForkPrHandoff(null);
      setMarketplaceError(null);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMarketplaceError(message);
      setError(message);
    } finally {
      setMarketplaceBusyId(null);
    }
  }

  async function handleSelectNoteFork(name: string) {
    try {
      setSelectedNoteForkId(name);
      setNoteForkFiles(await getNoteForkFiles(name));
      setSelectedNoteForkFile(null);
      setNoteForkValidation(null);
      setNoteForkDiff(null);
      setNoteForkPrHandoff(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMarketplaceError(message);
      setError(message);
    }
  }

  async function handleUpdateNoteForkFile(path: string, content: string) {
    if (!selectedNoteForkId) return;
    try {
      const file = await updateNoteForkFile(selectedNoteForkId, { path, content });
      setNoteForkFiles((current) => current.map((candidate) => candidate.path === file.path ? file : candidate));
      setNoteForkDiff(await getNoteForkDiff(selectedNoteForkId));
      setMarketplaceError(null);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMarketplaceError(message);
      setError(message);
    }
  }

  async function handleValidateNoteFork() {
    if (!selectedNoteForkId) return;
    try {
      setNoteForkValidation(await validateNoteFork(selectedNoteForkId));
      setMarketplaceError(null);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMarketplaceError(message);
      setError(message);
    }
  }

  async function handleExportNoteForkPr() {
    if (!selectedNoteForkId) return;
    try {
      setNoteForkPrHandoff(await exportNoteForkPr(selectedNoteForkId));
      setMarketplaceError(null);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMarketplaceError(message);
      setError(message);
    }
  }

  async function refreshAutomations() {
    const [nextAutomations, nextTemplates, nextScheduler] = await Promise.all([
      listAutomations().catch(() => []),
      getAutomationTemplates().catch(() => []),
      getAutomationSchedulerStatus().catch(() => null),
    ]);
    setAutomations(nextAutomations);
    setAutomationTemplates(nextTemplates);
    setAutomationScheduler(nextScheduler);
  }

  async function loadAutomationHistory(automationId: string) {
    try {
      const runs = await listAutomationRuns(automationId);
      setAutomationRuns((current) => ({ ...current, [automationId]: runs }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleCreateAutomation(input: Partial<StudioAutomationDefinition> & { templateId?: string }) {
    setAutomationBusyId("create");
    try {
      const automation = await createAutomation({
        ...input,
        cwd: input.cwd ?? status?.projectRoot ?? "",
      });
      await refreshAutomations();
      await loadAutomationHistory(automation.id);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAutomationBusyId(null);
    }
  }

  async function handleUpdateAutomation(id: string, patch: Partial<StudioAutomationDefinition>) {
    setAutomationBusyId(id);
    try {
      await updateAutomation(id, patch);
      await refreshAutomations();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAutomationBusyId(null);
    }
  }

  async function handleDeleteAutomation(id: string) {
    setAutomationBusyId(id);
    try {
      await deleteAutomation(id);
      setAutomationRuns((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      await refreshAutomations();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAutomationBusyId(null);
    }
  }

  async function handleRunAutomation(id: string) {
    setAutomationBusyId(id);
    try {
      const run = await runAutomationNow(id);
      await refreshAutomations();
      await loadAutomationHistory(id);
      if (run.sessionId) {
        const nextSessions = await listSessions().catch(() => recentSessions);
        setRecentSessions(nextSessions);
        const nextSession = nextSessions.find((candidate) => candidate.id === run.sessionId);
        if (nextSession) await openSessionSummary(nextSession);
      }
      setError(run.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAutomationBusyId(null);
    }
  }

  async function handleInstallAutomationScheduler() {
    setAutomationBusyId("scheduler");
    try {
      setAutomationScheduler(await installAutomationScheduler());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAutomationBusyId(null);
    }
  }

  async function handleUninstallAutomationScheduler() {
    setAutomationBusyId("scheduler");
    try {
      setAutomationScheduler(await uninstallAutomationScheduler());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAutomationBusyId(null);
    }
  }

  function chooseRightPane(tab: RightPaneTab, reason = "User selected pane") {
    setRightPaneTab(tab);
    setPaneIntent({ tab, reason, confidence: 1 });
  }

  function openPluginsSurface() {
    openSettingsPanel("Plugins");
    void refreshMarketplaceNotes();
  }

  function openFigmaSurface() {
    chooseRightPane("figma", "Figma bridge opened");
    void getFigmaStatus().then(setFigmaStatus).catch(() => undefined);
  }

  function openAutomationsSurface() {
    setAutomationsOpen(true);
    void refreshAutomations();
  }

  function openChangelogSurface() {
    chooseRightPane("design-changelog", "Design memory opened");
    void refreshDesignChangelog();
  }

  function openCommandPalette(query = "") {
    setCommandPaletteQuery(query);
    setCommandPaletteOpen(true);
  }

  function startNewChat() {
    setSession(null);
    setEvents([]);
    setServerTrace(null);
    setCollapsedBlockIds(new Set());
    setPrompt(STARTER_PROMPTS[0].prompt);
  }

  function toggleProjectFolder(projectId: string) {
    setExpandedProjectIds((current) =>
      current.includes(projectId) ? current.filter((candidate) => candidate !== projectId) : [projectId, ...current],
    );
  }

  async function openContextItem(item: ProjectMemoryItem) {
    setSelectedContextItem(item);
    setContextItemDetail(null);
    try {
      setContextItemDetail(await getProjectMemoryItem(item.id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function openKnowledgeItem(item: StudioKnowledgeItem) {
    setSelectedKnowledgeItem(item);
    setKnowledgeItemDetail(null);
    try {
      setKnowledgeItemDetail(await getKnowledgeItem(item.id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function chooseHarness(id: HarnessId) {
    const nextId = normalizePrimaryHarness(id, harnesses);
    const nextHarness = harnesses.find((harness) => harness.id === nextId);
    setSelectedHarness(nextId);
    setSettingsDraft((current) => current ? { ...current, defaultHarness: nextId } : current);
    setSelectedAction((current) => resolveHarnessAction(current, nextHarness));
  }

  async function saveSettings() {
    if (!settingsDraft) return;
    try {
      const saved = await saveConfig(settingsDraft);
      setSettingsDraft(saved);
      setSelectedHarness(saved.defaultHarness);
      setInputMode(saved.ui?.inputMode ?? "agent");
      setThemeMode(saved.ui?.theme === "light" ? "light" : "dark");
      setSettingsSavedAt(formatTime(new Date().toISOString()));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function changeWorkspace() {
    try {
      await selectWorkspace();
      setSession(null);
      setEvents([]);
      setServerTrace(null);
      setRecentSessions([]);
      setProjectMemory(null);
      setKnowledgeIndex(null);
      await refresh();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function finishSetup() {
    if (!settingsDraft) return;
    const completedAt = new Date().toISOString();
    const nextConfig: StudioConfig = {
      ...settingsDraft,
      setup: {
        wizardVersion: 1,
        completedAt,
        dismissedAt: settingsDraft.setup?.dismissedAt ?? null,
        lastCheckedAt: completedAt,
        downloadReadyAcknowledged: true,
      },
    };
    try {
      const saved = await saveConfig(nextConfig);
      setSettingsDraft(saved);
      setSettingsSavedAt(formatTime(completedAt));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function refreshMemory() {
    try {
      setProjectMemory(await refreshProjectMemory());
      setKnowledgeIndex(await refreshKnowledgeIndex());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function refreshKnowledge() {
    try {
      setKnowledgeIndex(await refreshKnowledgeIndex());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleFigmaConnect() {
    setFigmaConnecting(true);
    setFigmaError(null);
    try {
      setFigmaStatus(await connectFigma(settingsDraft?.figma?.preferredPort ?? null));
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFigmaError(message);
      setError(message);
    } finally {
      setFigmaConnecting(false);
    }
  }

  async function handleFigmaDisconnect() {
    setFigmaError(null);
    try {
      setFigmaStatus(await disconnectFigma());
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFigmaError(message);
      setError(message);
    }
  }

  async function handleFigmaAction(input: FigmaAction | FigmaActionRequest) {
    setFigmaActionRunning(true);
    setFigmaError(null);
    try {
      const request = typeof input === "string" ? { action: input } : input;
      const result = await runFigmaAction(request);
      setFigmaActionResult(result);
      await refreshMemory();
      setFigmaStatus(await getFigmaStatus().catch(() => figmaStatus));
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFigmaError(message);
      setError(message);
    } finally {
      setFigmaActionRunning(false);
    }
  }

  async function handleFigmaOpen() {
    setFigmaError(null);
    try {
      await openFigma(settingsDraft?.figma?.lastFileKey ?? null);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFigmaError(message);
      setError(message);
    }
  }

  function patchSettings(update: (current: StudioConfig) => StudioConfig) {
    setSettingsDraft((current) => current ? update(current) : current);
  }

  async function handleComputerCaptureRequest() {
    try {
      const result = await callComputerAction({ action: "captureScreen" });
      setError(result.status === "approval_required" ? result.message : null);
      setComputerStatus(await getComputerStatus().catch(() => computerStatus));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleMacOSPermissionOpen(permission: string) {
    try {
      await openComputerTarget({
        target: "url",
        value: macOSSettingsUrl(permission),
        approved: true,
      });
      setComputerStatus(await getComputerStatus().catch(() => computerStatus));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function addFilesToComposer(files: FileList | File[], source: StudioAttachmentSource) {
    for (const file of Array.from(files)) {
      try {
        const isText = file.type.startsWith("text/") || /\.(md|mdx|txt|json|yaml|yml|csv)$/i.test(file.name);
        const isImage = file.type.startsWith("image/");
        const dataUrl = isText ? undefined : await readFileAsDataUrl(file);
        const captured = await captureAttachment({
          kind: isImage ? "image" : isText ? "text" : "file",
          name: file.name,
          mimeType: file.type || (isText ? "text/plain" : "application/octet-stream"),
          source,
          text: isText ? await readFileAsText(file) : undefined,
          dataUrl,
        });
        setAttachments((current) => [...current, isImage && dataUrl ? { ...captured, previewUrl: dataUrl } : captured]);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }

  async function addTextMaterial(text: string, source: StudioAttachmentSource) {
    const captured = await captureAttachment({
      kind: "text",
      name: "pasted-material.txt",
      mimeType: "text/plain",
      source,
      text,
    });
    setAttachments((current) => [...current, captured]);
  }

  function handlePromptPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files).filter((file) => file.size > 0);
    if (files.length) {
      event.preventDefault();
      void addFilesToComposer(files, "paste");
      return;
    }
    const text = event.clipboardData.getData("text/plain");
    if (text.length > 1200) {
      event.preventDefault();
      void addTextMaterial(text, "material").catch((err) => setError(err instanceof Error ? err.message : String(err)));
    }
  }

  function handleComposerDrop(event: DragEvent<HTMLTextAreaElement>) {
    event.preventDefault();
    if (event.dataTransfer.files.length) void addFilesToComposer(event.dataTransfer.files, "drop");
  }

  function handleChatRailPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const container = event.currentTarget.parentElement;
    const bounds = container?.getBoundingClientRect();
    const totalWidth = Math.max(bounds?.width ?? window.innerWidth, 1);

    const applyWidth = (clientX: number) => {
      const left = bounds?.left ?? 0;
      const nextWidth = ((clientX - left) / totalWidth) * 100;
      setChatRailWidthPercent(clampNumber(nextWidth, MIN_CHAT_RAIL_WIDTH_PERCENT, MAX_CHAT_RAIL_WIDTH_PERCENT));
    };

    applyWidth(event.clientX);

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      applyWidth(moveEvent.clientX);
    };
    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  function handleChatRailResizeKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const direction = event.key === "ArrowLeft" ? -2 : 2;
      setChatRailWidthPercent((current) => clampNumber(current + direction, MIN_CHAT_RAIL_WIDTH_PERCENT, MAX_CHAT_RAIL_WIDTH_PERCENT));
    }
    if (event.key === "Home") {
      event.preventDefault();
      setChatRailWidthPercent(MIN_CHAT_RAIL_WIDTH_PERCENT);
    }
    if (event.key === "End") {
      event.preventDefault();
      setChatRailWidthPercent(MAX_CHAT_RAIL_WIDTH_PERCENT);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      setChatRailWidthPercent(DEFAULT_CHAT_RAIL_WIDTH_PERCENT);
    }
  }

  function removeAttachment(id: string) {
    setAttachments((current) => current.filter((attachment) => attachment.id !== id));
  }

  async function run() {
    if (!status || !prompt.trim() || !harnessCanRun(currentHarness, effectiveAction)) return;
    setEvents([]);
    setServerTrace(null);
    setError(null);
    setCollapsedBlockIds(new Set());
    setIsStartingSession(true);
    try {
      const nextSession = await startSession({
        harness: selectedHarness,
        action: effectiveAction,
        cwd: status.projectRoot,
        prompt,
        chatMode,
        permissionMode,
        attachments,
      });
      setAttachments([]);
      setSession(nextSession);
      setRecentSessions((current) => [nextSession, ...current.filter((candidate) => candidate.id !== nextSession.id)].slice(0, 8));
      await refreshSessionTrace(nextSession.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStartingSession(false);
    }
  }

  async function cancel() {
    if (!session) return;
    await cancelSession(session.id);
    await refreshSessionTrace(session.id);
  }

  function toggleBlock(blockId: string) {
    setCollapsedBlockIds((current) => {
      const next = new Set(current);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  }

  function attachBlock(block: TerminalBlock) {
    const snippet = block.messages.join("").trim();
    if (!snippet) return;
    setPrompt((current) => `${current.trim()}\n\nUse this ${block.title} as context:\n${trimText(snippet, 1200)}`.trim());
  }

  function attachWorkspaceContext() {
    const contextLines = [
      `Harness: ${currentHarness?.label ?? selectedHarness}`,
      `Action: ${effectiveAction}`,
      `Readiness: ${harnessStatusCopy}`,
      designTrace ? `Design trace: ${designTrace.reviewLabel}` : null,
      designTrace?.designSystemFiles.length ? `Design-system files: ${designTrace.designSystemFiles.slice(0, 5).map((file) => file.path).join(", ")}` : null,
      traceModel.references.length ? `References: ${traceModel.references.slice(0, 5).map((item) => item.label).join(", ")}` : null,
    ].filter(Boolean);
    setPrompt((current) => `${current.trim()}\n\nUse this Studio context:\n${contextLines.join("\n")}`.trim());
  }

  function handleConversationScroll() {
    const element = scrollRegionRef.current;
    if (!element) return;
    if (latestScrollRestoringRef.current) {
      element.dataset.autoScrollState = "pinned";
      return;
    }
    const pinned = isNearScrollBottom(element);
    element.dataset.autoScrollState = pinned ? "pinned" : "paused";
    setUserPinnedToBottom((current) => current === pinned ? current : pinned);
  }

  function scrollConversationToLatest(behavior: ScrollBehavior = "auto") {
    latestScrollRestoringRef.current = true;
    setUserPinnedToBottom(true);
    scrollRetryTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    scrollRetryTimeoutsRef.current = [];
    const scrollNow = (nextBehavior: ScrollBehavior) => {
      const element = scrollRegionRef.current;
      if (!element) return null;
      element.dataset.autoScrollState = "pinned";
      element.scrollTo({ top: element.scrollHeight, behavior: nextBehavior });
      element.scrollTop = element.scrollHeight;
      bottomAnchorRef.current?.scrollIntoView({ block: "end", behavior: nextBehavior });
      setUserPinnedToBottom(true);
      return element;
    };
    if (!scrollNow(behavior)) {
      latestScrollRestoringRef.current = false;
      bottomAnchorRef.current?.scrollIntoView({ block: "end", behavior });
      return;
    }
    window.requestAnimationFrame(() => {
      scrollNow("auto");
      window.requestAnimationFrame(() => scrollNow("auto"));
    });
    scrollRetryTimeoutsRef.current = [80, 220, 420].map((delay) =>
      window.setTimeout(() => {
        const element = scrollNow("auto");
        if (delay === 420) {
          const stillPinned = element ? isNearScrollBottom(element) : true;
          if (element) element.dataset.autoScrollState = stillPinned ? "pinned" : "paused";
          latestScrollRestoringRef.current = false;
          setUserPinnedToBottom(stillPinned);
        }
      }, delay),
    );
  }

  function handleChatFollowUp(text: string) {
    setPrompt((current) => `${current.trim()}\n\n${text}`.trim());
  }

  function pinCurrentChatMemory() {
    const nextPin = [
      activeDesignArtifact?.title,
      designTrace?.reviewLabel,
      latestRun?.prompt,
      prompt,
    ].find((value): value is string => Boolean(value?.trim())) ?? "Current chat context";
    setChatMemoryPins((current) => [trimText(nextPin, 96), ...current.filter((pin) => pin !== nextPin)].slice(0, 6));
  }

  function branchCurrentChat() {
    setSession(null);
    setEvents([]);
    setServerTrace(null);
    setPrompt(`Branch from ${latestRun ? trimText(latestRun.prompt, 120) : "current chat"}:\n${prompt}`.trim());
    setChatSearchQuery("");
    scrollConversationToLatest("auto");
  }

  function copyCurrentVerificationReceipt() {
    const receipt = [
      `Session: ${session?.id ?? "draft"}`,
      `Status: ${visibleSessionStatus}`,
      `Files: ${designTrace?.files.length ?? 0}`,
      `Artifacts: ${(traceModel.artifacts?.length ?? 0) + designArtifacts.length}`,
      `Events: ${events.length}`,
      lastFailure ? `Failure: ${lastFailure.message}` : "Failures: none",
    ].join("\n");
    void copyText(receipt);
  }

  function handleAttachmentPick(event: ChangeEvent<HTMLInputElement>) {
    void addFilesToComposer(event.target.files ?? [], "file");
    event.currentTarget.value = "";
  }

  async function reviewArtifactSection(
    artifactId: string,
    sectionId: string,
    reviewState: "unreviewed" | "looks_good" | "needs_work",
    comment?: string,
  ) {
    try {
      const artifact = await reviewDesignSystemArtifactSection({ artifactId, sectionId, reviewState, comment });
      setSelectedArtifactId(artifact.id);
      setDesignArtifacts((current) => [artifact, ...current.filter((candidate) => candidate.id !== artifact.id)]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function useDesignSystemArtifact(artifact: DesignSystemArtifact) {
    setSelectedArtifactId(artifact.id);
    setPrompt((current) => `${current.trim()}\n\nUse design system artifact: ${artifact.title}\n${artifact.sections.map((section) => `${section.title}: ${section.summary}`).join("\n")}`.trim());
  }

  async function runScenarioLabModelSwarm() {
    if (!status?.projectRoot) return;
    setScenarioRunning(true);
    setError(null);
    try {
      const modelsCall = await callStudioTool({
        toolId: "simulation.models",
        cwd: status.projectRoot,
        input: {},
      });
      const profiles = (modelsCall.data as { profiles?: ScenarioModelProfile[] } | undefined)?.profiles ?? [];
      setScenarioModels(profiles);

      const matrixCall = await callStudioTool({
        toolId: "simulation.run_matrix",
        cwd: status.projectRoot,
        input: {
          adapter: "model-swarm",
          hypotheses: [
            scenarioHypothesis,
            `${scenarioHypothesis} with stricter ${scenarioVariable.toLowerCase()} thresholds`,
          ],
          maxAgents: 20,
          rounds: 2,
          allowLiveModels: false,
        },
      });
      const matrix = (matrixCall.data as ScenarioMatrixState | undefined) ?? { runs: [] };
      setScenarioMatrix(matrix);
      const firstRunId = matrix.runs?.[0]?.run?.id;
      if (firstRunId) {
        const transcriptCall = await callStudioTool({
          toolId: "simulation.transcript",
          cwd: status.projectRoot,
          input: { runId: firstRunId },
        });
        setScenarioTranscripts((transcriptCall.data as { transcripts?: ScenarioTranscriptItem[] } | undefined)?.transcripts ?? []);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setScenarioRunning(false);
    }
  }

  async function exportScenarioLabToFigJam() {
    if (!status?.projectRoot) return;
    setScenarioRunning(true);
    setError(null);
    try {
      const runId = scenarioMatrix?.comparison?.winnerRunId ?? scenarioMatrix?.runs?.[0]?.run?.id;
      const packageCall = await callStudioTool({
        toolId: "research.design_package",
        cwd: status.projectRoot,
        input: {
          intent: "Vibe design a research-backed product decision workspace for product people.",
          hypothesis: scenarioHypothesis,
          runId,
        },
      });
      const designPackage = (packageCall.data as { package?: ScenarioDesignPackage } | undefined)?.package ?? null;
      setScenarioDesignPackage(designPackage);

      const exportCall = await callStudioTool({
        toolId: "mermaid_jam.export",
        cwd: status.projectRoot,
        input: {
          source: runId ?? "research",
          intent: "Vibe design a research-backed product decision workspace for product people.",
          hypothesis: scenarioHypothesis,
          runId,
        },
      });
      const exports = (exportCall.data as { exports?: ScenarioFigJamExport[] } | undefined)?.exports ?? [];
      setScenarioFigJamExports(exports);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setScenarioRunning(false);
    }
  }

  async function handleCreateMermaidBoard() {
    if (!status?.projectRoot) return;
    setMermaidBoardLoading(true);
    setMermaidBoardError(null);
    try {
      const call = await callStudioTool({
        toolId: "board.create",
        cwd: status.projectRoot,
        input: {
          id: mermaidBoard?.id ?? "studio-mermaid-board",
          title: "Studio Mermaid Board",
          description: "FigJam-style product board with Mermaid nodes, evidence cards, and agent updates.",
        },
      });
      assertToolCallCompleted(call);
      const board = (call.data as { board?: MermaidBoard } | undefined)?.board;
      if (!board) throw new Error("Board create did not return a board.");
      setMermaidBoard(board);
      chooseRightPane("mermaid-board", "Mermaid Board ready");
      setError(null);
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : String(nextError);
      setMermaidBoardError(message);
      setError(message);
    } finally {
      setMermaidBoardLoading(false);
    }
  }

  async function handleAddMermaidBoardNode(kind: MermaidBoardNodeKind) {
    if (!status?.projectRoot) return;
    setMermaidBoardLoading(true);
    setMermaidBoardError(null);
    try {
      const nodeDefaults = mermaidBoardNodeDefaults(kind, mermaidBoard?.nodes.length ?? 0, prompt, latestRun?.prompt);
      const call = await callStudioTool({
        toolId: "board.add_node",
        cwd: status.projectRoot,
        input: {
          boardId: mermaidBoard?.id ?? "studio-mermaid-board",
          ...nodeDefaults,
        },
      });
      assertToolCallCompleted(call);
      const board = (call.data as { board?: MermaidBoard } | undefined)?.board;
      if (!board) throw new Error("Board add node did not return a board.");
      setMermaidBoard(board);
      chooseRightPane("mermaid-board", `${nodeDefaults.title} added`);
      setError(null);
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : String(nextError);
      setMermaidBoardError(message);
      setError(message);
    } finally {
      setMermaidBoardLoading(false);
    }
  }

  async function handleLayoutMermaidBoard() {
    if (!status?.projectRoot) return;
    setMermaidBoardLoading(true);
    setMermaidBoardError(null);
    try {
      const call = await callStudioTool({
        toolId: "board.layout",
        cwd: status.projectRoot,
        input: { boardId: mermaidBoard?.id ?? "studio-mermaid-board" },
      });
      assertToolCallCompleted(call);
      const board = (call.data as { board?: MermaidBoard } | undefined)?.board;
      if (!board) throw new Error("Board layout did not return a board.");
      setMermaidBoard(board);
      chooseRightPane("mermaid-board", "Agent arranged Mermaid Board");
      setError(null);
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : String(nextError);
      setMermaidBoardError(message);
      setError(message);
    } finally {
      setMermaidBoardLoading(false);
    }
  }

  async function handleExportMermaidBoard() {
    if (!status?.projectRoot) return;
    setMermaidBoardLoading(true);
    setMermaidBoardError(null);
    try {
      const call = await callStudioTool({
        toolId: "board.export_mermaid_jam",
        cwd: status.projectRoot,
        input: { boardId: mermaidBoard?.id ?? "studio-mermaid-board" },
      });
      assertToolCallCompleted(call);
      const payload = call.data as { board?: MermaidBoard; exports?: MermaidBoardExport[] } | undefined;
      if (payload?.board) setMermaidBoard(payload.board);
      setMermaidBoardExports(payload?.exports ?? []);
      const source = payload?.exports?.[0]?.integration;
      await openMermaidJamIntegration(source === "local-manifest" ? "local-manifest" : "community").catch(() => undefined);
      chooseRightPane("mermaid-board", "Exported Mermaid Jam source");
      setError(null);
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : String(nextError);
      setMermaidBoardError(message);
      setError(message);
    } finally {
      setMermaidBoardLoading(false);
    }
  }

  function renderScenarioLab() {
    const latestMatrixRun = scenarioMatrix?.runs?.[0]?.run;
    const winnerRunId = scenarioMatrix?.comparison?.winnerRunId ?? latestMatrixRun?.id ?? null;
    const scorecard = latestMatrixRun?.scorecard;
    const edges = [
      ["agent-pm", "finding-risk"],
      ["agent-research", "finding-risk"],
      ["model-codex", "agent-pm"],
      ["variable", "finding-risk"],
      ["finding-risk", "outcome"],
    ] as Array<[string, string]>;
    const nodes = layoutScenarioLabGraph([
      { id: "agent-pm", label: "PM", kind: "agent" },
      { id: "agent-research", label: "Research", kind: "agent" },
      { id: "model-codex", label: "Codex", kind: "agent" },
      { id: "finding-risk", label: "Risk", kind: "finding" },
      { id: "variable", label: scenarioVariable, kind: "variable" },
      { id: "outcome", label: winnerRunId ? "Winner" : "Spec", kind: "outcome" },
    ], edges);
    const selected = nodes.find((node) => node.id === selectedScenarioNode) ?? nodes[0];
    const timeline = latestMatrixRun?.rounds?.length
      ? latestMatrixRun.rounds.map((_, index) => ({ label: `Round ${index + 1}`, text: `${latestMatrixRun.transcripts?.length ?? 0} transcript turns captured.` }))
      : [
        { label: "Plan", text: "Research memory" },
        { label: "Run", text: scenarioVariable.toLowerCase() },
        { label: "Report", text: "Spec impact" },
      ];
    const designSpecCount = scenarioDesignPackage?.specs
      ? Object.values(scenarioDesignPackage.specs).reduce((total, specs) => total + (Array.isArray(specs) ? specs.length : 0), 0)
      : 0;
    return (
      <section className="scenario-lab" data-scenario-lab="model-swarm-simulation">
        <header className="scenario-lab-head">
          <div>
            <p className="eyebrow">Mirofish Research</p>
            <h2>Scenario Lab</h2>
          </div>
          <div className="scenario-head-actions">
            <button type="button" data-action-id="scenario.context" onClick={() => setPrompt((current) => `${current.trim()}\n\nRun a model-swarm product simulation with hypothesis: ${scenarioHypothesis}\nVariable: ${scenarioVariable}`.trim())}>
              Context
            </button>
            <button type="button" data-action-id="scenario.run_matrix" onClick={() => void runScenarioLabModelSwarm()} disabled={scenarioRunning || !status?.projectRoot}>
              {scenarioRunning ? "Running" : "Run matrix"}
            </button>
            <button type="button" data-action-id="scenario.export_figjam" onClick={() => void exportScenarioLabToFigJam()} disabled={scenarioRunning || !status?.projectRoot}>
              Export to FigJam
            </button>
          </div>
        </header>
        <div className="scenario-controls">
          <label>
            <span>Source</span>
            <select aria-label="Research source" value="research-store" onChange={() => undefined}>
              <option value="research-store">Research store</option>
              <option value="agent-captures">Agent captures</option>
              <option value="manual">Manual brief</option>
            </select>
          </label>
          <label>
            <span>Hypothesis</span>
            <input value={scenarioHypothesis} onChange={(event) => setScenarioHypothesis(event.target.value)} />
          </label>
          <label>
            <span>Variable</span>
            <input value={scenarioVariable} onChange={(event) => setScenarioVariable(event.target.value)} />
          </label>
        </div>
        <div className="scenario-model-matrix" data-scenario-model-matrix="codex-first">
          {(scenarioModels.length ? scenarioModels : [
            { id: "codex-gpt-5-5", label: "Codex GPT-5.5", provider: "codex", model: "gpt-5.5", available: false },
            { id: "claude-code-sonnet", label: "Claude Code", provider: "claude-code", model: "sonnet", available: false },
            { id: "deterministic-product-simulator", label: "Fallback", provider: "deterministic", model: "memoire", available: true },
          ]).slice(0, 5).map((profile) => (
            <article key={profile.id}>
              <span>{profile.provider}</span>
              <strong>{profile.label}</strong>
              <small>{profile.available ? "ready" : "fallback"} / {profile.model}</small>
            </article>
          ))}
        </div>
        <div className="scenario-grid">
          <section className="scenario-graph-panel" aria-label="Agent cohort graph" data-scenario-live-graph="round-state" data-scenario-cohort-editor="research-backed">
            <svg viewBox="0 0 460 280" role="img" aria-label="Scenario agent graph">
              {edges.map(([sourceId, targetId]) => {
                const source = nodes.find((node) => node.id === sourceId);
                const target = nodes.find((node) => node.id === targetId);
                if (!source || !target) return null;
                return <line key={`${sourceId}-${targetId}`} x1={source.x} y1={source.y} x2={target.x} y2={target.y} />;
              })}
              {nodes.map((node) => (
                <g
                  key={node.id}
                  className="scenario-graph-node"
                  transform={`translate(${node.x} ${node.y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${node.label}`}
                  onClick={() => setSelectedScenarioNode(node.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedScenarioNode(node.id);
                    }
                  }}
                >
                  <circle className={`node-${node.kind} ${selectedScenarioNode === node.id ? "active" : ""}`} r={selectedScenarioNode === node.id ? 26 : 22} />
                  <text textAnchor="middle" dy="4">{node.label.slice(0, 12)}</text>
                </g>
              ))}
            </svg>
            <div className="scenario-node-detail">
              <span>{selected.kind}</span>
              <strong>{selected.label}</strong>
              <small>{scenarioHypothesis}</small>
            </div>
          </section>
          <section className="scenario-timeline-panel" aria-label="Simulation timeline">
            {timeline.map((item, index) => (
              <article key={`${item.label}-${index}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.text}</p>
                </div>
              </article>
            ))}
          </section>
          <section className="scenario-transcript-viewer" aria-label="Transcript memory" data-scenario-transcript-viewer="model-memory">
            <div>
              <span>Transcript</span>
              <strong>{scenarioTranscripts.length || latestMatrixRun?.transcripts?.length || 0} turns</strong>
            </div>
            {(scenarioTranscripts.length ? scenarioTranscripts : latestMatrixRun?.transcripts ?? []).slice(0, 3).map((transcript) => (
              <p key={transcript.id}>{transcript.modelProfileId}: {trimText(transcript.response, 120)}</p>
            ))}
            {!scenarioTranscripts.length && !latestMatrixRun?.transcripts?.length ? <p>No transcript</p> : null}
          </section>
          <section className="scenario-cost-panel" aria-label="Simulation budget" data-scenario-cost-panel="budget">
            <div>
              <span>Budget</span>
              <strong>${(latestMatrixRun?.costs?.estimatedCostUsd ?? 0).toFixed(4)}</strong>
            </div>
            <p>{latestMatrixRun?.costs?.inputTokens ?? 0} input tokens / {latestMatrixRun?.costs?.outputTokens ?? 0} output tokens</p>
          </section>
          <section className="scenario-report-panel" aria-label="Spec impact report">
            <div>
              <span>Spec impact</span>
              <strong>{scorecard ? `${Math.round((scorecard.confidence ?? 0) * 100)}% confidence` : "Recommendations"}</strong>
            </div>
            <ul>
              <li>Finding id</li>
              <li>Outcome metric</li>
              <li>Open assumptions</li>
            </ul>
          </section>
          <section className="scenario-figjam-export" aria-label="FigJam export" data-scenario-figjam-export="mermaid-jam">
            <div>
              <span>FigJam</span>
              <strong>{scenarioFigJamExports.length ? `${scenarioFigJamExports.length} Mermaid sources` : "Source + open"}</strong>
            </div>
            <p>research.design_package and mermaid_jam.export turn current research into Atomic Design specs and Mermaid Jam-ready FigJam source.</p>
            {scenarioDesignPackage ? (
              <dl>
                <div>
                  <dt>Package</dt>
                  <dd>{scenarioDesignPackage.id}</dd>
                </div>
                <div>
                  <dt>Specs</dt>
                  <dd>{designSpecCount}</dd>
                </div>
                <div>
                  <dt>Artifacts</dt>
                  <dd>{scenarioDesignPackage.mermaidArtifacts?.length ?? 0}</dd>
                </div>
              </dl>
            ) : null}
            {scenarioFigJamExports.slice(0, 3).map((item) => (
              <article key={item.id}>
                <span>{item.kind}</span>
                <strong>{item.title}</strong>
                <small title={item.outputPath}>{item.outputPath}</small>
              </article>
            ))}
          </section>
          <section className="scenario-compare-view" aria-label="Hypothesis comparison" data-scenario-compare-view="hypothesis-matrix">
            <div>
              <span>Compare</span>
              <strong>{winnerRunId ?? "No run yet"}</strong>
            </div>
            <p>{scenarioMatrix?.comparison?.summary ?? "No matrix"}</p>
          </section>
        </div>
      </section>
    );
  }

  function renderCreationStage() {
    const outputs = (traceModel.outputs ?? [])
      .filter((output) => ["artifact", "design", "preview", "research", "handoff"].includes(output.kind))
      .slice(-4)
      .reverse();
    const fallback = [{ id: "draft", kind: "prompt", title: "Prompt", summary: prompt || "Start with a prompt." }];
    const cards = outputs.length ? outputs : fallback;
    return (
      <section className="creation-stage-panel" data-center-stage="agent-creation" aria-label="Agent creation stage">
        <header>
          <div>
            <p className="eyebrow">Creation Stage</p>
            <h3>{activeDesignArtifact?.title ?? cards[0]?.title ?? "Ready"}</h3>
            <span>{outputs.length ? `${outputs.length} output signals` : `${currentHarness?.label ?? selectedHarness} / ${effectiveActionLabel}`}</span>
          </div>
          <button data-action-id="center-stage.open-inspector" type="button" onClick={() => setCenterStageMode("inspector")}>Inspector</button>
        </header>
        <div className="creation-output-grid">
          {cards.map((output) => (
            <article key={output.id}>
              <span>{output.kind}</span>
              <strong>{output.title}</strong>
              <small>{trimText(output.summary, 96)}</small>
            </article>
          ))}
        </div>
      </section>
    );
  }

  function renderTraceStage() {
    return (
      <section className="stage-mode-panel" aria-label="Agent trace">
        <header><strong>Trace</strong><small>{traceModel.activities.length} recent activities</small></header>
        <ActivityTimeline activities={traceModel.activities} activeProcesses={traceModel.activeProcesses} />
      </section>
    );
  }

  function renderFilesStage() {
    const files = designTrace?.files ?? [];
    return (
      <section className="stage-mode-panel" aria-label="Changed files">
        <header><strong>{designTrace?.reviewLabel ?? "Changed files"}</strong><button data-action-id="center-stage.files-review" type="button" onClick={() => chooseRightPane("changes", "Changed files review")}>Review</button></header>
        {files.slice(0, 8).map((file) => (
          <button data-action-id={`center-stage.file.${file.path}`} key={file.path} type="button" onClick={() => void copyText(file.path)}>
            <span>{file.path.split("/").pop() ?? file.path}</span>
            <small>+{file.insertions} -{file.deletions}</small>
          </button>
        ))}
        {files.length === 0 ? <p className="empty">No changed files.</p> : null}
      </section>
    );
  }

  function renderInspectorStage() {
    return (
      <section className="stage-mode-panel" aria-label="Inspector shortcuts">
        <header><strong>Inspector</strong><small>{paneIntent?.reason ?? "Choose a right-pane surface."}</small></header>
        {RIGHT_PANE_TABS.map((tab) => (
          <button data-action-id={`center-stage.inspector.${tab.id}`} key={tab.id} type="button" onClick={() => chooseRightPane(tab.id, "Inspector shortcut")}>
            <span>{tab.label}</span>
            <small>{rightPaneTab === tab.id ? "active" : "open"}</small>
          </button>
        ))}
      </section>
    );
  }

  function renderConsolePanel() {
    return (
      <section
        className="console-panel"
        data-chat-workbench="input-output"
        data-chat-transcript="continuous"
        data-output-first="design-research-terminal"
        title="Console"
        aria-label="Conversation"
      >
        <header className="panel-head">
          <div>
            <h2>{latestRun ? trimText(latestRun.prompt, 72) : "Run"}</h2>
            <section className="run-goal-banner" data-run-goal-banner="agent-objective" aria-label="Run goal">
              <span>{currentHarness?.label ?? selectedHarness}</span>
              <span>{effectiveActionLabel}</span>
              <strong>{compactSessionStatusLabel(visibleSessionStatus)}</strong>
            </section>
          </div>
          <div className="inline-actions">
            <button aria-label="Run pane" className="icon-button" data-action-id="right-pane.tab.run" title="Run" type="button" onClick={() => chooseRightPane("run", "Run pane opened")}>
              <StudioControlIcon name="details" />
            </button>
            <button aria-label="Refresh" className="icon-button" data-action-id="memory.refresh" title="Refresh" type="button" onClick={refresh}>
              <StudioControlIcon name="refresh" />
            </button>
          </div>
        </header>

        <section className="console-run-info" data-codex-power-strip="sandbox" aria-label="Harness run configuration">
          <HarnessChip
            kind="harness"
            icon="harness"
            label="Harness"
            value={currentHarness?.label ?? selectedHarness}
            title={currentHarness?.authMessage ?? harnessStatusCopy}
          />
          <HarnessChip
            kind="access"
            icon="access"
            label="Access"
            value={compactPermissionModePowerLabel(permissionMode)}
            title={permissionModePowerDetail(permissionMode)}
          />
          <HarnessChip
            kind="reasoning"
            icon="plan"
            label="Reasoning"
            value={codexReasoningLabel(settingsDraft?.codex?.reasoningEffort ?? "xhigh")}
            title={`Codex reasoning: ${codexReasoningDetail(settingsDraft?.codex?.reasoningEffort ?? "xhigh")}`}
          />
          <HarnessChip
            kind="action"
            icon="action"
            label="Action"
            value={effectiveActionLabel}
          />
          <HarnessChip
            kind="status"
            icon="mode"
            label="Status"
            value={compactSessionStatusLabel(visibleSessionStatus)}
          />
        </section>

        <ChangedFilesPanel trace={designTrace} onReview={() => chooseRightPane("changes", "Changed files review")} />

        <ChatQualityLayer
          session={session}
          sessionStatus={visibleSessionStatus}
          action={effectiveAction}
          traceModel={traceModel}
          events={events}
          terminalBlocks={terminalBlocks}
          artifacts={[...designArtifacts, ...((traceModel.artifacts ?? []) as DesignSystemArtifact[])]}
          designTrace={designTrace}
          memoryPins={chatMemoryPins}
          searchQuery={chatSearchQuery}
          lastFailure={lastFailure}
          onSearchChange={setChatSearchQuery}
          onFollowUp={handleChatFollowUp}
          onPinMemory={pinCurrentChatMemory}
          onBranch={branchCurrentChat}
          onCopyVerification={copyCurrentVerificationReceipt}
        />

        <section
          className="conversation-scroll-region"
          data-auto-scroll-state={userPinnedToBottom ? "pinned" : "paused"}
          data-agent-thinking-state={agentThinkingState}
          data-conversation-scroll="activity-output"
          data-output-mode={centerStageMode}
          aria-label="Conversation activity and output"
          onScroll={handleConversationScroll}
          ref={scrollRegionRef}
        >
          <div className="center-stage-tabs" data-output-mode-tabs="creation-chat-trace-files-inspector" role="tablist" aria-label="Output modes">
            {CENTER_STAGE_MODES.map((mode) => (
              <button
                aria-selected={centerStageMode === mode.id}
                className={centerStageMode === mode.id ? "active" : ""}
                data-action-id={`center-stage.mode.${mode.id}`}
                data-output-mode-tab={mode.id}
                key={mode.id}
                role="tab"
                type="button"
                onClick={() => setCenterStageMode(mode.id)}
              >
                {mode.label}
              </button>
            ))}
          </div>
          {centerStageMode === "creation" ? renderCreationStage() : null}
          {centerStageMode === "trace" ? renderTraceStage() : null}
          {centerStageMode === "files" ? renderFilesStage() : null}
          {centerStageMode === "inspector" ? renderInspectorStage() : null}
          <ActivityTimeline
            activities={traceModel.activities}
            activeProcesses={traceModel.activeProcesses}
          />

          <section
            className="block-feed"
            data-block-feed="terminal-blocks"
            data-output-renderer="inline"
            data-message-feed="chat-output"
            aria-label="Conversation output"
          >
            {visibleTerminalBlocks.map((block) => (
              <TerminalBlockSurface kind={block.kind} key={block.id}>
                <header>
                  <div>
                    <span>{block.title}</span>
                    <small>{block.meta}</small>
                  </div>
                  <div className="blockActions">
                    {block.timestamp ? <time dateTime={block.timestamp}>{formatTime(block.timestamp)}</time> : null}
                    <button aria-label={`Copy ${block.title}`} data-action-id={`block.copy.${block.id}`} title="Copy" type="button" onClick={() => void copyText(block.messages.join(""))}>
                      <StudioControlIcon name="copy" />
                    </button>
                    <button aria-label={`Use ${block.title} as context`} data-action-id={`block.context.${block.id}`} title="Context" type="button" onClick={() => attachBlock(block)}>
                      <StudioControlIcon name="context" />
                    </button>
                    <button aria-label={collapsedBlockIds.has(block.id) ? `Expand ${block.title}` : `Collapse ${block.title}`} data-action-id={`block.toggle.${block.id}`} title={collapsedBlockIds.has(block.id) ? "Expand" : "Collapse"} type="button" onClick={() => toggleBlock(block.id)}>
                      <StudioControlIcon name={collapsedBlockIds.has(block.id) ? "expand" : "collapse"} />
                    </button>
                  </div>
                </header>
                {!collapsedBlockIds.has(block.id) ? <BlockBody block={block} /> : null}
              </TerminalBlockSurface>
            ))}

            {terminalBlocks.length === 0 ? (
              <div className="empty-state">
                <h2>Prompt</h2>
                <div className="starter-grid">
                  {STARTER_PROMPTS.map((starter, index) => (
                    <button data-action-id={`starter.prompt.${index}`} key={starter.label} type="button" onClick={() => setPrompt(starter.prompt)}>
                      {starter.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {terminalBlocks.length > 0 && visibleTerminalBlocks.length === 0 ? (
              <div className="empty-state">
                <h2>No matching output.</h2>
              </div>
            ) : null}
            <div aria-hidden="true" data-latest-anchor ref={bottomAnchorRef} />
          </section>
        </section>

        <div className="agent-live-status" data-agent-thinking-state={agentThinkingState}>
          <span className="status-dot" aria-hidden="true" />
          <strong>{agentLiveLabel}</strong>
          <small title={agentLiveSummary}>{trimText(agentLiveSummary, 88)}</small>
          {!userPinnedToBottom ? (
            <button
              className="scroll-latest-button"
              data-action-id="conversation.scroll-latest"
              type="button"
              onClick={() => scrollConversationToLatest("auto")}
            >
              Latest
            </button>
          ) : null}
        </div>

        <CommandBar data-command-editor="bottom-pinned">
          <div
            className="message-composer"
            data-composer-agent-state="codex-workbench"
            data-message-composer="warp-claude"
            data-chat-mode={chatMode}
            data-permission-mode={permissionMode}
          >
            <textarea
              aria-label="Prompt"
              placeholder={inputMode === "terminal" ? "Command" : inputMode === "auto" ? "Prompt or command" : "Prompt"}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onPaste={handlePromptPaste}
              onDrop={handleComposerDrop}
              onDragOver={(event) => event.preventDefault()}
            />
            <AttachmentShelf attachments={attachments} onRemove={removeAttachment} />
            <div className="composer-controls" data-composer-controls="readable">
              <label className="icon-button attachment-button" data-action-id="attachment.add" title="Attach context">
                <StudioControlIcon name="attach" />
                <input ref={fileInputRef} type="file" multiple onChange={handleAttachmentPick} />
              </label>
              <label className="composer-select" data-composer-control="mode" title="Mode">
                <StudioControlIcon name="mode" />
                <span className="composer-control-label"><span>Mode</span></span>
                <span className="composer-control-text">{CHAT_MODES.find((mode) => mode.id === chatMode)?.label ?? chatMode}</span>
                <select aria-label="Mode" data-action-id="chat-mode.select" value={chatMode} onChange={(event) => setChatMode(event.target.value as StudioChatMode)}>
                  {CHAT_MODES.map((mode) => (
                    <option key={mode.id} value={mode.id}>{mode.label}</option>
                  ))}
                </select>
              </label>
              <label className="composer-select" data-composer-control="access" title="Access">
                <StudioControlIcon name="access" />
                <span className="composer-control-label"><span>Access</span></span>
                <span className="composer-control-text">{permissionModePowerLabel(permissionMode)}</span>
                <select aria-label="Access" data-action-id="codex.plan-mode.toggle" value={permissionMode} onChange={(event) => setPermissionMode(event.target.value as StudioPermissionMode)}>
                  {PERMISSION_MODES.map((mode) => (
                    <option key={mode.id} value={mode.id}>{mode.label}</option>
                  ))}
                </select>
              </label>
              <button
                aria-pressed={permissionMode === "plan"}
                aria-label="Toggle plan mode"
                className={`composer-icon-toggle ${permissionMode === "plan" ? "active" : ""}`}
                data-action-id="codex.plan-mode.toggle"
                title="Plan mode"
                type="button"
                onClick={() => setPermissionMode((current) => current === "plan" ? "guarded" : "plan")}
              >
                <StudioControlIcon name="plan" />
                <span>Plan</span>
              </button>
              <label className="composer-select" data-composer-control="harness" title="Harness">
                <StudioControlIcon name="harness" />
                <span className="composer-control-label"><span>Harness</span></span>
                <span className="composer-control-text">{currentHarness?.label ?? selectedHarness}</span>
                <select aria-label="Harness" data-action-id="harness.select" value={selectedHarness} onChange={(event) => chooseHarness(event.target.value as HarnessId)}>
                  {visibleHarnesses.map((harness) => (
                    <option key={harness.id} value={harness.id} disabled={!harness.enabled}>
                      {harness.label}{harness.installed ? "" : " (missing)"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="composer-select" data-composer-control="action" title="Action">
                <StudioControlIcon name="action" />
                <span className="composer-control-label"><span>Action</span></span>
                <span className="composer-control-text">{harnessActions.find((action) => action.id === effectiveAction)?.label ?? effectiveAction}</span>
                <select
                  aria-label="Action"
                  data-action-id="harness.action.select"
                  value={effectiveAction}
                  onChange={(event) => setSelectedAction(event.target.value as StudioAction)}
                  disabled={harnessActions.length <= 1}
                >
                  {harnessActions.map((action) => (
                    <option key={action.id} value={action.id}>{action.label}</option>
                  ))}
                </select>
              </label>
              {session && isSessionActive ? <button className="danger" data-action-id="session.cancel" type="button" onClick={cancel}>Stop</button> : null}
              <button className="primary run-button submit-button" data-action-id="session.run" type="button" onClick={run} disabled={!canRunSession}>
                {isStartingSession ? "..." : sessionStatus === "running" ? "Run" : canRunSession ? "↑" : harnessStatusCopy}
              </button>
            </div>
          </div>
          <div className="workspace-status-row" data-workspace-status="local-branch">
            <span>Local</span>
            <span>{workspaceLabel}</span>
            <span title={currentHarness?.authMessage ?? harnessStatusCopy}>{currentHarness?.label ?? selectedHarness} / {effectiveAction} / {harnessStatusCopy}</span>
            <button data-action-id="workspace.change" type="button" onClick={() => void changeWorkspace()}>
              Change
            </button>
            <button className="review-chip" data-action-id="design-trace.review" type="button" onClick={() => chooseRightPane("changes", "Changed files review")}>
              {designTrace?.reviewLabel ?? "Review"}
            </button>
          </div>
        </CommandBar>
      </section>
    );
  }

  function renderRunCockpitPane() {
    return (
      <section className="agent-cockpit-pane" data-agent-cockpit="run" data-pane-intent-surface="run">
        <section className="harness-detail-grid" data-harness-readiness="cockpit">
          <article>
            <span>Harness</span>
            <strong>{currentHarness?.label ?? selectedHarness}</strong>
            <small>{currentHarness?.installed ? currentHarness.authStatus : "missing"}</small>
          </article>
          <article>
            <span>Runtime</span>
            <strong>{status?.status ?? "offline"}</strong>
            <small>{status?.projectRoot ?? "offline"}</small>
          </article>
          <article>
            <span>Active run</span>
            <strong>{visibleSessionStatus}</strong>
            <small>{session?.id ?? "none"}</small>
          </article>
          <article>
            <span>Last failure</span>
            <strong>{lastFailure ? formatEventName(lastFailure.type) : "clean"}</strong>
            <small>{lastFailure ? trimText(lastFailure.message, 80) : "clean"}</small>
          </article>
        </section>

        <section className="cockpit-card" data-recent-runs>
          <div className="drawer-section-head">
            <span>Recent sessions</span>
            <small>{visibleRecentSessions.length}</small>
          </div>
          <div className="recent-session-list">
            {visibleRecentSessions.slice(0, 6).map((recent) => (
              <button data-action-id={`session.open.${recent.id}`} key={recent.id} type="button" onClick={() => void openSessionSummary(recent)}>
                <span>{trimText(recent.prompt, 48)}</span>
                <small>{recent.harness} / {recent.status}</small>
              </button>
            ))}
            {visibleRecentSessions.length === 0 ? <span className="empty">No sessions</span> : null}
          </div>
        </section>

        <section className="cockpit-card" data-agent-cockpit-card="activity-trace">
          <div className="drawer-section-head">
            <span>Activity trace</span>
            <button data-action-id="runtime.refresh" type="button" onClick={refresh}>Refresh</button>
          </div>
          <ActivityTimeline
            activities={traceModel.activities}
            activeProcesses={traceModel.activeProcesses}
            onCopyPath={(path) => void copyText(path)}
          />
        </section>
      </section>
    );
  }

  function renderChangesCockpitPane() {
    return (
      <section className="agent-cockpit-pane" data-agent-cockpit="changes" data-pane-intent-surface="changes">
        <section className="design-system-trace-panel cockpit-card" data-design-system-trace="backend-review">
          <div className="drawer-section-head">
            <span>Design system trace</span>
            <button data-action-id="design-trace.refresh" type="button" onClick={refresh}>Refresh</button>
          </div>
          <div className="change-summary">
            <strong>{designTrace?.reviewLabel ?? "No trace"}</strong>
            <small>{designTrace?.status ?? "checking"}</small>
          </div>
          <div className="trace-file-list">
            {(designTrace?.designSystemFiles.length ? designTrace.designSystemFiles : designTrace?.files ?? []).slice(0, 12).map((file) => (
              <article key={file.path}>
                <span>{file.path}</span>
                <small>{file.kind} · {file.status} · +{file.insertions} -{file.deletions}</small>
              </article>
            ))}
            {designTrace && designTrace.files.length === 0 ? <span className="empty">Clean</span> : null}
            {designTrace?.error ? <span className="error">{designTrace.error}</span> : null}
          </div>
        </section>
      </section>
    );
  }

  function renderFigmaCockpitPane() {
    return (
      <section className="agent-cockpit-pane" data-agent-cockpit="figma" data-pane-intent-surface="figma">
        <FigmaDriver
          figmaStatus={figmaStatus}
          figmaActionResult={figmaActionResult}
          figmaConnecting={figmaConnecting}
          figmaActionRunning={figmaActionRunning}
          figmaError={figmaError}
          settingsDraft={settingsDraft}
          onConnect={handleFigmaConnect}
          onDisconnect={handleFigmaDisconnect}
          onOpen={handleFigmaOpen}
          onAction={handleFigmaAction}
          onPatchSettings={patchSettings}
          onSaveSettings={saveSettings}
          settingsSavedAt={settingsSavedAt}
        />
      </section>
    );
  }

  function renderMemoryCockpitPane() {
    return (
      <section className="agent-cockpit-pane" data-agent-cockpit="memory" data-pane-intent-surface="memory">
        <ContextRail
          contextItemDetail={contextItemDetail}
          contextFilter={contextFilter}
          contextItems={contextItems}
          contextQuery={contextQuery}
          events={events}
          knowledgeFilter={knowledgeFilter}
          knowledgeItemDetail={knowledgeItemDetail}
          knowledgeItems={visibleKnowledgeItems}
          knowledgeQuery={knowledgeQuery}
          memoryItems={memoryItems}
          selectedContextItem={selectedContextItem}
          selectedKnowledgeItem={selectedKnowledgeItem}
          session={session}
          traceModel={traceModel}
          onFilterChange={setContextFilter}
          onKnowledgeFilterChange={setKnowledgeFilter}
          onKnowledgeQueryChange={setKnowledgeQuery}
          onOpenKnowledgeItem={openKnowledgeItem}
          onOpenItem={openContextItem}
          onQueryChange={setContextQuery}
          onRefreshKnowledge={refreshKnowledge}
          onRefreshMemory={refreshMemory}
        />
      </section>
    );
  }

  function renderMermaidBoardPane() {
    return (
      <MermaidBoardSurface
        board={mermaidBoard}
        exports={mermaidBoardExports}
        loading={mermaidBoardLoading}
        error={mermaidBoardError}
        onCreate={handleCreateMermaidBoard}
        onAddNode={handleAddMermaidBoardNode}
        onLayout={handleLayoutMermaidBoard}
        onExport={handleExportMermaidBoard}
      />
    );
  }

  function renderRightPaneBody() {
    if (rightPaneTab === "run") return renderRunCockpitPane();
    if (rightPaneTab === "changes") return renderChangesCockpitPane();
    if (rightPaneTab === "design-system") {
      return (
        <DesignSystemReviewSurface
          artifact={activeDesignArtifact}
          figmaStatus={figmaStatus}
          onReviewSection={reviewArtifactSection}
          onUseSystem={useDesignSystemArtifact}
        />
      );
    }
    if (rightPaneTab === "mirofish-research") return renderScenarioLab();
    if (rightPaneTab === "mermaid-board") return renderMermaidBoardPane();
    if (rightPaneTab === "design-changelog") {
      return (
        <DesignChangelogPage
          entries={designChangelogEntries}
          loading={designChangelogLoading}
          error={designChangelogError}
          onRefresh={refreshDesignChangelog}
          onCreate={handleCreateDesignChangelogEntry}
          onUpdate={handleUpdateDesignChangelogEntry}
          onArchive={handleArchiveDesignChangelogEntry}
          onRestore={handleRestoreDesignChangelogEntry}
          onExport={handleExportDesignChangelog}
        />
      );
    }
    if (rightPaneTab === "figma") return renderFigmaCockpitPane();
    return renderMemoryCockpitPane();
  }

  return (
    <main
      className={`studio-shell theme-${themeMode}`}
      data-studio-shell="harness-console"
      data-studio-workbench="harness-console"
      data-action-registry="studio-actions"
      data-marketplace-notes="memoire-notes"
      data-theme={themeMode}
    >
      <div className="harness-console-shell studio-frame" data-studio-workbench="memoire-project-memory">
        <header className="console-topbar" data-top-status-bar="studio-status" data-topbar-density="thirty-percent" data-icon-topbar="memoire-compact">
          <div className="wordmark-row" aria-label="Mémoire">
            <MemoireLogoMark />
          </div>
          <div className="harness-readiness-row" data-harness-readiness="compact" data-harness-readiness-contract="compact" data-topbar-tags="left-compact" aria-label="Runtime and harness status">
            <span><i className="status-dot" /> Runtime {status?.status ?? "offline"}</span>
            <span>{currentHarness?.label ?? selectedHarness} · {harnessStatusCopy}</span>
            <span>Run {visibleSessionStatus}</span>
            <span title={lastFailure?.message ?? "Clean"}>{lastFailure ? "Failure" : "Clean"}</span>
          </div>
          <div className="topbar-actions">
            <button className="topbar-icon-button" aria-label="Command" title="Command" data-action-id="command-palette.open" type="button" onClick={() => openCommandPalette()}>
              <StudioControlIcon name="command" />
            </button>
            <div className="theme-toggle" data-theme-toggle aria-label="Theme">
              <button
                aria-label="Light mode"
                aria-pressed={themeMode === "light"}
                className={themeMode === "light" ? "active" : ""}
                data-action-id="theme.light"
                title="Light mode"
                type="button"
                onClick={() => setThemeMode("light")}
              >
                <StudioControlIcon name="light" />
              </button>
              <button
                aria-label="Dark mode"
                aria-pressed={themeMode === "dark"}
                className={themeMode === "dark" ? "active" : ""}
                data-action-id="theme.dark"
                title="Dark mode"
                type="button"
                onClick={() => setThemeMode("dark")}
              >
                <StudioControlIcon name="dark" />
              </button>
            </div>
            <button
              aria-label="Settings"
              className="topbar-icon-button"
              data-action-id="settings.open"
              title="Settings"
              type="button"
              onClick={() => openSettingsPanel()}
            >
              <StudioControlIcon name="settings" />
            </button>
          </div>
        </header>

        <section
          className="console-layout"
          data-action-registry="studio-actions"
          data-action-count={STUDIO_ACTION_REGISTRY.length}
          data-sidebar-collapsed={String(projectSidebarCollapsed)}
        >
          <ProjectSidebar
            sessions={visibleRecentSessions}
            currentSessionId={session?.id ?? null}
            collapsed={projectSidebarCollapsed}
            expandedProjectIds={expandedProjectIds}
            onToggleCollapsed={() => setProjectSidebarCollapsed((current) => !current)}
            onToggleProject={toggleProjectFolder}
            onOpenSession={(nextSession) => void openSessionSummary(nextSession)}
            onOpenSettings={() => openSettingsPanel()}
            onNewChat={startNewChat}
            onOpenCommand={() => openCommandPalette()}
            onOpenPlugins={openPluginsSurface}
            onOpenChangelog={openChangelogSurface}
            onOpenAutomations={openAutomationsSurface}
            onOpenFigma={openFigmaSurface}
          />
          <section className="console-content" data-console-content="primary">
            {error ? <div className="error">{error}</div> : null}
            <section className="agent-workbench-shell" data-agent-workbench="design-system">
              <section
                className="agent-workbench"
                data-agent-workbench="resizable-conversation-artifacts"
                data-run-workbench="conversation-artifacts"
                style={workbenchStyle}
              >
                <aside className="agent-chat-rail run-workbench chat-home" data-agent-chat-rail="model-reasoning">
                  {renderConsolePanel()}
                </aside>
                <div
                  aria-label="Resize conversation and artifact panels"
                  aria-orientation="vertical"
                  aria-valuemax={MAX_CHAT_RAIL_WIDTH_PERCENT}
                  aria-valuemin={MIN_CHAT_RAIL_WIDTH_PERCENT}
                  aria-valuenow={Math.round(chatRailWidthPercent)}
                  className="chat-resize-handle"
                  data-chat-resize-handle="conversation-artifact"
                  onDoubleClick={() => setChatRailWidthPercent(DEFAULT_CHAT_RAIL_WIDTH_PERCENT)}
                  onKeyDown={handleChatRailResizeKey}
                  onPointerDown={handleChatRailPointerDown}
                  role="separator"
                  tabIndex={0}
                  title="Resize"
                />
                <section className="artifact-canvas" data-artifact-canvas={rightPaneTab} data-agent-cockpit-shell="right-pane">
                  <div className="artifact-pane-tabs" data-right-pane-tabs="agent-cockpit-mermaid-board" role="tablist" aria-label="Agent Cockpit">
                    {RIGHT_PANE_TABS.map((tab) => (
                      <button
                        aria-selected={rightPaneTab === tab.id}
                        className={rightPaneTab === tab.id ? "active" : ""}
                        data-action-id={`right-pane.tab.${tab.id}`}
                        key={tab.id}
                        onClick={() => chooseRightPane(tab.id)}
                        role="tab"
                        type="button"
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  {paneIntent ? (
                    <div className="agent-pane-intent" data-agent-pane-intent="suggested-switch">
                      <span>Agent Cockpit</span>
                      <strong>{RIGHT_PANE_TABS.find((tab) => tab.id === paneIntent.tab)?.label ?? paneIntent.tab}</strong>
                      <small>{paneIntent.reason} · {Math.round(paneIntent.confidence * 100)}%</small>
                    </div>
                  ) : null}
                  <section className="artifact-pane-body" data-artifact-pane-body={rightPaneTab}>
                    {renderRightPaneBody()}
                  </section>
                </section>
              </section>
            </section>
          </section>
        </section>
      </div>
      <CommandPalette
        open={commandPaletteOpen}
        query={commandPaletteQuery}
        compatibility={compatibility}
        sessions={recentSessions}
        knowledgeItems={knowledgeItems}
        onQueryChange={setCommandPaletteQuery}
        onClose={() => setCommandPaletteOpen(false)}
        onOpenSettings={() => {
          setCommandPaletteOpen(false);
          openSettingsPanel();
        }}
        onOpenSettingsSection={(section) => {
          setCommandPaletteOpen(false);
          openSettingsPanel(section);
          if (section === "Plugins") void refreshMarketplaceNotes();
        }}
        onOpenFigma={() => {
          setCommandPaletteOpen(false);
          openFigmaSurface();
        }}
        onOpenPlugins={() => {
          setCommandPaletteOpen(false);
          openPluginsSurface();
        }}
        onOpenAutomations={() => {
          setCommandPaletteOpen(false);
          openAutomationsSurface();
        }}
        onOpenChangelog={() => {
          setCommandPaletteOpen(false);
          openChangelogSurface();
        }}
        onSelectHarness={(id) => {
          chooseHarness(id);
          setCommandPaletteOpen(false);
        }}
        onOpenSession={(nextSession) => {
          setCommandPaletteOpen(false);
          chooseRightPane("run", "Session opened");
          void openSessionSummary(nextSession);
        }}
        onOpenKnowledgeItem={(item) => {
          setCommandPaletteOpen(false);
          chooseRightPane("memory", "Knowledge item opened");
          void openKnowledgeItem(item);
        }}
      />
      <AutomationCenter
        open={automationsOpen}
        automations={automations}
        templates={automationTemplates}
        runsByAutomation={automationRuns}
        scheduler={automationScheduler}
        projectRoot={status?.projectRoot ?? ""}
        busyId={automationBusyId}
        onClose={() => setAutomationsOpen(false)}
        onRefresh={refreshAutomations}
        onCreate={handleCreateAutomation}
        onUpdate={handleUpdateAutomation}
        onDelete={handleDeleteAutomation}
        onRunNow={handleRunAutomation}
        onLoadRuns={loadAutomationHistory}
        onInstallScheduler={handleInstallAutomationScheduler}
        onUninstallScheduler={handleUninstallAutomationScheduler}
      />
      <SettingsPanel
        open={settingsOpen}
        activeSection={settingsSection}
        status={status}
        config={settingsDraft}
        compatibility={compatibility}
        computerStatus={computerStatus}
        figmaStatus={figmaStatus}
        figmaConnecting={figmaConnecting}
        harnesses={visibleHarnesses}
        marketplaceNotes={marketplaceNotes}
        marketplaceBusyId={marketplaceBusyId}
        marketplaceError={marketplaceError}
        marketplaceDownloadJobs={marketplaceDownloadJobs}
        selectedMarketplaceNoteId={selectedMarketplaceNoteId}
        noteForks={noteForks}
        selectedNoteForkId={selectedNoteForkId}
        noteForkFiles={noteForkFiles}
        selectedNoteForkFile={selectedNoteForkFile}
        noteForkValidation={noteForkValidation}
        noteForkDiff={noteForkDiff}
        noteForkPrHandoff={noteForkPrHandoff}
        studioTools={studioTools}
        browserStatus={browserStatus}
        onClose={() => setSettingsOpen(false)}
        onSectionChange={setSettingsSection}
        onRefresh={refresh}
        onRefreshMarketplace={refreshMarketplaceNotes}
        onInstallMarketplaceNote={handleInstallMarketplaceNote}
        onRemoveMarketplaceNote={handleRemoveMarketplaceNote}
        onForkMarketplaceNote={handleForkMarketplaceNote}
        onMarketplaceSelectionChange={setSelectedMarketplaceNoteId}
        onSelectNoteFork={handleSelectNoteFork}
        onSelectNoteForkFile={setSelectedNoteForkFile}
        onUpdateNoteForkFile={handleUpdateNoteForkFile}
        onValidateNoteFork={handleValidateNoteFork}
        onExportNoteForkPr={handleExportNoteForkPr}
        onOpenAutomationsCenter={openAutomationsSurface}
        onPatchConfig={patchSettings}
        onSave={saveSettings}
        onComputerCapture={handleComputerCaptureRequest}
        onConnectFigma={handleFigmaConnect}
        onOpenFigma={handleFigmaOpen}
        onOpenMacOSPermission={handleMacOSPermissionOpen}
        onSelectHarness={chooseHarness}
        onSelectWorkspace={changeWorkspace}
        onCompleteSetup={finishSetup}
      />
    </main>
  );
}

function paneIntentForAction(action: StudioAction): PaneIntent | null {
  if (action === "simulate") {
    return { tab: "mirofish-research", reason: "Simulation action selected", confidence: 0.9 };
  }
  if (action === "research") {
    return { tab: "mirofish-research", reason: "Research action selected", confidence: 0.84 };
  }
  if (action === "self-design" || action === "design-doc") {
    return { tab: "design-system", reason: "Design action selected", confidence: 0.82 };
  }
  if (action === "audit" || action === "fix" || action === "app-build" || action === "browser-audit") {
    return { tab: "run", reason: "Run trace is most relevant", confidence: 0.78 };
  }
  return null;
}

function paneIntentForEvents(events: StudioEvent[], action: StudioAction, lastFailure: StudioEvent | null): PaneIntent | null {
  if (lastFailure) {
    return {
      tab: "run",
      reason: "Run needs attention",
      confidence: 0.95,
      sourceEventId: lastFailure.id,
    };
  }

  const event = events.at(-1);
  if (!event) return paneIntentForAction(action);
  const type = event.type.toLowerCase();
  if (type.startsWith("board_") || type.startsWith("board.") || type.includes("mermaid")) {
    return { tab: "mermaid-board", reason: "Board update received", confidence: 0.9, sourceEventId: event.id };
  }
  if (type.startsWith("simulation_") || type.includes("simulation")) {
    return { tab: "mirofish-research", reason: "Simulation event received", confidence: 0.88, sourceEventId: event.id };
  }
  if (type.startsWith("research_") || type.includes("research")) {
    return { tab: "mirofish-research", reason: "Research event received", confidence: 0.82, sourceEventId: event.id };
  }
  if (type.startsWith("figma_") || type.includes("figma")) {
    return { tab: "figma", reason: "Figma bridge event received", confidence: 0.86, sourceEventId: event.id };
  }
  if (type.includes("design_system") || type.includes("design_artifact") || type === "artifact") {
    return { tab: "design-system", reason: "Design artifact received", confidence: 0.84, sourceEventId: event.id };
  }
  if (type.includes("git") || type.includes("file") || type.includes("diff")) {
    return { tab: "changes", reason: "Changed files updated", confidence: 0.8, sourceEventId: event.id };
  }
  return null;
}

function assertToolCallCompleted(call: StudioToolCallResult): void {
  if (call.status !== "completed") {
    throw new Error(call.error ?? `${call.toolId} failed`);
  }
}

function mermaidBoardNodeDefaults(kind: MermaidBoardNodeKind, index: number, prompt: string, latestPrompt?: string | null): Record<string, unknown> {
  const position = { x: 96 + (index % 3) * 300, y: 120 + Math.floor(index / 3) * 220, width: kind === "mermaid" ? 360 : 280, height: kind === "mermaid" ? 220 : 170 };
  const context = trimText((prompt || latestPrompt || "Current product work").trim(), 160);
  if (kind === "mermaid") {
    return {
      kind,
      title: "Mermaid flow",
      body: "Agent-authored Mermaid source for Mermaid Jam.",
      mermaidSource: "flowchart TD\n  Evidence[Research evidence] --> Decision[Product decision]\n  Decision --> Spec[Atomic spec]\n  Spec --> Board[Mermaid Jam source]",
      author: "agent",
      position,
    };
  }
  if (kind === "evidence") {
    return { kind, title: "Evidence card", body: context, author: "agent", researchBacking: [], position };
  }
  if (kind === "comment") {
    return { kind, title: "Comment", body: context, author: "agent", position };
  }
  return { kind, title: kind === "sticky" ? "Sticky note" : `${kind.charAt(0).toUpperCase()}${kind.slice(1)} node`, body: context, author: "agent", position };
}

function macOSSettingsUrl(permission: string): string {
  if (permission === "screenRecording") return "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture";
  if (permission === "accessibility") return "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";
  if (permission === "automation") return "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation";
  if (permission === "fileAccess") return "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles";
  return "x-apple.systempreferences:com.apple.preference.security";
}

function layoutScenarioLabGraph(nodes: ScenarioLabNode[], edges: Array<[string, string]>): PositionedScenarioLabNode[] {
  const simulationNodes: ScenarioLabNode[] = nodes.map((node, index) => ({
    ...node,
    x: 86 + (index % 3) * 132,
    y: 70 + Math.floor(index / 3) * 110,
  }));
  const simulationLinks: Array<SimulationLinkDatum<ScenarioLabNode>> = edges.map(([source, target]) => ({ source, target }));
  const simulation = forceSimulation<ScenarioLabNode>(simulationNodes)
    .force("link", forceLink<ScenarioLabNode, SimulationLinkDatum<ScenarioLabNode>>(simulationLinks).id((node) => node.id).distance(120).strength(0.8))
    .force("charge", forceManyBody().strength(-280))
    .force("center", forceCenter(230, 140))
    .force("collision", forceCollide<ScenarioLabNode>().radius(48))
    .stop();

  for (let index = 0; index < 90; index += 1) simulation.tick();
  simulation.stop();

  return simulationNodes.map((node) => ({
    ...node,
    x: clampNumber(node.x ?? 230, 58, 402),
    y: clampNumber(node.y ?? 140, 48, 232),
  }));
}

function findLatestFailureEvent(events: StudioEvent[]): StudioEvent | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type === "session_error" || event.type === "stderr") return event;
  }
  return null;
}

function formatEventName(type: string): string {
  return type.replace(/_/g, " ");
}

function harnessCanRun(harness: Harness | undefined, action: StudioAction): boolean {
  if (!harness) return false;
  if (!harness.enabled || !harness.installed) return false;
  if (harness.capabilities?.length && !harness.capabilities.includes(action)) return false;
  return harness.authStatus !== "missing" && harness.authStatus !== "needs_login";
}

function isPrimaryHarness(id: HarnessId): boolean {
  return PRIMARY_HARNESS_IDS.includes(id);
}

function primaryHarnesses(harnesses: Harness[]): Harness[] {
  const byId = new Map(harnesses.map((harness) => [harness.id, harness]));
  return PRIMARY_HARNESS_IDS.map((id) => byId.get(id)).filter((harness): harness is Harness => Boolean(harness));
}

function normalizePrimaryHarness(id: HarnessId, harnesses: Harness[]): HarnessId {
  if (isPrimaryHarness(id) && harnesses.some((harness) => harness.id === id)) return id;
  if (harnesses.some((harness) => harness.id === DEFAULT_PRIMARY_HARNESS_ID)) return DEFAULT_PRIMARY_HARNESS_ID;
  return primaryHarnesses(harnesses)[0]?.id ?? DEFAULT_PRIMARY_HARNESS_ID;
}

function harnessReadinessLabel(harness: Harness | undefined): string {
  if (!harness) return "checking";
  if (!harness.enabled) return "disabled";
  if (!harness.installed || harness.authStatus === "missing") return "missing";
  if (harness.authStatus === "needs_login") return "needs login";
  if (harness.authStatus === "signed_in" || harness.authStatus === "ready") return "ready";
  if (harness.authStatus === "not_required") return "available";
  return "available";
}

function actionsForHarness(harness: Harness | undefined): Array<{ id: StudioAction; label: string }> {
  const capabilities = harness?.capabilities?.length ? new Set(harness.capabilities) : new Set<StudioAction>(["raw"]);
  const actions = ACTIONS.filter((action) => capabilities.has(action.id));
  return actions.length > 0 ? actions : [{ id: "raw", label: "Raw" }];
}

function resolveHarnessAction(action: StudioAction, harness: Harness | undefined): StudioAction {
  const actions = actionsForHarness(harness).map((candidate) => candidate.id);
  if (actions.includes(action)) return action;
  if (actions.includes("compose")) return "compose";
  return actions[0] ?? "raw";
}

function HarnessChip(props: {
  kind: "harness" | "access" | "reasoning" | "action" | "status";
  icon: "harness" | "access" | "plan" | "action" | "mode";
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <span className="harness-chip" data-harness-chip={props.kind} aria-label={`${props.label}: ${props.value}`} title={props.title ?? `${props.label}: ${props.value}`}>
      <StudioControlIcon name={props.icon} />
      <strong>{props.value}</strong>
    </span>
  );
}

function codexReasoningLabel(reasoning: StudioCodexReasoningEffort): string {
  if (reasoning === "xhigh") return "X-High";
  return reasoning.charAt(0).toUpperCase() + reasoning.slice(1);
}

function codexReasoningDetail(reasoning: StudioCodexReasoningEffort): string {
  if (reasoning === "xhigh") return "Extra High";
  return reasoning.charAt(0).toUpperCase() + reasoning.slice(1);
}

function compactPermissionModePowerLabel(mode: StudioPermissionMode): string {
  if (mode === "plan") return "Read";
  if (mode === "full_access") return "Full";
  return "Write";
}

function compactSessionStatusLabel(status: string): string {
  if (status === "completed") return "Done";
  if (status === "running") return "Run";
  if (status === "cancelled") return "Stop";
  if (status === "failed") return "Failed";
  if (status === "idle") return "Idle";
  return status;
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolveRead, rejectRead) => {
    const reader = new FileReader();
    reader.onload = () => resolveRead(String(reader.result ?? ""));
    reader.onerror = () => rejectRead(reader.error ?? new Error(`Unable to read ${file.name}`));
    reader.readAsText(file);
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolveRead, rejectRead) => {
    const reader = new FileReader();
    reader.onload = () => resolveRead(String(reader.result ?? ""));
    reader.onerror = () => rejectRead(reader.error ?? new Error(`Unable to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function readBooleanPreference(key: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw) === true;
  } catch {
    return fallback;
  }
}

function readStringArrayPreference(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function readNumberPreference(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw === null ? fallback : Number(JSON.parse(raw));
    return Number.isFinite(parsed) ? clampNumber(parsed, min, max) : fallback;
  } catch {
    return fallback;
  }
}

function permissionModePowerLabel(mode: StudioPermissionMode): string {
  if (mode === "plan") return "Read only";
  if (mode === "full_access") return "Full access";
  return "Workspace write";
}

function permissionModePowerDetail(mode: StudioPermissionMode): string {
  if (mode === "plan") return "--sandbox read-only";
  if (mode === "full_access") return "--dangerously-bypass-approvals-and-sandbox";
  return "--sandbox workspace-write";
}

function isNearScrollBottom(element: HTMLElement, threshold = 96): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
