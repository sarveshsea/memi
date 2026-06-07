import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

describe("UX tenets and traps packaging", () => {
  it("ships as both a built-in skill and an installable Note", async () => {
    const projectRoot = process.cwd();
    const registry = JSON.parse(await readFile(join(projectRoot, "skills", "registry.json"), "utf-8"));
    const manifest = JSON.parse(await readFile(join(projectRoot, "notes", "ux-tenets-traps", "note.json"), "utf-8"));

    expect(registry.skills).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "ux-tenets-traps",
        file: "skills/UX_TENETS_TRAPS.md",
        activateOn: "design-review",
      }),
    ]));
    expect(manifest).toMatchObject({
      name: "ux-tenets-traps",
      category: "craft",
    });
    expect(manifest.skills.map((skill: { file: string }) => skill.file)).toEqual([
      "ux-tenets-traps.md",
      "ux-screenshot-audit.md",
    ]);
  });
});
