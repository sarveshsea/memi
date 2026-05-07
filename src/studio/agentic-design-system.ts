import type {
  StudioAgenticDesignSystemContract,
  StudioDesignSystemArtifact,
} from "./design-system-artifact-types.js";

export const AGENTIC_UI_PUBLIC_REFERENCE = {
  name: "Agentic UI",
  url: "https://agenticui.net/",
  figmaPreviewUrl: "https://www.figma.com/design/jxKurBKqTOcZ97lz3uyLuY/AGENTIC-DESIGN-SYSTEM--v1.1---Preview-?node-id=4145-17200",
} as const;

export const AGENTIC_OUTPUT_SECTIONS = [
  "research_note",
  "design_decision",
  "tool_call",
  "artifact",
  "acceptance_statement",
  "session_result",
] as const;

export const AGENTIC_OPEN_SOURCE_REFERENCES: NonNullable<StudioAgenticDesignSystemContract["openSourceReferences"]> = [
  reference("GAIA UI", "https://github.com/theexperiencecompany/gaia-ui", "shadcn-agent-components", ["message_composer", "artifact_review", "memory_context"]),
  reference("assistant-ui", "https://github.com/assistant-ui/assistant-ui", "composer-thread-ux", ["message_composer", "memory_context", "permission_control"]),
  reference("tool-ui", "https://github.com/assistant-ui/tool-ui", "tool-call-rendering", ["tool_trace", "permission_control"]),
  reference("AG-UI", "https://github.com/ag-ui-protocol/ag-ui", "agent-event-protocol", ["harness_status", "tool_trace", "permission_control"]),
  reference("OpenGenerativeUI", "https://github.com/CopilotKit/OpenGenerativeUI", "generative-ui-harness", ["artifact_review", "tool_trace", "memory_context"]),
  reference("Magentic-UI", "https://github.com/microsoft/magentic-ui", "human-in-the-loop-research", ["harness_status", "permission_control", "memory_context"]),
];

export const AGENTIC_INTERACTION_PATTERNS: NonNullable<StudioAgenticDesignSystemContract["interactionPatterns"]> = [
  pattern("composer_agent_state", "Composer Agent State", "assistant-ui", ["message_composer", "permission_control"], ["prompt", "attachments", "model", "reasoning_effort", "permission_mode"]),
  pattern("auditable_tool_trace_cards", "Auditable Tool Trace Cards", "tool-ui", ["tool_trace"], ["tool_id", "status", "input", "output", "approval_state"]),
  pattern("event_stream_state_sync", "Event Stream State Sync", "AG-UI", ["harness_status", "tool_trace"], ["event_type", "run_state", "tool_status", "shared_context"]),
  pattern("artifact_acceptance_state", "Artifact Acceptance State", "OpenGenerativeUI", ["artifact_review", "memory_context"], ["source_refs", "review_state", "acceptance_statement", "design_decision"]),
  pattern("human_review_checkpoint", "Human Review Checkpoint", "Magentic-UI", ["artifact_review", "permission_control"], ["plan_state", "approval_state", "risk_level", "next_action"]),
];

export function buildAgenticDesignSystemContract(): StudioAgenticDesignSystemContract {
  return {
    contractVersion: 1,
    source: {
      ...AGENTIC_UI_PUBLIC_REFERENCE,
      access: "public-preview",
      downloaded: false,
    },
    roles: [
      role("harness_status", "Harness Status", "molecule", "topbar", "Expose active agent, auth, runtime, and failure state.", ["harness_id", "auth_state", "runtime_state"], ["status.open", "settings.open"]),
      role("message_composer", "Message Composer", "organism", "composer", "Capture intent, files, permission mode, harness, and run action in one commandable surface.", ["prompt", "attachments", "permission_mode", "action_id"], ["attachment.add", "session.run"]),
      role("tool_trace", "Tool Trace", "organism", "output", "Render terminal, browser, Figma, MCP, and file operations as auditable blocks.", ["tool_id", "command", "stdout", "exit_state"], ["tool.open", "command.copy"]),
      role("artifact_review", "Artifact Review", "organism", "canvas", "Review design-system artifacts with source references, section state, and acceptance actions.", ["review_state", "source_refs", "section_kind", "token_evidence"], ["artifact.use-system", "artifact.section.components"]),
      role("memory_context", "Memory Context", "organism", "drawer", "Keep project memory, knowledge, research, and references available without crowding the primary shell.", ["memory_kind", "source_path", "recency"], ["context.open", "knowledge.refresh"]),
      role("permission_control", "Permission Control", "molecule", "composer", "Make plan, guarded, and full-access execution explicit before any agent acts.", ["permission_mode", "sandbox_policy"], ["codex.plan-mode.toggle"]),
    ],
    outputSections: [...AGENTIC_OUTPUT_SECTIONS],
    openSourceReferences: AGENTIC_OPEN_SOURCE_REFERENCES.map((reference) => ({ ...reference, mappedRoles: [...reference.mappedRoles] })),
    interactionPatterns: AGENTIC_INTERACTION_PATTERNS.map((pattern) => ({ ...pattern, appliesTo: [...pattern.appliesTo], requiredSignals: [...pattern.requiredSignals] })),
    agentRules: [
      "Every visible control needs a command id so Codex can describe and replay the action.",
      "Every generated artifact needs source refs, review state, and token or component evidence.",
      "Every agent output should map to research_note, design_decision, tool_call, artifact, acceptance_statement, or session_result.",
      "Every harness surface needs an empty, loading, error, blocked, and completed state.",
    ],
  };
}

export function withAgenticDesignSystemContract(artifact: StudioDesignSystemArtifact): StudioDesignSystemArtifact {
  return artifact.agentic ? artifact : { ...artifact, agentic: buildAgenticDesignSystemContract() };
}

export function agenticDesignSystemPromptLines(): string[] {
  return [
    "## Agentic design-system contract",
    `- Agentic UI public reference: ${AGENTIC_UI_PUBLIC_REFERENCE.url}`,
    "- Treat the design system as a harness-readable contract, not only a visual kit.",
    "- Required Studio roles: harness_status, message_composer, tool_trace, artifact_review, memory_context, permission_control.",
    "- Every new or changed surface must expose command ids, source refs, review state, empty/loading/error states, and Atomic Design level.",
    `- Open-source pattern references: ${AGENTIC_OPEN_SOURCE_REFERENCES.map((reference) => reference.name).join(", ")}.`,
    `- Interaction patterns: ${AGENTIC_INTERACTION_PATTERNS.map((pattern) => pattern.id).join(", ")}.`,
    `- Structured output sections: ${AGENTIC_OUTPUT_SECTIONS.join(", ")}.`,
  ];
}

function reference(
  name: string,
  url: string,
  category: string,
  mappedRoles: StudioAgenticDesignSystemContract["roles"][number]["id"][],
): NonNullable<StudioAgenticDesignSystemContract["openSourceReferences"]>[number] {
  return {
    name,
    url,
    license: "MIT",
    category,
    mappedRoles,
  };
}

function pattern(
  id: string,
  label: string,
  source: string,
  appliesTo: StudioAgenticDesignSystemContract["roles"][number]["id"][],
  requiredSignals: string[],
): NonNullable<StudioAgenticDesignSystemContract["interactionPatterns"]>[number] {
  return {
    id,
    label,
    source,
    appliesTo,
    requiredSignals,
  };
}

function role(
  id: StudioAgenticDesignSystemContract["roles"][number]["id"],
  label: string,
  atomicLevel: StudioAgenticDesignSystemContract["roles"][number]["atomicLevel"],
  surface: StudioAgenticDesignSystemContract["roles"][number]["surface"],
  purpose: string,
  requiredSignals: string[],
  commandIds: string[],
): StudioAgenticDesignSystemContract["roles"][number] {
  return {
    id,
    label,
    atomicLevel,
    surface,
    purpose,
    requiredSignals,
    commandIds,
    fallbackState: "Show the blocked reason, next command, and source context.",
  };
}
