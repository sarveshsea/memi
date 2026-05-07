import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("site bundle Notes marketplace", () => {
  it("exposes the Notes marketplace pages and public marketplace asset in the site bundle", async () => {
    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

    expect(packageJson.scripts["check:site-bundle"]).toBe("node scripts/check-site-bundle-urls.mjs");
    expect(existsSync(join(root, "scripts", "check-site-bundle-urls.mjs"))).toBe(true);
    expect(existsSync(join(root, "examples", "site-bundle", "notes", "index.html"))).toBe(true);
    expect(existsSync(join(root, "examples", "site-bundle", "notes", "community", "catalog.v1.json"))).toBe(true);
    expect(existsSync(join(root, "examples", "site-bundle", "notes", "community", "index.html"))).toBe(true);
    expect(existsSync(join(root, "examples", "site-bundle", "notes", "hermes-agent-bridge", "index.html"))).toBe(true);
    expect(existsSync(join(root, "examples", "site-bundle", "assets", "marketplace-catalog.v1.json"))).toBe(true);

    const indexHtml = await readFile(join(root, "examples", "site-bundle", "notes", "index.html"), "utf8");
    const detailHtml = await readFile(join(root, "examples", "site-bundle", "notes", "hermes-agent-bridge", "index.html"), "utf8");

    expect(indexHtml).toContain("data-notes-marketplace=\"vscode-style\"");
    expect(indexHtml).toContain("data-marketplace-search");
    expect(indexHtml).toContain("data-marketplace-source-filter");
    expect(indexHtml).toContain("hermes-agent-bridge");
    expect(indexHtml).toContain("memi notes install hermes-agent-bridge");
    expect(detailHtml).toContain("data-note-marketplace-detail=\"hermes-agent-bridge\"");
    expect(detailHtml).toContain("Download archive");
    expect(detailHtml).toContain("Improve this Note");
  });
});
