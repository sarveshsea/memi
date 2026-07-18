import { execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Homebrew formula renderer", () => {
  it("accepts a space-separated output path", async () => {
    const root = await mkdtemp(join(tmpdir(), "memi-homebrew-render-"));
    const scriptDir = join(root, "scripts", "homebrew");
    const distDir = join(root, "dist-bin");
    const output = join(root, "memoire.rb");

    try {
      await mkdir(scriptDir, { recursive: true });
      await mkdir(distDir, { recursive: true });
      await copyFile(
        join(process.cwd(), "scripts", "homebrew", "update-formula.mjs"),
        join(scriptDir, "update-formula.mjs"),
      );
      await copyFile(
        join(process.cwd(), "scripts", "homebrew", "memoire.rb.template"),
        join(scriptDir, "memoire.rb.template"),
      );
      await writeFile(join(root, "package.json"), JSON.stringify({ version: "9.8.7" }));
      await writeFile(
        join(distDir, "SHA256SUMS.txt"),
        [
          `${"a".repeat(64)}  memi-darwin-arm64.tar.gz`,
          `${"b".repeat(64)}  memi-darwin-x64.tar.gz`,
          `${"c".repeat(64)}  memi-linux-x64.tar.gz`,
        ].join("\n"),
      );

      execFileSync(
        process.execPath,
        [
          join(scriptDir, "update-formula.mjs"),
          "--out",
          output,
          "--version",
          "1.2.3",
        ],
        { cwd: root },
      );

      const formula = await readFile(output, "utf-8");
      expect(formula).toContain('version "1.2.3"');
      expect(formula).not.toContain('version "9.8.7"');
      expect(formula).toContain(`sha256 "${"a".repeat(64)}"`);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
