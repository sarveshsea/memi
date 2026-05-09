/**
 * Harness-coverage test — asserts every agent harness declared in
 * src/studio/harness-manifest.json has a registered driver factory in the
 * new HarnessDriver registry.
 *
 * This catches future drift: if someone adds a new harness to the
 * manifest without writing a driver, this test fails loudly and tells
 * them what's missing.
 *
 * `shell` is excluded — it isn't an LLM agent, it's the bare-shell
 * fallback for ad-hoc commands and runs through a different code path.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Importing each driver module ensures it self-registers with the registry.
import "../../drivers/codex.js";
import "../../drivers/claude-code.js";
import "../../drivers/opencode.js";
import "../../drivers/hermes.js";
import "../../drivers/ollama.js";
import "../../drivers/gemini.js";
import "../../drivers/memoire-native.js";

import { listRegisteredDrivers, getDriverFactory } from "../../drivers/registry.js";
import { asId } from "../../contracts/ids.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(HERE, "..", "..", "harness-manifest.json");

interface ManifestHarness {
  id: string;
  command?: string;
}

interface Manifest {
  harnesses: ManifestHarness[];
}

const NON_AGENT_HARNESS_IDS = new Set(["shell"]);

function loadAgentHarnessIds(): string[] {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8")) as Manifest;
  return manifest.harnesses.map((h) => h.id).filter((id) => !NON_AGENT_HARNESS_IDS.has(id));
}

describe("harness coverage", () => {
  const agentIds = loadAgentHarnessIds();

  it("manifest declares the expected agent harnesses", () => {
    expect(agentIds.sort()).toEqual(
      ["claude-code", "codex", "gemini", "hermes", "memoire", "ollama", "opencode"].sort(),
    );
  });

  it.each(agentIds)("%s has a registered driver factory", (id) => {
    const harnessId = asId("HarnessId", `hns_${id}`);
    const factory = getDriverFactory(harnessId);
    expect(factory, `no driver registered for harness "${id}" — add a driver in src/studio/drivers/`).not.toBeNull();
  });

  it("the registry has at least one driver per agent in the manifest", () => {
    const registered = new Set(listRegisteredDrivers().map((id) => String(id).replace(/^hns_/, "")));
    for (const id of agentIds) {
      expect(registered.has(id), `manifest agent "${id}" missing from driver registry`).toBe(true);
    }
  });

  it("every registered driver maps to a declared agent harness", () => {
    const registered = listRegisteredDrivers().map((id) => String(id).replace(/^hns_/, ""));
    const declared = new Set(agentIds);
    for (const id of registered) {
      expect(declared.has(id), `driver "${id}" registered but not declared in harness-manifest.json`).toBe(true);
    }
  });
});
