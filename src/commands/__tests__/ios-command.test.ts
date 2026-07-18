import { afterEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerIosCommand } from "../ios.js";
import { captureLogs, lastLog } from "./test-helpers.js";

afterEach(() => vi.restoreAllMocks());

describe("ios command", () => {
  it("emits a compact Apple design brief", async () => {
    const logs = captureLogs();
    const program = new Command();
    registerIosCommand(program, { config: { projectRoot: "/repo" } } as never);

    await program.parseAsync([
      "ios", "brief", "--intent", "Build a settings screen with App Intents", "--detail", "compact", "--json",
    ], { from: "user" });

    const payload = JSON.parse(lastLog(logs));
    expect(payload.action).toBe("prepare_apple_design_brief");
    expect(payload.skillTriggers).toContain("ios-app-intents");
  });

  it("previews SwiftUI files without writing by default", async () => {
    const logs = captureLogs();
    const program = new Command();
    registerIosCommand(program, { config: { projectRoot: "/repo" } } as never);

    await program.parseAsync([
      "ios", "scaffold", "Settings", "--kind", "screen", "--module", "ExampleApp", "--json",
    ], { from: "user" });

    const payload = JSON.parse(lastLog(logs));
    expect(payload).toMatchObject({ action: "scaffold_swiftui_files", status: "planned", dryRun: true });
    expect(payload.files).toHaveLength(4);
  });
});
