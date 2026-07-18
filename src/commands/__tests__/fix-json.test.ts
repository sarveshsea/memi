import { describe, expect, it } from "vitest";
import { Command } from "commander";
import { access, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerFixCommand } from "../fix.js";
import { captureLogs, lastLog } from "./test-helpers.js";

describe("memi fix plan", () => {
  it("does not write report artifacts with --no-write", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-fix-command-"));
    try {
      await mkdir(join(root, "src", "app"), { recursive: true });
      await writeFile(join(root, "src", "app", "page.tsx"), `
export default function Page() {
  return <main className="bg-[#101010] p-[17px]"><button className="px-[11px]">Ship</button></main>;
}
`, "utf-8");

      const logs = captureLogs();
      const program = new Command();
      registerFixCommand(program, { config: { projectRoot: root } } as never);

      await program.parseAsync(["fix", "plan", "--json", "--no-write"], { from: "user" });
      const payload = JSON.parse(lastLog(logs));

      expect(payload.version).toBe(1);
      await expect(access(join(root, ".memoire"))).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
