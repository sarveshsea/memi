import { describe, expect, it } from "vitest";
import { Command } from "commander";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerUxCommand } from "../ux.js";
import { captureLogs, lastLog } from "./test-helpers.js";

describe("memi ux audit", () => {
  it("emits stable UX tenets and traps JSON", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-ux-command-"));
    try {
      await mkdir(join(root, "src", "app"), { recursive: true });
      await writeFile(join(root, "src", "app", "page.tsx"), `
export default function Page() {
  return <button onClick={() => null} className="bg-[#123456] p-[13px]">Start</button>;
}
`, "utf-8");

      const logs = captureLogs();
      const program = new Command();
      registerUxCommand(program, { config: { projectRoot: root } } as never);

      await program.parseAsync(["ux", "audit", "--json", "--no-write"], { from: "user" });
      const payload = JSON.parse(lastLog(logs));

      expect(payload.schemaVersion).toBe(1);
      expect(payload.score).toBeLessThan(100);
      expect(payload.tenetCoverage.map((tenet: { tenetId: string }) => tenet.tenetId)).toContain("consistency");
      expect(payload.trapRisks.map((trap: { trapId: string }) => trap.trapId)).toContain("token-drift");
      expect(payload.recommendedTweaks.length).toBeGreaterThan(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects screenshot audits when the screenshot artifact does not exist", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-ux-command-"));
    const previousExitCode = process.exitCode;
    try {
      const logs = captureLogs();
      const program = new Command();
      registerUxCommand(program, { config: { projectRoot: root } } as never);

      await program.parseAsync(["ux", "audit", "--json", "--no-write", "--screenshot", join(root, "missing.png")], { from: "user" });
      const payload = JSON.parse(lastLog(logs));

      expect(payload).toMatchObject({
        status: "failed",
        error: expect.stringContaining("Screenshot artifact is not readable"),
      });
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = previousExitCode;
      await rm(root, { recursive: true, force: true });
    }
  });
});
