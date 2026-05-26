import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createDesignAgentEnvelope, summarizeAgentContext } from "../agent-envelope.js";
import { MEMOIRE_PACKAGE_NAME, MEMOIRE_PACKAGE_URL, MEMOIRE_PACKAGE_VERSION } from "../package-info.js";
import type { StudioAgentContext } from "../types.js";

function context(overrides: Partial<StudioAgentContext> = {}): StudioAgentContext {
  return {
    workspaceLabel: "Memoire workspace",
    projectRoot: "/tmp/memoire",
    action: "compose",
    harness: "codex",
    prompt: "Design a new onboarding flow",
    memory: {
      counts: { home: 1, research: 2, spec: 3, system: 4, monitor: 1, changelog: 0 },
      recent: [
        { kind: "research", title: "Interview themes", summary: "Screenwriter users need faster capture.", sourcePath: "research/interviews.md" },
        { kind: "spec", title: "NoteCard", summary: "Molecule for note previews.", sourcePath: "specs/components/NoteCard.json" },
      ],
    },
    figma: {
      enabled: true,
      status: "connected",
      clients: 1,
      port: 9223,
    },
    ...overrides,
  };
}

describe("studio design agent envelope", () => {
  it("derives the public package identity from package metadata", () => {
    const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL("../../../package.json", import.meta.url)), "utf-8")) as { name: string; version: string };

    expect(MEMOIRE_PACKAGE_NAME).toBe(packageJson.name);
    expect(MEMOIRE_PACKAGE_VERSION).toBe(packageJson.version);
    expect(MEMOIRE_PACKAGE_URL).toBe(`https://www.npmjs.com/package/${packageJson.name}`);
  });

  it("wraps external harness prompts in a UX research and design-system lens", () => {
    const envelope = createDesignAgentEnvelope(context());

    expect(envelope).toContain("# Mémoire Studio Agent Task");
    expect(envelope).toContain("Design/research lens");
    expect(envelope).toContain("Atomic design levels");
    expect(envelope).toContain("Project memory");
    expect(envelope).toContain("Research: 2");
    expect(envelope).toContain("Specs: 3");
    expect(envelope).toContain("Figma bridge: connected");
    expect(envelope).toContain("Design a new onboarding flow");
    expect(envelope).toContain("acceptance criteria");
    expect(envelope).toContain("repo creation");
    expect(envelope).toContain("research_note");
    expect(envelope).toContain("design_decision");
    expect(envelope).toContain("Knowledge capture");
    expect(envelope).toContain("/api/knowledge");
    expect(envelope).toContain("Design changelog capture");
    expect(envelope).toContain(".memoire/project-memory/changelog");
    expect(envelope).toContain("design_system_artifact");
    expect(envelope).toContain("markdown and YAML");
    expect(envelope).toContain(`${MEMOIRE_PACKAGE_NAME}@${MEMOIRE_PACKAGE_VERSION}`);
    expect(envelope).toContain(MEMOIRE_PACKAGE_URL);
    expect(envelope).toContain("specs/components/NoteCard.json");
    expect(envelope).toContain("Codex + Mémoire command ladder");
    expect(envelope).toContain("memi status --json");
    expect(envelope).toContain("memi research report --json");
    expect(envelope).toContain("codex login status");
    expect(envelope).toContain("model_reasoning_effort");
    expect(envelope).toContain("Agentic design-system contract");
    expect(envelope).toContain("Agentic UI public reference: https://agenticui.net/");
    expect(envelope).toContain("message_composer");
    expect(envelope).toContain("tool_trace");
    expect(envelope).toContain("artifact_review");
    expect(envelope).toContain("Open-source pattern references");
    expect(envelope).toContain("GAIA UI");
    expect(envelope).toContain("assistant-ui");
    expect(envelope).toContain("tool-ui");
    expect(envelope).toContain("AG-UI");
    expect(envelope).toContain("OpenGenerativeUI");
    expect(envelope).toContain("Magentic-UI");
    expect(envelope).toContain("composer_agent_state");
    expect(envelope).toContain("auditable_tool_trace_cards");
    expect(envelope).toContain("artifact_acceptance_state");
    expect(envelope).not.toMatch(/\bark\b/i);
  });

  it("makes Codex plan mode explicit for research-scale read-only runs", () => {
    const envelope = createDesignAgentEnvelope(context({
      action: "research",
      chatMode: "research",
      permissionMode: "plan",
      codex: {
        model: "gpt-5.4",
        reasoningEffort: "high",
        approvalPolicy: "on-request",
        webSearch: true,
        skipGitRepoCheck: true,
        includeMemoireCommands: true,
        includeCodexCommands: true,
        planModeDefault: true,
      },
    }));

    expect(envelope).toContain("Plan mode");
    expect(envelope).toContain("read-only");
    expect(envelope).toContain("Codex model: gpt-5.4");
    expect(envelope).toContain("Codex reasoning: high");
    expect(envelope).toContain("Codex approval policy: on-request");
  });

  it("keeps the pinned conversation goal distinct from the immediate prompt", () => {
    const envelope = createDesignAgentEnvelope(context({
      conversationId: "conv-onboarding",
      turnIndex: 2,
      goal: "Increase activation without adding onboarding clutter.",
      prompt: "Audit the empty state copy.",
    }));

    expect(envelope).toContain("## Conversation goal");
    expect(envelope).toContain("Increase activation without adding onboarding clutter.");
    expect(envelope).toContain("- Conversation: conv-onboarding");
    expect(envelope).toContain("- Turn: 3");
    expect(envelope).toContain("## User request\nAudit the empty state copy.");
  });

  it("summarizes context compactly for run blocks", () => {
    const summary = summarizeAgentContext(context({ harness: "claude-code", action: "audit" }));

    expect(summary).toEqual({
      workspace: "Memoire workspace",
      harness: "claude-code",
      action: "audit",
      memory: "home 1 / research 2 / spec 3 / system 4 / monitor 1 / changelog 0",
      figma: "connected on 9223 with 1 client",
    });
  });

  it("gives Hermes a native Memoire skill and CLI activation path", () => {
    const envelope = createDesignAgentEnvelope(context({ harness: "hermes" }));

    expect(envelope).toContain("memoire-design-tooling");
    expect(envelope).toContain("memi agent install hermes");
    expect(envelope).toContain("memi status");
    expect(envelope).toContain("memi compose");
    expect(envelope).toContain("Figma bridge");
  });

  it("injects compact research-design context and FigJam tool suggestions", () => {
    const envelope = createDesignAgentEnvelope(context({
      action: "self-design",
      chatMode: "research",
      researchDesign: {
        personas: ["Product manager"],
        findings: ["finding-evidence: PMs need visible evidence links."],
        risks: ["Risk review skipped"],
        metrics: ["Decision confidence"],
        latestSimulationRunId: "run-swarm",
        suggestedTools: ["research.design_package", "research.generate_specs", "mermaid_jam.export"],
      },
    }));

    expect(envelope).toContain("Research-backed vibe design");
    expect(envelope).toContain("Product manager");
    expect(envelope).toContain("finding-evidence");
    expect(envelope).toContain("run-swarm");
    expect(envelope).toContain("research.design_package");
    expect(envelope).toContain("mermaid_jam.export");
  });
});
