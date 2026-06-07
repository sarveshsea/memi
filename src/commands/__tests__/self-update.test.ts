import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  compareSemver,
  isNewer,
  getInstallChannel,
  readUpdateCache,
  updateCachePath,
  writeUpdateCache,
} from "../../utils/update-check.js";

describe("compareSemver", () => {
  it("orders core versions numerically", () => {
    expect(compareSemver("1.0.3", "1.0.2")).toBe(1);
    expect(compareSemver("1.0.2", "1.0.3")).toBe(-1);
    expect(compareSemver("1.0.2", "1.0.2")).toBe(0);
    expect(compareSemver("1.2.0", "1.10.0")).toBe(-1); // numeric, not lexical
    expect(compareSemver("2.0.0", "1.99.99")).toBe(1);
  });

  it("tolerates a leading v and build metadata", () => {
    expect(compareSemver("v1.1.0", "1.0.9")).toBe(1);
    expect(compareSemver("1.0.0+build.5", "1.0.0+build.1")).toBe(0);
  });

  it("ranks a release above a prerelease of the same core", () => {
    expect(compareSemver("2.0.0", "2.0.0-rc.1")).toBe(1);
    expect(compareSemver("2.0.0-rc.1", "2.0.0")).toBe(-1);
    expect(compareSemver("2.0.0-rc.2", "2.0.0-rc.1")).toBe(1);
    expect(compareSemver("2.0.0-rc.1", "2.0.0-rc.1")).toBe(0);
  });
});

describe("isNewer", () => {
  it("is true only when latest strictly exceeds current", () => {
    expect(isNewer("1.0.3", "1.0.2")).toBe(true);
    expect(isNewer("1.0.2", "1.0.2")).toBe(false);
    expect(isNewer("1.0.1", "1.0.2")).toBe(false);
    expect(isNewer("2.0.0", "2.0.0-rc.1")).toBe(true);
  });
});

describe("getInstallChannel", () => {
  it("reports npm when running under node (test runner)", () => {
    expect(getInstallChannel()).toBe("npm");
  });
});

describe("update cache", () => {
  let dir: string;
  let prevHome: string | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "memi-update-test-"));
    prevHome = process.env.HOME;
    process.env.HOME = dir;
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    rmSync(dir, { recursive: true, force: true });
  });

  it("resolves the cache path under $HOME/.memoire", () => {
    expect(updateCachePath()).toBe(join(dir, ".memoire", "update-check.json"));
  });

  it("round-trips a cache entry", () => {
    const entry = { lastCheckAt: "2026-06-06T00:00:00.000Z", latestVersion: "1.2.3", channel: "npm" as const };
    writeUpdateCache(entry);
    expect(readUpdateCache()).toEqual(entry);
    // and it is valid JSON on disk
    const raw = JSON.parse(readFileSync(updateCachePath(), "utf-8"));
    expect(raw.latestVersion).toBe("1.2.3");
  });

  it("returns null when no cache exists", () => {
    expect(readUpdateCache()).toBeNull();
  });
});

describe("CLI registration", () => {
  it("wires self-update into the entrypoint", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(join(process.cwd(), "src", "index.ts"), "utf-8");
    expect(source).toContain("registerSelfUpdateCommand");
    expect(source).toContain("registerSelfUpdateCommand(program, engine);");
    expect(source).toContain("maybeNotifyUpdate");
  });
});
