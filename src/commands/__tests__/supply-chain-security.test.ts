import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("public package supply-chain defaults", () => {
  it("does not ship npm install lifecycle scripts", async () => {
    const root = process.cwd();
    const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf-8"));

    expect(pkg.scripts.preinstall).toBeUndefined();
    expect(pkg.scripts.install).toBeUndefined();
    expect(pkg.scripts.postinstall).toBeUndefined();
    expect(pkg.scripts.prepare).toBeUndefined();
    expect(pkg.files).not.toContain("scripts/postinstall.mjs");
    expect(pkg.files).not.toContain("scripts/prepare.mjs");
  });

  it("pins patched production dependency ranges in the lockfile", async () => {
    const root = process.cwd();
    const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf-8"));

    expect(lock.packages["node_modules/@chenglou/pretext"]?.version).toBe("0.0.6");
    expect(lock.packages["node_modules/path-to-regexp"]?.version).toMatch(/^8\.[4-9]\./);
  });

  it("keeps raw Figma JavaScript execution out of public source paths", async () => {
    const root = process.cwd();
    const pluginMain = await readFile(join(root, "src", "plugin", "main", "index.ts"), "utf-8");
    const mcpTools = await readFile(join(root, "src", "mcp", "tools.ts"), "utf-8");
    const studioToolBroker = await readFile(join(root, "src", "studio", "tool-broker.ts"), "utf-8");

    expect(pluginMain).not.toContain("new Function");
    expect(pluginMain).not.toContain("eval(");
    expect(mcpTools).not.toContain("figma_execute");
    expect(studioToolBroker).not.toContain("figma_execute");
  });
});
