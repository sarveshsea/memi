import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSwiftUiScaffoldPlan, writeSwiftUiScaffold } from "../swiftui-scaffold.js";

describe("SwiftUI scaffold", () => {
  it("plans spec, view, model, preview, and tests without writing", () => {
    const plan = buildSwiftUiScaffoldPlan({
      projectRoot: "/repo",
      name: "Settings",
      kind: "screen",
      moduleName: "ExampleApp",
      intent: "Create an accessible settings flow",
    });

    expect(plan).toMatchObject({
      action: "scaffold_swiftui_files",
      schemaVersion: 1,
      status: "planned",
      dryRun: true,
      approved: false,
      platform: "ios",
      framework: "SwiftUI",
      name: "Settings",
      atomicLevel: "page",
    });
    expect(plan.files.map((file) => file.path)).toEqual([
      ".memoire/specs/ios/Settings.json",
      "Sources/Settings/SettingsModel.swift",
      "Sources/Settings/SettingsView.swift",
      "Tests/SettingsTests.swift",
    ]);
    expect(plan.files.find((file) => file.path.endsWith("View.swift"))?.content).toContain("#Preview");
    expect(plan.files.find((file) => file.path.endsWith("Tests.swift"))?.content).toContain("import Testing");
  });

  it("adds an availability-gated Liquid Glass path", () => {
    const plan = buildSwiftUiScaffoldPlan({
      projectRoot: "/repo",
      name: "CommandBar",
      kind: "component",
      moduleName: "ExampleApp",
      atomicLevel: "molecule",
      liquidGlass: true,
    });
    const view = plan.files.find((file) => file.path.endsWith("View.swift"))?.content ?? "";
    expect(view).toContain("#available(iOS 26.0, *)");
    expect(view).toContain("glassEffect");
    expect(view).toContain("regularMaterial");
  });

  it("writes only after approval and refuses silent overwrites", async () => {
    const root = await mkdtemp(join(tmpdir(), "memi-swiftui-scaffold-"));
    const plan = buildSwiftUiScaffoldPlan({
      projectRoot: root,
      name: "Profile",
      kind: "screen",
      moduleName: "ExampleApp",
      approved: true,
      dryRun: false,
    });

    const result = await writeSwiftUiScaffold(plan);
    expect(result.status).toBe("written");
    expect(await readFile(join(root, "Sources/Profile/ProfileView.swift"), "utf8")).toContain("struct ProfileView");
    await expect(writeSwiftUiScaffold(plan)).rejects.toThrow(/already exists/);
  });

  it("rejects unsafe paths and invalid Swift module names", () => {
    expect(() => buildSwiftUiScaffoldPlan({
      projectRoot: "/repo",
      name: "Profile",
      kind: "screen",
      moduleName: "Example-App",
    })).toThrow(/module name/);
    expect(() => buildSwiftUiScaffoldPlan({
      projectRoot: "/repo",
      name: "Profile",
      kind: "screen",
      moduleName: "ExampleApp",
      outputRoot: "../outside",
    })).toThrow(/relative path/);
  });
});
