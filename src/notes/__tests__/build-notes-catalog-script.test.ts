import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
let root: string;
let skillsRoot: string;
let outRoot: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "memoire-catalog-builder-"));
  skillsRoot = join(root, "skills");
  outRoot = join(root, "out");
  await mkdir(skillsRoot, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("build-notes-catalog script", () => {
  it("rejects unsafe manifest names and source URL schemes", async () => {
    await writeFixture("unsafe-note", { name: "../escape" });
    await expect(runBuilder()).rejects.toThrow(/match its directory/i);

    await rm(join(skillsRoot, "unsafe-note"), { recursive: true, force: true });
    await writeFixture("unsafe-url", { sourceUrls: ["javascript:alert(1)"] });
    await expect(runBuilder()).rejects.toThrow(/sourceUrls must use HTTPS/i);
  });

  it("builds deterministic archives, canonical source paths, and removes stale output", async () => {
    await writeFixture("safe-note");
    await mkdir(join(outRoot, "safe-note"), { recursive: true });
    await writeFile(join(outRoot, "safe-note", "safe-note-0.9.0.tgz"), "immutable old release");
    await runBuilder();
    const archivePath = join(outRoot, "safe-note", "safe-note-1.0.0.tgz");
    const first = await readFile(archivePath);
    await mkdir(join(outRoot, "stale-note"), { recursive: true });
    await writeFile(join(outRoot, "stale-note", "old.tgz"), "stale");

    await runBuilder();
    expect(await readFile(archivePath)).toEqual(first);
    expect(await readFile(join(outRoot, "safe-note", "safe-note-0.9.0.tgz"), "utf8")).toBe("immutable old release");
    await expect(stat(join(outRoot, "stale-note"))).rejects.toThrow();
    const catalog = JSON.parse(await readFile(join(outRoot, "catalog.v1.json"), "utf8"));
    expect(catalog.notes[0].sourcePath).toBe("skills/safe-note");
  });

  it("requires a version bump instead of replacing an existing archive", async () => {
    await writeFixture("safe-note");
    await mkdir(join(outRoot, "safe-note"), { recursive: true });
    await writeFile(join(outRoot, "safe-note", "safe-note-1.0.0.tgz"), "published bytes");
    await expect(runBuilder()).rejects.toThrow(/bump the Note version/i);
  });
});

async function writeFixture(name: string, overrides: Record<string, unknown> = {}): Promise<void> {
  const skillDir = join(skillsRoot, name);
  await mkdir(skillDir, { recursive: true });
  await writeFile(join(skillDir, "SKILL.md"), `---\nname: ${name}\ndescription: Safe fixture skill for catalog tests.\n---\n\n# Safe\n`);
  await writeFile(join(skillDir, "note.json"), JSON.stringify({
    name,
    version: "1.0.0",
    description: "Safe fixture skill for catalog tests.",
    author: "Test",
    category: "craft",
    tags: [],
    sourceUrls: ["https://example.com/source"],
    skills: [{ file: "SKILL.md", name: "Safe Note", activateOn: "always", freedomLevel: "high" }],
    dependencies: [],
    ...overrides,
  }));
}

function runBuilder(): Promise<void> {
  return new Promise((resolveRun, rejectRun) => {
    execFile(process.execPath, [
      join(projectRoot, "scripts", "build-notes-catalog.mjs"),
      "--notes-root", skillsRoot,
      "--out-root", outRoot,
      "--base-url", "https://example.com/notes",
      "--source-kind", "community",
      "--source-repo", "https://github.com/example/design-skills",
      "--contribution-base-url", "https://github.com/example/design-skills/tree/main/skills",
    ], { cwd: projectRoot, encoding: "utf8" }, (error, _stdout, stderr) => {
      if (error) rejectRun(new Error(stderr || error.message));
      else resolveRun();
    });
  });
}
