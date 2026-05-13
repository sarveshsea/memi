import { describe, expect, it } from "vitest";
import { defaultStudioConfig } from "../config.js";
import { buildHarnessCommand, getHarnessManifest } from "../harnesses.js";
import type { StudioConfig, StudioHarnessId } from "../types.js";

function enableHarness(config: StudioConfig, harnessId: StudioHarnessId): StudioConfig {
  return {
    ...config,
    harnesses: config.harnesses.map((harness) => (
      harness.id === harnessId ? { ...harness, enabled: true } : harness
    )),
  };
}

describe("studio harness manifest", () => {
  it("loads shared harness definitions with execution metadata", () => {
    const manifest = getHarnessManifest();

    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.harnesses.map((harness) => harness.id)).toEqual([
      "memoire",
      "claude-code",
      "codex",
      "opencode",
      "gemini",
      "ollama",
      "hermes",
      "shell",
    ]);
    expect(manifest.harnesses.find((harness) => harness.id === "codex")).toMatchObject({
      provider: "openai",
      defaultModel: "GPT-5.5 Design",
      supportsCancel: true,
      workspacePolicy: "workspace-required",
      outputParser: "codex-jsonl",
      supportsSkills: true,
      supportsMcp: true,
      docsUrl: "https://developers.openai.com/codex/cli",
    });
    expect(manifest.harnesses.filter((harness) => harness.enabledByDefault).map((harness) => harness.id)).toEqual([
      "claude-code",
      "codex",
    ]);
  });

  it("marks Codex and Claude Code as the only primary Studio harnesses", () => {
    const manifest = getHarnessManifest();
    const primaryHarnesses = manifest.harnesses.filter((harness) => harness.visibility === "primary");
    const advancedHarnesses = manifest.harnesses.filter((harness) => harness.visibility === "advanced");

    expect(primaryHarnesses.map((harness) => harness.id)).toEqual(["claude-code", "codex"]);
    expect(advancedHarnesses.map((harness) => harness.id)).toEqual([
      "memoire",
      "opencode",
      "gemini",
      "ollama",
      "hermes",
      "shell",
    ]);
    expect(defaultStudioConfig("/tmp/project").harnesses.filter((harness) => harness.visibility === "primary").map((harness) => harness.id)).toEqual([
      "claude-code",
      "codex",
    ]);
  });

  it("adds schema v2 setup diagnostics and extension-safe metadata for Claude Code and Codex", () => {
    const manifest = getHarnessManifest();
    const claude = manifest.harnesses.find((harness) => harness.id === "claude-code");
    const codex = manifest.harnesses.find((harness) => harness.id === "codex");

    expect(claude).toMatchObject({
      docsUrl: "https://code.claude.com/docs/en/cli-reference",
      supportsSkills: true,
      supportsMcp: true,
      authProbe: { command: "claude", args: ["auth", "status"] },
    });
    expect(claude?.pluginDirs).toEqual(expect.arrayContaining(["~/.claude/plugins"]));
    expect(claude?.commandTemplates.raw).toEqual(expect.arrayContaining([
      "-p",
      "--output-format",
      "stream-json",
      "--include-partial-messages",
      "--permission-mode",
      "default",
    ]));
    expect(claude?.knownFailurePatterns?.some((pattern) => /login|auth/i.test(pattern.message))).toBe(true);

    expect(codex?.setup.map((step) => step.id)).toEqual(expect.arrayContaining([
      "install-codex-cli",
      "codex-sign-in",
      "codex-skills",
    ]));
    expect(codex?.knownFailurePatterns?.some((pattern) => /sandbox/i.test(pattern.message))).toBe(true);
  });

  it("defines Hermes one-shot and local model harness metadata", () => {
    const manifest = getHarnessManifest();

    expect(manifest.harnesses.find((harness) => harness.id === "hermes")).toMatchObject({
      label: "Hermes",
      command: "hermes",
      provider: "local",
      outputParser: "hermes-text",
      supportsCancel: true,
    });
    expect(manifest.harnesses.find((harness) => harness.id === "hermes")?.commandTemplates.raw).toEqual([
      "--toolsets",
      "terminal,file,memory,skills,todo,session_search,clarify",
      "--oneshot",
      "{{promptEnvelope}}",
    ]);
    expect(manifest.harnesses.find((harness) => harness.id === "ollama")?.defaultModel).toBe("llama3.1:8b");
  });

  it("builds Memoire commands for design-first actions", () => {
    const root = "/tmp/project";
    const config = enableHarness(defaultStudioConfig(root), "memoire");

    expect(buildHarnessCommand(config, {
      harnessId: "memoire",
      cwd: root,
      prompt: "https://memoire.cv",
      action: "design-doc",
    })).toMatchObject({
      args: ["design-doc", "https://memoire.cv", "--json"],
      action: "design-doc",
    });

    expect(buildHarnessCommand(config, {
      harnessId: "memoire",
      cwd: root,
      prompt: "column",
      action: "references",
    })).toMatchObject({
      args: ["references", "search", "column", "--json"],
      action: "references",
    });
  });

  it("exposes autonomous lab actions to native and delegate harnesses", () => {
    const manifest = getHarnessManifest();
    const expectedActions = ["app-build", "self-design", "research", "fix", "browser-audit", "handoff"];

    expect(manifest.harnesses.find((harness) => harness.id === "memoire")?.capabilities).toEqual(expect.arrayContaining(expectedActions));
    expect(manifest.harnesses.find((harness) => harness.id === "codex")?.capabilities).toEqual(expect.arrayContaining(expectedActions));
    expect(manifest.harnesses.find((harness) => harness.id === "claude-code")?.capabilities).toEqual(expect.arrayContaining(expectedActions));
  });

  it("blocks hardline shell commands even when shell is enabled", () => {
    const root = "/tmp/project";
    const config = {
      ...defaultStudioConfig(root),
      enabledTools: {
        ...defaultStudioConfig(root).enabledTools,
        shell: true,
      },
      harnesses: defaultStudioConfig(root).harnesses.map((harness) => (
        harness.id === "shell" ? { ...harness, enabled: true } : harness
      )),
    };

    expect(() => buildHarnessCommand(config, {
      harnessId: "shell",
      cwd: root,
      prompt: "rm -rf /",
      action: "raw",
    })).toThrow(/blocked/i);
  });
});
