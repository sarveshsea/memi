import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(
  readFileSync(join(process.cwd(), "src", "studio", "harness-manifest.json"), "utf-8"),
) as {
  harnesses: Array<{
    id: string;
    supportsStreaming: boolean;
    supportsCancel: boolean;
    outputParser: string;
    installProbe: string[];
    commandTemplates: Partial<Record<string, string[]>>;
  }>;
};

describe("studio harness E2E contract", () => {
  it("covers the macOS power harness matrix with streaming, cancellation, and trace-friendly parsers", () => {
    const harnesses = new Map(manifest.harnesses.map((harness) => [harness.id, harness]));

    for (const id of ["claude-code", "codex", "memoire", "ollama", "hermes"] as const) {
      const harness = harnesses.get(id);
      expect(harness, id).toBeTruthy();
      expect(harness?.supportsStreaming, id).toBe(true);
      expect(harness?.supportsCancel, id).toBe(true);
      expect(harness?.outputParser, id).toMatch(/json|text|ollama/);
      expect(harness?.commandTemplates.raw ?? harness?.commandTemplates.compose, id).toBeTruthy();
    }
  });

  it("keeps Claude Code stream-json verbose and leaves missing/local harnesses as explicit skips, not silent failures", () => {
    const claude = manifest.harnesses.find((harness) => harness.id === "claude-code");
    const ollama = manifest.harnesses.find((harness) => harness.id === "ollama");
    const hermes = manifest.harnesses.find((harness) => harness.id === "hermes");

    expect(claude?.commandTemplates.raw).toEqual(expect.arrayContaining(["--verbose", "stream-json"]));
    expect(ollama?.installProbe).toContain("ollama");
    expect(hermes?.installProbe).toContain("hermes");
  });
});
