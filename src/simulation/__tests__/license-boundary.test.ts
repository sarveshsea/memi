import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { scanMiroFishLicenseBoundary } from "../license-boundary.js";

describe("MiroFish license boundary", () => {
  it("flags vendored MiroFish/OASIS source markers but allows written references", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-license-"));
    try {
      await mkdir(join(root, "src"), { recursive: true });
      await mkdir(join(root, "docs"), { recursive: true });
      await writeFile(join(root, "README.md"), "MiroFish is an optional AGPL fork adapter.\n", "utf-8");
      await writeFile(join(root, "docs", "MIROFISH.md"), "Document the fork bridge.\n", "utf-8");
      await writeFile(join(root, "src", "copied.py"), "from camel_oasis import generate_reddit_agent_graph\n", "utf-8");

      const result = await scanMiroFishLicenseBoundary(root, {
        packageFiles: ["README.md", "docs/MIROFISH.md", "src/copied.py"],
      });

      expect(result.ok).toBe(false);
      expect(result.violations).toEqual(expect.arrayContaining([
        expect.objectContaining({
          path: "src/copied.py",
          marker: "generate_reddit_agent_graph",
        }),
      ]));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
