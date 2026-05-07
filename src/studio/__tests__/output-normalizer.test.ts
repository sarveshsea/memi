import { describe, expect, it } from "vitest";
import {
  createStudioOutputNormalizer,
  flushStudioOutputNormalizer,
  normalizeStudioOutputChunk,
} from "../output-normalizer.js";

describe("studio output normalizer", () => {
  it("turns pretty Memoire JSON stdout into one session_result event", () => {
    const state = createStudioOutputNormalizer("memoire-jsonl");
    const prettyJson = `{
  "intent": "Design a notes app hero",
  "category": "general",
  "execution": {
    "status": "completed",
    "completedTasks": 2,
    "totalTasks": 2,
    "mutationCount": 0
  }
}`;

    expect(normalizeStudioOutputChunk(state, "stdout", prettyJson.slice(0, 40))).toEqual([]);
    const events = normalizeStudioOutputChunk(state, "stdout", prettyJson.slice(40));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "session_result",
      message: "general completed: 2/2 tasks",
    });
    expect(events[0].data).toMatchObject({
      intent: "Design a notes app hero",
      execution: { status: "completed", completedTasks: 2, totalTasks: 2 },
    });
  });

  it("groups non-json stdout and stderr into block-friendly chunks", () => {
    const state = createStudioOutputNormalizer("stdio");

    expect(normalizeStudioOutputChunk(state, "stdout", "first\nsecond\n")).toEqual([
      { type: "stdout", message: "first\nsecond\n" },
    ]);
    expect(normalizeStudioOutputChunk(state, "stderr", "warning\nmore warning\n")).toEqual([
      { type: "stderr", message: "warning\nmore warning\n" },
    ]);
    expect(flushStudioOutputNormalizer(state)).toEqual([]);
  });

  it("maps Claude stream-json tool use and final result into Studio events", () => {
    const state = createStudioOutputNormalizer("claude-stream-json");
    const events = normalizeStudioOutputChunk(state, "stdout", [
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            { type: "text", text: "I will inspect the specs first." },
            { type: "tool_use", name: "Read", input: { file_path: "specs/pages/Home.json" } },
          ],
        },
      }),
      JSON.stringify({
        type: "result",
        result: "Audited the design system and found no blockers.",
        usage: { input_tokens: 20, output_tokens: 30 },
      }),
      "",
    ].join("\n"));

    expect(events).toEqual([
      expect.objectContaining({ type: "reasoning", message: "I will inspect the specs first." }),
      expect.objectContaining({
        type: "tool_call",
        message: "Read",
        data: expect.objectContaining({ name: "Read" }),
      }),
      expect.objectContaining({
        type: "session_result",
        message: "Audited the design system and found no blockers.",
      }),
    ]);
  });

  it("maps Codex JSONL tool calls and final messages into Studio events", () => {
    const state = createStudioOutputNormalizer("codex-jsonl");
    const events = normalizeStudioOutputChunk(state, "stdout", [
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "function_call",
          name: "shell",
          arguments: "{\"cmd\":\"rg specs\"}",
        },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "agent_message",
          text: "Design audit complete.",
        },
      }),
      JSON.stringify({
        type: "turn.completed",
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
      "",
    ].join("\n"));

    expect(events).toEqual([
      expect.objectContaining({
        type: "tool_call",
        message: "shell",
        data: expect.objectContaining({ name: "shell" }),
      }),
      expect.objectContaining({
        type: "session_result",
        message: "Design audit complete.",
      }),
      expect.objectContaining({
        type: "token_usage",
        message: "Token usage",
      }),
    ]);
  });

  it("maps Codex function call outputs into tool result events", () => {
    const state = createStudioOutputNormalizer("codex-jsonl");
    const events = normalizeStudioOutputChunk(state, "stdout", [
      JSON.stringify({
        type: "item.completed",
        item: {
          id: "item_result",
          type: "function_call_output",
          call_id: "call_1",
          output: "{\"ok\":true}",
        },
      }),
      "",
    ].join("\n"));

    expect(events).toEqual([
      expect.objectContaining({
        type: "tool_result",
        message: "{\"ok\":true}",
        data: expect.objectContaining({
          id: "call_1",
          callId: "call_1",
          output: "{\"ok\":true}",
        }),
      }),
    ]);
  });

  it("maps Claude tool result payloads into tool result events", () => {
    const state = createStudioOutputNormalizer("claude-stream-json");
    const events = normalizeStudioOutputChunk(state, "stdout", [
      JSON.stringify({
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_1",
              content: "Read App.tsx",
            },
          ],
        },
      }),
      "",
    ].join("\n"));

    expect(events).toEqual([
      expect.objectContaining({
        type: "tool_result",
        message: "Read App.tsx",
        data: expect.objectContaining({
          id: "toolu_1",
          toolUseId: "toolu_1",
        }),
      }),
    ]);
  });

  it("preserves structured approval lifecycle events", () => {
    const state = createStudioOutputNormalizer("codex-jsonl");
    const events = normalizeStudioOutputChunk(state, "stdout", [
      JSON.stringify({
        type: "approval_resolved",
        message: "Approved",
        data: { id: "approval_1", status: "approved" },
      }),
      "",
    ].join("\n"));

    expect(events).toEqual([
      expect.objectContaining({
        type: "approval_resolved",
        message: "Approved",
        data: { id: "approval_1", status: "approved" },
      }),
    ]);
  });

  it("splits labeled final model output into first-class Studio events with raw result context", () => {
    const state = createStudioOutputNormalizer("codex-jsonl");
    const rawResult = [
      "**research_note**",
      "Buzzr tokens are fragmented across theme files.",
      "",
      "**design_decision**",
      "Use the token layer as canonical source.",
      "",
      "**artifact**",
      "- P1: Token inventory",
      "",
      "**session_result**",
      "Files changed: none.",
      "",
      "**acceptance_statement**",
      "Audit completed read-only.",
    ].join("\n");

    const events = normalizeStudioOutputChunk(state, "stdout", [
      JSON.stringify({
        type: "item.completed",
        item: {
          id: "item_audit",
          type: "agent_message",
          text: rawResult,
        },
      }),
      "",
    ].join("\n"));

    expect(events.map((event) => event.type)).toEqual([
      "research_note",
      "design_decision",
      "artifact",
      "session_result",
      "acceptance_statement",
    ]);
    expect(events[0]).toMatchObject({
      message: "Buzzr tokens are fragmented across theme files.",
      data: {
        sectionLabel: "research_note",
        sourceEventId: "item_audit",
        rawResult,
      },
    });
    expect(events.at(-1)).toMatchObject({
      message: "Audit completed read-only.",
      data: {
        sectionLabel: "acceptance_statement",
        sourceEventId: "item_audit",
        rawResult,
      },
    });
  });

  it("normalizes human section headings from Codex into structured result blocks", () => {
    const state = createStudioOutputNormalizer("codex-jsonl");
    const rawResult = [
      "## Research Findings",
      "- Users need faster design QA before implementation.",
      "",
      "## Design Decisions",
      "Use Memoire as the command ladder before code edits.",
      "",
      "## Commands Run",
      "`memi status --json`",
      "",
      "## Files Changed",
      "- apps/studio/src/App.tsx",
      "",
      "## Acceptance Criteria",
      "Plan mode stays read-only and research output is sectioned.",
    ].join("\n");

    const events = normalizeStudioOutputChunk(state, "stdout", [
      JSON.stringify({
        type: "item.completed",
        item: {
          id: "item_research",
          type: "agent_message",
          text: rawResult,
        },
      }),
      "",
    ].join("\n"));

    expect(events.map((event) => event.type)).toEqual([
      "research_note",
      "design_decision",
      "tool_call",
      "artifact",
      "acceptance_statement",
    ]);
    expect(events[0]).toMatchObject({
      message: "- Users need faster design QA before implementation.",
      data: expect.objectContaining({ sectionLabel: "research_note" }),
    });
    expect(events[2]).toMatchObject({
      message: "`memi status --json`",
      data: expect.objectContaining({ sectionLabel: "tool_call" }),
    });
  });

  it("maps Codex command execution items into terminal blocks", () => {
    const state = createStudioOutputNormalizer("codex-jsonl");
    const events = normalizeStudioOutputChunk(state, "stdout", [
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "command_execution",
          command: "/bin/zsh -lc 'rg tokens'",
          aggregated_output: "src/theme/tokens.ts\n",
          exit_code: 0,
          status: "completed",
        },
      }),
      "",
    ].join("\n"));

    expect(events).toEqual([
      expect.objectContaining({
        type: "terminal_command",
        message: "/bin/zsh -lc 'rg tokens'",
      }),
      expect.objectContaining({
        type: "terminal_output",
        message: "src/theme/tokens.ts\n",
      }),
    ]);
  });

  it("drops Codex stdin chatter from stderr blocks", () => {
    const state = createStudioOutputNormalizer("codex-jsonl");

    expect(normalizeStudioOutputChunk(state, "stderr", "Reading additional input from stdin...\n")).toEqual([]);
    expect(normalizeStudioOutputChunk(state, "stderr", "Reading additional input from stdin...\nreal warning\n")).toEqual([
      { type: "stderr", message: "real warning\n" },
    ]);
  });
});
