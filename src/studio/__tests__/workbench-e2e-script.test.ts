import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("studio workbench E2E script", () => {
  it("provides a browser click runner and an explicit real-harness runner", () => {
    const root = process.cwd();
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8")) as { scripts: Record<string, string> };
    const script = readFileSync(join(root, "scripts", "studio-workbench-e2e.mjs"), "utf-8");

    expect(pkg.scripts["studio:e2e:workbench"]).toBe("node scripts/studio-workbench-e2e.mjs");
    expect(pkg.scripts["studio:e2e:workbench:real"]).toBe("node scripts/studio-workbench-e2e.mjs --real-harnesses=available");
    expect(script).toContain("chromium.launch");
    expect(script).toContain("launchBrowser");
    expect(script).toContain("Google Chrome.app");
    expect(script).toContain("data-action-id");
    expect(script).toContain("getBoundingClientRect");
    expect(script).toContain("/api/sessions");
    expect(script).toContain("realHarnesses");
    expect(script).toContain("disposable-fixture");
  });
});
