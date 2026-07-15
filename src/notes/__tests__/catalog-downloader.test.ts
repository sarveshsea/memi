import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_NOTES_CATALOG_URL,
  NoteCatalogSchema,
  assertSafeArchiveEntries,
  installNote,
} from "../index.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "memoire-notes-catalog-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("remote Notes catalog and downloader", () => {
  it("parses compact remote catalog entries with archive checksums and freshness metadata", () => {
    const parsed = NoteCatalogSchema.parse({
      schemaVersion: 1,
      generatedAt: "2026-05-06T00:00:00.000Z",
      baseUrl: "https://www.memoire.cv/notes",
      notes: [{
        id: "remotion-video",
        name: "remotion-video",
        title: "Remotion Video",
        version: "0.1.0",
        description: "Current Remotion video production guidance.",
        category: "generate",
        tags: ["video", "remotion"],
        sourceUrls: ["https://www.remotion.dev/docs/studio"],
        lastResearchedAt: "2026-05-06T00:00:00.000Z",
        freshnessDays: 60,
        archive: {
          url: "https://www.memoire.cv/notes/remotion-video/remotion-video-0.1.0.tgz",
          sha256: "a".repeat(64),
          size: 1024,
        },
      }],
    });

    expect(DEFAULT_NOTES_CATALOG_URL).toBe("https://www.memoire.cv/notes/catalog.v1.json");
    expect(parsed.notes[0]).toMatchObject({
      name: "remotion-video",
      archive: { sha256: "a".repeat(64) },
      sourceUrls: ["https://www.remotion.dev/docs/studio"],
      freshnessDays: 60,
    });
  });

  it("rejects path traversal archive entries before extracting downloaded notes", () => {
    expect(() => assertSafeArchiveEntries(["package/note.json", "package/remotion-video.md"])).not.toThrow();
    expect(() => assertSafeArchiveEntries(["package/note.json", "../evil.txt"])).toThrow(/path traversal/i);
    expect(() => assertSafeArchiveEntries(["/tmp/evil.txt"])).toThrow(/absolute/i);
  });

  it("installs a safe note name through a file catalog with checksum verification", async () => {
    const sourceDir = join(root, "fixture-source", "remotion-video");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(join(sourceDir, "note.json"), JSON.stringify({
      name: "remotion-video",
      version: "0.1.0",
      description: "Current Remotion video production guidance.",
      category: "generate",
      tags: ["video", "remotion"],
      sourceUrls: ["https://www.remotion.dev/docs/studio"],
      lastResearchedAt: "2026-05-06T00:00:00.000Z",
      freshnessDays: 60,
      skills: [{
        file: "remotion-video.md",
        name: "Remotion Video",
        activateOn: "motion-video",
        freedomLevel: "high",
      }],
      dependencies: [],
    }, null, 2));
    await writeFile(join(sourceDir, "remotion-video.md"), "# Remotion Video\n\nUse npx remotion studio.\n");

    const archivePath = join(root, "remotion-video-0.1.0.tgz");
    await tar(["-czf", archivePath, "-C", join(root, "fixture-source"), "remotion-video"]);
    const archiveBytes = await readFile(archivePath);
    const sha256 = createHash("sha256").update(archiveBytes).digest("hex");
    const catalogPath = join(root, "catalog.v1.json");
    await writeFile(catalogPath, JSON.stringify({
      schemaVersion: 1,
      generatedAt: "2026-05-06T00:00:00.000Z",
      baseUrl: pathToFileURL(root).toString(),
      notes: [{
        id: "remotion-video",
        name: "remotion-video",
        title: "Remotion Video",
        version: "0.1.0",
        description: "Current Remotion video production guidance.",
        category: "generate",
        tags: ["video", "remotion"],
        sourceUrls: ["https://www.remotion.dev/docs/studio"],
        lastResearchedAt: "2026-05-06T00:00:00.000Z",
        freshnessDays: 60,
        archive: {
          url: pathToFileURL(archivePath).toString(),
          sha256,
          size: archiveBytes.byteLength,
        },
      }],
    }, null, 2));

    const manifest = await installNote("remotion-video", root, {
      catalogUrl: pathToFileURL(catalogPath).toString(),
    });

    expect(manifest.name).toBe("remotion-video");
    expect(await readFile(join(root, ".memoire", "notes", "remotion-video", "remotion-video.md"), "utf-8"))
      .toContain("npx remotion studio");
  });

  it("rejects extracted note archives containing symbolic links", async () => {
    const sourceDir = join(root, "fixture-source", "linked-note");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(join(sourceDir, "note.json"), JSON.stringify({
      name: "linked-note",
      version: "0.1.0",
      description: "Unsafe linked note fixture.",
      category: "craft",
      tags: [],
      sourceUrls: ["https://example.com/linked-note"],
      skills: [{ file: "SKILL.md", name: "Linked Note", activateOn: "always", freedomLevel: "high" }],
      dependencies: [],
    }));
    await writeFile(join(sourceDir, "SKILL.md"), "# Linked Note\n");
    await writeFile(join(root, "outside-secret.txt"), "must not be exposed\n");
    await symlink("../../outside-secret.txt", join(sourceDir, "leak.txt"));

    const archivePath = join(root, "linked-note-0.1.0.tgz");
    await tar(["-czf", archivePath, "-C", join(root, "fixture-source"), "linked-note"]);
    const archiveBytes = await readFile(archivePath);
    const catalogPath = join(root, "linked-catalog.v1.json");
    await writeFile(catalogPath, JSON.stringify({
      schemaVersion: 1,
      generatedAt: "2026-07-15T00:00:00.000Z",
      baseUrl: pathToFileURL(root).toString(),
      notes: [{
        id: "linked-note",
        name: "linked-note",
        title: "Linked Note",
        version: "0.1.0",
        description: "Unsafe linked note fixture.",
        category: "craft",
        tags: [],
        sourceUrls: ["https://example.com/linked-note"],
        archive: {
          url: pathToFileURL(archivePath).toString(),
          sha256: createHash("sha256").update(archiveBytes).digest("hex"),
          size: archiveBytes.byteLength,
        },
      }],
    }));

    await expect(installNote("linked-note", root, {
      catalogUrl: pathToFileURL(catalogPath).toString(),
    })).rejects.toThrow(/symbolic link/i);
  });

  it("rejects archives whose downloaded size does not match the signed catalog", async () => {
    const archivePath = join(root, "wrong-size.tgz");
    await writeFile(archivePath, "not-a-tar");
    const archiveBytes = await readFile(archivePath);

    await expect(installNote("wrong-size", root, {
      catalogUrl: await writeCatalog("wrong-size", archivePath, archiveBytes, archiveBytes.byteLength + 1),
    })).rejects.toThrow(/size mismatch/i);
  });

  it("rejects gzip bombs before extracting oversized file payloads", async () => {
    const sourceDir = join(root, "fixture-source", "oversized-note");
    await mkdir(sourceDir, { recursive: true });
    for (let index = 0; index < 5; index += 1) {
      await writeFile(join(sourceDir, `payload-${index}.bin`), Buffer.alloc(4_500_000));
    }
    const archivePath = join(root, "oversized-note.tgz");
    await tar(["-czf", archivePath, "-C", join(root, "fixture-source"), "oversized-note"]);
    const archiveBytes = await readFile(archivePath);

    await expect(installNote("oversized-note", root, {
      catalogUrl: await writeCatalog("oversized-note", archivePath, archiveBytes, archiveBytes.byteLength),
    })).rejects.toThrow(/decompression ratio|uncompressed size limit/i);
  });
});

async function writeCatalog(name: string, archivePath: string, archiveBytes: Buffer, declaredSize: number): Promise<string> {
  const catalogPath = join(root, `${name}-catalog.v1.json`);
  await writeFile(catalogPath, JSON.stringify({
    schemaVersion: 1,
    generatedAt: "2026-07-15T00:00:00.000Z",
    baseUrl: pathToFileURL(root).toString(),
    notes: [{
      id: name,
      name,
      title: name,
      version: "0.1.0",
      description: `${name} fixture.`,
      category: "craft",
      tags: [],
      sourceUrls: ["https://example.com/fixture"],
      archive: {
        url: pathToFileURL(archivePath).toString(),
        sha256: createHash("sha256").update(archiveBytes).digest("hex"),
        size: declaredSize,
      },
    }],
  }));
  return pathToFileURL(catalogPath).toString();
}

function tar(args: string[]): Promise<void> {
  return new Promise((resolveTar, rejectTar) => {
    execFile("tar", args, { encoding: "utf-8", env: { ...process.env, COPYFILE_DISABLE: "1" } }, (error, _stdout, stderr) => {
      if (error) {
        rejectTar(new Error(stderr || error.message));
        return;
      }
      resolveTar();
    });
  });
}
