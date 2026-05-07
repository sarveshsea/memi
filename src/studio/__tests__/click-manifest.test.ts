import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildStudioClickManifestFromSource,
  classifyStudioAction,
  normalizeStudioActionId,
  validateStudioClickManifest,
} from "../click-manifest.js";

describe("studio click manifest", () => {
  const source = [
    readFileSync(join(process.cwd(), "apps", "studio", "src", "App.tsx"), "utf-8"),
    readFileSync(join(process.cwd(), "apps", "studio", "src", "workbench-components.tsx"), "utf-8"),
  ].join("\n");

  it("extracts every Studio action id into a testable manifest with no dead enabled actions", () => {
    const manifest = buildStudioClickManifestFromSource(source);
    const validation = validateStudioClickManifest(manifest);

    expect(validation.errors).toEqual([]);
    expect(manifest.length).toBeGreaterThan(40);
    expect(manifest.map((target) => target.id)).toEqual(expect.arrayContaining([
      "command-palette.open",
      "right-pane.tab.run",
      "settings.open",
      "sidebar.new-chat",
      "session.run",
      "session.cancel",
      "changed-files.review",
      "board.create",
      "board.export_mermaid_jam",
      "activity.copy-path.*",
      "artifact.use-system",
      "figma.connect",
      "automations.run.*",
    ]));
  });

  it("normalizes dynamic ids and classifies surfaces, mutations, harnesses, and permissions", () => {
    expect(normalizeStudioActionId("session.switch.${session.id}")).toBe("session.switch.*");
    expect(normalizeStudioActionId("changed-file.copy.${file.path}")).toBe("changed-file.copy.*");

    expect(classifyStudioAction("session.run")).toMatchObject({
      surface: "composer",
      mutates: true,
      requiresHarness: true,
      expectedResult: "Starts a traced Studio harness session.",
    });
    expect(classifyStudioAction("theme.dark")).toMatchObject({
      surface: "topbar",
      mutates: false,
      requiresHarness: false,
    });
    expect(classifyStudioAction("figma.connect")).toMatchObject({
      surface: "figma",
      requiresPermission: "figma",
    });
    expect(classifyStudioAction("computer.action")).toMatchObject({
      surface: "computer",
      requiresPermission: "computer",
    });
  });
});
