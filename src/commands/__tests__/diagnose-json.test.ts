import { afterEach, describe, expect, it } from "vitest";
import { Command } from "commander";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerDiagnoseCommand } from "../diagnose.js";
import { captureLogs, lastLog } from "./test-helpers.js";

afterEach(() => {
  process.exitCode = 0;
});

async function makeDebtRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "memoire-diagnose-command-"));
  await mkdir(join(root, "src", "app"), { recursive: true });
  // >4 unique hex colors so color.raw-hex reaches "high" severity (engine.ts
  // promotes it above "medium" past 4 unique hexes) — the gate tests depend on
  // at least one high-severity issue existing.
  await writeFile(join(root, "src", "app", "page.tsx"), `
export default function Page() {
  return (
    <div className="bg-[#0a0a0a] border-[#333333]">
      <span className="text-[#ff0000]">alert</span>
      <button onClick={() => null} className="p-1 p-2 p-3 bg-[#111111] text-[#ffffff]">Start</button>
    </div>
  );
}
`, "utf-8");
  return root;
}

describe("memi diagnose", () => {
  it("emits app-quality JSON for an existing web app", async () => {
    const root = await makeDebtRepo();
    try {
      const logs = captureLogs();
      const program = new Command();
      registerDiagnoseCommand(program, { config: { projectRoot: root } } as never);

      await program.parseAsync(["diagnose", "--json", "--no-write", "--fail-on", "none"], { from: "user" });
      const payload = JSON.parse(lastLog(logs));

      expect(payload.version).toBe(1);
      expect(payload.summary.scannedFiles).toBe(1);
      expect(payload.summary.score).toBeLessThan(100);
      expect(payload.issues.some((issue: { id: string }) => issue.id === "color.raw-hex")).toBe(true);
      expect(payload.ux.score).toBeLessThan(100);
      expect(payload.ux.trapRisks.some((trap: { trapId: string }) => trap.trapId === "token-drift")).toBe(true);
      expect(process.exitCode ?? 0).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("gates: exits non-zero on high-severity issues by default, including in --json mode", async () => {
    const root = await makeDebtRepo();
    try {
      captureLogs();
      const program = new Command();
      registerDiagnoseCommand(program, { config: { projectRoot: root } } as never);

      await program.parseAsync(["diagnose", "--json", "--no-write"], { from: "user" });
      // The fixture produces at least one high-severity issue; the default
      // --fail-on high gate must fire. (Pre-2.3 this gate required "critical",
      // which the engine never emits, and never ran in --json mode at all.)
      expect(process.exitCode).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("gates: --fail-on none disables the gate", async () => {
    const root = await makeDebtRepo();
    try {
      captureLogs();
      const program = new Command();
      registerDiagnoseCommand(program, { config: { projectRoot: root } } as never);

      await program.parseAsync(["diagnose", "--json", "--no-write", "--fail-on", "none"], { from: "user" });
      expect(process.exitCode ?? 0).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects an invalid --fail-on value", async () => {
    const root = await makeDebtRepo();
    try {
      const logs = captureLogs();
      const program = new Command();
      registerDiagnoseCommand(program, { config: { projectRoot: root } } as never);

      await program.parseAsync(["diagnose", "--json", "--no-write", "--fail-on", "sometimes"], { from: "user" });
      expect(process.exitCode).toBe(1);
      expect(lastLog(logs)).toContain("Invalid --fail-on value");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
