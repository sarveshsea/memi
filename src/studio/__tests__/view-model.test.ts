import { describe, expect, it } from "vitest";
import { deriveStudioTrace, STUDIO_TRACE_PHASES } from "../view-model.js";

describe("studio trace view model", () => {
  it("keeps phases queued when there are no supporting events", () => {
    const trace = deriveStudioTrace({
      session: null,
      events: [],
    });

    expect(trace.phases.map((phase) => phase.id)).toEqual(STUDIO_TRACE_PHASES.map((phase) => phase.id));
    expect(trace.phases.every((phase) => phase.status === "queued")).toBe(true);
    expect(trace.tasks.every((task) => task.status === "queued" && task.progress === 0)).toBe(true);
  });

  it("maps existing Studio events into design-agent phases and tasks without inventing missing work", () => {
    const trace = deriveStudioTrace({
      session: {
        id: "studio-session-1",
        action: "compose",
        status: "running",
      },
      events: [
        makeEvent("research_note", "User research synthesized"),
        makeEvent("tool_call", "Read specs/Button.json"),
        makeEvent("design_decision", "Use quiet dark shell"),
        makeEvent("design_preview", "Generated Home screen preview"),
        makeEvent("artifact", "Wrote component spec"),
      ],
    });

    expect(trace.phases.map((phase) => [phase.id, phase.status])).toEqual([
      ["research", "completed"],
      ["analyze", "completed"],
      ["ideate", "completed"],
      ["design", "completed"],
      ["spec", "running"],
      ["handoff", "queued"],
    ]);
    expect(trace.tasks.find((task) => task.id === "design-exploration")).toMatchObject({
      status: "completed",
      progress: 100,
    });
    expect(trace.tasks.find((task) => task.id === "specs-handoff")).toMatchObject({
      status: "running",
    });
    expect(trace.evidenceCount).toBe(5);
  });

  it("extracts package and source references without marking design work complete", () => {
    const trace = deriveStudioTrace({
      session: {
        id: "studio-session-1",
        action: "raw",
        status: "running",
      },
      events: [
        makeEvent("reference_trace", "Mémoire package and source references loaded", {
          references: [
            {
              id: "package:@sarveshsea/memoire",
              kind: "package",
              label: "@sarveshsea/memoire@0.16.3",
              summary: "Runtime package",
              packageName: "@sarveshsea/memoire",
              packageVersion: "0.16.3",
              url: "https://www.npmjs.com/package/@sarveshsea/memoire",
              eventIds: [],
            },
            {
              id: "spec:specs/components/Button.json",
              kind: "spec",
              label: "spec: Button",
              summary: "Button component spec",
              sourcePath: "specs/components/Button.json",
              eventIds: [],
            },
          ],
        }),
      ],
    });

    expect(trace.evidenceCount).toBe(0);
    expect(trace.phases.every((phase) => phase.status === "queued")).toBe(true);
    expect(trace.references).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "package",
        packageName: "@sarveshsea/memoire",
        packageVersion: "0.16.3",
        eventIds: ["reference_trace-1"],
      }),
      expect.objectContaining({
        kind: "spec",
        sourcePath: "specs/components/Button.json",
        eventIds: ["reference_trace-1"],
      }),
    ]));
  });

  it("marks the active phase failed when a session error arrives after traced work", () => {
    const trace = deriveStudioTrace({
      session: {
        id: "studio-session-1",
        action: "audit",
        status: "failed",
      },
      events: [
        makeEvent("tool_call", "Run accessibility audit"),
        makeEvent("session_error", "Audit failed"),
      ],
    });

    expect(trace.phases.find((phase) => phase.id === "analyze")).toMatchObject({
      status: "failed",
    });
    expect(trace.tasks.find((task) => task.id === "accessibility-audit")).toMatchObject({
      status: "failed",
      progress: 0,
    });
  });

  it("derives output, tool, citation, and research evidence traces for output-first chat runs", () => {
    const trace = deriveStudioTrace({
      session: {
        id: "studio-session-1",
        action: "research",
        status: "completed",
      },
      events: [
        makeEvent("chat_message", "Map customer complaints", { chatMode: "research", permissionMode: "guarded" }),
        makeEvent("terminal_command", "npm test", { command: "npm test" }),
        makeEvent("design_artifact", "Rendered concept screen", { title: "Concept Screen", artifactPath: ".memoire/artifacts/concept.png" }),
        makeEvent("preview_ready", "Preview available", { url: "http://127.0.0.1:1420/" }),
        makeEvent("research_capture", "Forum complaints captured", {
          title: "Community complaints",
          method: "netnography",
          url: "https://example.com/community",
          tags: ["pricing", "onboarding"],
          citations: [{ label: "Community thread", url: "https://example.com/community" }],
        }),
        makeEvent("research_metric", "24 pricing mentions", { title: "Pricing mentions", method: "quantitative" }),
        makeEvent("acceptance_statement", "Audit completed read-only", { title: "Acceptance" }),
      ],
    });

    expect(trace.outputs).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "chat", summary: "Map customer complaints" }),
      expect.objectContaining({ kind: "terminal", title: "Terminal Command" }),
      expect.objectContaining({ kind: "design", title: "Concept Screen" }),
      expect.objectContaining({ kind: "preview", url: "http://127.0.0.1:1420/" }),
      expect.objectContaining({ kind: "research", title: "Community complaints" }),
      expect.objectContaining({ kind: "handoff", title: "Acceptance", summary: "Audit completed read-only" }),
    ]));
    expect(trace.toolRuns).toEqual(expect.arrayContaining([
      expect.objectContaining({ tool: "npm test", status: "running" }),
    ]));
    expect(trace.citations).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Community thread", url: "https://example.com/community" }),
    ]));
    expect(trace.researchEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: "netnography", tags: ["pricing", "onboarding"] }),
      expect.objectContaining({ method: "quantitative", label: "Pricing mentions" }),
    ]));
  });

  it("exposes design-system artifacts as trace outputs for any harness", () => {
    const trace = deriveStudioTrace({
      session: {
        id: "studio-buzzr-pull",
        action: "audit",
        status: "completed",
      },
      events: [
        makeEvent("artifact", "Buzzr Design System Pull:\n- Brand: [Roadmap](/Users/sarveshchidambaram/Desktop/Projects/Buzzr/Buzzr/docs/BEE_BRANDING_ROADMAP.md:9)\n- Components: [Button.tsx](/Users/sarveshchidambaram/Desktop/Projects/Buzzr/Buzzr/components/ui/Button.tsx:88)"),
        makeEvent("design_decision", "P1: Normalize tokens and component ownership."),
        makeEvent("acceptance_statement", "Buzzr design system pull completed read-only."),
      ],
    });

    expect(trace.artifacts).toHaveLength(1);
    expect(trace.artifacts[0]).toMatchObject({
      title: "Buzzr Design System Pull",
      sourceSessionId: "studio-buzzr-pull",
      status: "review",
    });
    expect(trace.artifacts[0].sections.map((section) => section.kind)).toEqual(expect.arrayContaining([
      "brand",
      "components",
      "handoff",
    ]));
    expect(trace.outputs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "artifact",
        title: "Buzzr Design System Pull",
      }),
    ]));
  });

  it("derives human-readable activity from Codex terminal commands", () => {
    const trace = deriveStudioTrace({
      session: {
        id: "studio-session-1",
        action: "audit",
        status: "running",
      },
      events: [
        makeEvent("terminal_command", "/bin/zsh -lc 'nl -ba src/studio/server.ts | sed -n 1,80p'", {
          command: "/bin/zsh -lc 'nl -ba src/studio/server.ts | sed -n 1,80p'",
          status: "completed",
          exit_code: 0,
        }),
        makeEvent("terminal_output", "1 import http from \"node:http\";\n", {
          status: "completed",
          exit_code: 0,
        }),
        makeEvent("terminal_command", "/bin/zsh -lc 'rg \"tool_call\" src/studio'", {
          command: "/bin/zsh -lc 'rg \"tool_call\" src/studio'",
          status: "in_progress",
        }),
      ],
    });

    expect(trace.activities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "reading_file",
        status: "completed",
        label: "Reading server.ts",
        targetPath: "src/studio/server.ts",
        command: "/bin/zsh -lc 'nl -ba src/studio/server.ts | sed -n 1,80p'",
      }),
      expect.objectContaining({
        kind: "searching",
        status: "running",
        label: "Searching src/studio",
      }),
    ]));
    expect(trace.activeProcesses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: "running",
        command: "/bin/zsh -lc 'rg \"tool_call\" src/studio'",
        outputPreview: "",
      }),
    ]));
  });

  it("reconciles repeated Codex command lifecycle events before showing active processes", () => {
    const trace = deriveStudioTrace({
      session: {
        id: "studio-session-1",
        action: "audit",
        status: "running",
      },
      events: [
        makeEvent("terminal_command", "/bin/zsh -lc 'rg \"sports\" src'", {
          id: "item_1",
          command: "/bin/zsh -lc 'rg \"sports\" src'",
          status: "in_progress",
        }),
        makeEvent("tool_call", "Inspect unrelated context"),
        makeEvent("terminal_command", "/bin/zsh -lc 'rg \"sports\" src'", {
          id: "item_1",
          command: "/bin/zsh -lc 'rg \"sports\" src'",
          status: "completed",
          exit_code: 0,
          aggregated_output: "src/data/sports.ts:1\n",
        }),
      ],
    });

    expect(trace.activities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "searching",
        status: "completed",
        command: "/bin/zsh -lc 'rg \"sports\" src'",
        sourceEventIds: expect.arrayContaining([
          expect.any(String),
        ]),
      }),
    ]));
    expect(trace.activeProcesses).toEqual([]);
  });

  it("does not surface stale active processes for finished sessions", () => {
    const trace = deriveStudioTrace({
      session: {
        id: "studio-session-1",
        action: "audit",
        status: "completed",
      },
      events: [
        makeEvent("terminal_command", "/bin/zsh -lc 'sed -n 1,80p src/studio/server.ts'", {
          id: "item_1",
          command: "/bin/zsh -lc 'sed -n 1,80p src/studio/server.ts'",
          status: "in_progress",
        }),
      ],
    });

    expect(trace.activities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "reading_file",
        status: "running",
      }),
    ]));
    expect(trace.activeProcesses).toEqual([]);
  });

  it("keeps latest reasoning live while a session is active", () => {
    const trace = deriveStudioTrace({
      session: {
        id: "studio-session-1",
        action: "audit",
        status: "running",
      },
      events: [
        makeEvent("reasoning", "Checking the next step."),
      ],
    });

    expect(trace.activities).toEqual([
      expect.objectContaining({
        kind: "thinking",
        label: "Thinking",
        status: "running",
        summary: "Checking the next step.",
      }),
    ]);
  });

  it("completes reasoning once a later tool event starts", () => {
    const trace = deriveStudioTrace({
      session: {
        id: "studio-session-1",
        action: "audit",
        status: "running",
      },
      events: [
        makeEvent("reasoning", "Checking the next step."),
        makeEvent("tool_call", "Read", {
          id: "tool_1",
          name: "Read",
          input: { file_path: "apps/studio/src/App.tsx" },
        }),
      ],
    });

    expect(trace.activities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "thinking",
        status: "completed",
      }),
      expect.objectContaining({
        kind: "reading_file",
        status: "running",
      }),
    ]));
  });

  it("does not keep reasoning live after session completion", () => {
    const trace = deriveStudioTrace({
      session: {
        id: "studio-session-1",
        action: "audit",
        status: "completed",
      },
      events: [
        makeEvent("reasoning", "Checking the next step."),
        makeEvent("session_done", "Session completed"),
      ],
    });

    expect(trace.activities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "thinking",
        status: "completed",
      }),
    ]));
    expect(trace.activeProcesses).toEqual([]);
  });

  it("derives file activity from Claude-style tool calls", () => {
    const trace = deriveStudioTrace({
      session: {
        id: "studio-session-1",
        action: "audit",
        status: "running",
      },
      events: [
        makeEvent("reasoning", "I will inspect the Studio event flow first."),
        makeEvent("tool_call", "Read", {
          name: "Read",
          input: { file_path: "apps/studio/src/App.tsx" },
        }),
        makeEvent("tool_call", "Grep", {
          name: "Grep",
          input: { pattern: "terminal_command", path: "src/studio" },
        }),
      ],
    });

    expect(trace.activities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "thinking",
        label: "Thinking",
        summary: "I will inspect the Studio event flow first.",
      }),
      expect.objectContaining({
        kind: "reading_file",
        label: "Reading App.tsx",
        targetPath: "apps/studio/src/App.tsx",
      }),
      expect.objectContaining({
        kind: "searching",
        label: "Searching src/studio",
        summary: "Grep terminal_command in src/studio",
      }),
    ]));
  });

  it("merges tool calls and matching results into one trace card", () => {
    const trace = deriveStudioTrace({
      session: {
        id: "studio-session-1",
        action: "audit",
        status: "running",
      },
      events: [
        makeEvent("tool_call", "Edit", {
          id: "tool_1",
          name: "Edit",
          input: { file_path: "apps/studio/src/App.tsx" },
        }),
        makeEvent("tool_result", "Patched App.tsx", {
          id: "tool_1",
          status: "completed",
          output: "ok",
        }),
      ],
    });

    expect(trace.toolRuns).toEqual([
      expect.objectContaining({
        id: "tool:tool_1",
        tool: "Edit",
        status: "completed",
        eventIds: ["tool_call-1", "tool_result-1"],
      }),
    ]);
    expect(trace.activities).toEqual([
      expect.objectContaining({
        kind: "writing_file",
        status: "completed",
        targetPath: "apps/studio/src/App.tsx",
        sourceEventIds: ["tool_call-1", "tool_result-1"],
        outputPreview: "Patched App.tsx",
      }),
    ]);
  });

  it("merges approval request and resolution into one trace card", () => {
    const trace = deriveStudioTrace({
      session: {
        id: "studio-session-1",
        action: "raw",
        status: "running",
      },
      events: [
        makeEvent("approval_request", "Run shell", {
          id: "approval_1",
          tool: "shell",
        }),
        makeEvent("approval_resolved", "Approved", {
          id: "approval_1",
          tool: "shell",
          status: "approved",
        }),
      ],
    });

    expect(trace.toolRuns).toEqual([
      expect.objectContaining({
        id: "tool:approval_1",
        tool: "shell",
        status: "completed",
        eventIds: ["approval_request-1", "approval_resolved-1"],
      }),
    ]);
    expect(trace.activities).toEqual([
      expect.objectContaining({
        kind: "using_tool",
        label: "Approve shell",
        status: "completed",
        sourceEventIds: ["approval_request-1", "approval_resolved-1"],
      }),
    ]);
  });

  it("surfaces browser, MCP, Figma, and computer actions as compact activity kinds", () => {
    const trace = deriveStudioTrace({
      session: {
        id: "studio-session-1",
        action: "browser-audit",
        status: "running",
      },
      events: [
        makeEvent("browser_snapshot", "Captured localhost", { url: "http://127.0.0.1:1420" }),
        makeEvent("mcp_call", "diagnose_app_quality", { tool: "diagnose_app_quality", status: "completed" }),
        makeEvent("figma_action_completed", "Selection inspected", { action: "inspectSelection" }),
        makeEvent("computer_action_completed", "Captured screen", { action: "capture" }),
      ],
    });

    expect(trace.activities).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "browser_action", label: "Browser", status: "completed" }),
      expect.objectContaining({ kind: "mcp_call", label: "MCP diagnose_app_quality", status: "completed" }),
      expect.objectContaining({ kind: "figma_action", label: "Figma inspectSelection", status: "completed" }),
      expect.objectContaining({ kind: "computer_action", label: "Computer capture", status: "completed" }),
    ]));
  });

  it("infers a compact model activity when Hermes-style output has no tool events", () => {
    const trace = deriveStudioTrace({
      session: {
        id: "studio-session-1",
        action: "audit",
        status: "completed",
      },
      events: [
        makeEvent("session_result", "Workspace ready. No tool calls were emitted.", {
          rawPayload: { parser: "hermes-text" },
        }),
      ],
    });

    expect(trace.activities).toEqual([
      expect.objectContaining({
        kind: "thinking",
        status: "completed",
        label: "Summarized result",
        summary: "Workspace ready. No tool calls were emitted.",
      }),
    ]);
  });
});

function makeEvent(type: string, message: string, data?: unknown) {
  return {
    id: `${type}-1`,
    sessionId: "studio-session-1",
    type,
    timestamp: "2026-05-05T00:00:00.000Z",
    message,
    data,
  };
}
