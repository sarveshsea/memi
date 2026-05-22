// @ts-nocheck
import { describe, expect, it } from "vitest";
import {
  actualDownloadPointUrl,
  buildWeeklyNpmDownloadGoal,
  buildGrowthStatus,
  collectStaleReferenceMetrics,
  parseHomebrewStudioCask,
} from "../../../scripts/lib/growth-status.mjs";

describe("growth status script contract", () => {
  const staleRepoName = ["m-", "moire"].join("");
  const stalePackageName = ["@sarveshsea", "/memoire"].join("");
  const staleForkName = ["Miro", "Fish"].join("");

  it("tracks downloads for the real public npm package, not the legacy alias", () => {
    expect(actualDownloadPointUrl("@memi-design/cli", "last-week")).toBe("https://api.npmjs.org/downloads/point/last-week/%40memi-design%2Fcli");
    expect(actualDownloadPointUrl(stalePackageName, "last-week")).toBe("https://api.npmjs.org/downloads/point/last-week/%40sarveshsea%2Fmemoire");
  });

  it("parses the Studio Homebrew cask version and release URLs", () => {
    const cask = parseHomebrewStudioCask(`
      cask "memi-studio" do
        version "1.0.0"
        url "https://github.com/sarveshsea/memi-studio/releases/download/v#{version}/Memoire.Studio_#{version}_aarch64.dmg"
      end
    `);

    expect(cask).toEqual({
      name: "memi-studio",
      version: "1.0.0",
      releaseUrls: ["https://github.com/sarveshsea/memi-studio/releases/download/v#{version}/Memoire.Studio_#{version}_aarch64.dmg"],
    });
  });

  it("reports actual package, Studio release, Homebrew, and stale aliases separately", async () => {
    const calls: string[] = [];
    const status = await buildGrowthStatus({
      packageJson: {
        name: "@memi-design/cli",
        version: "1.0.1",
        mcpName: "io.github.sarveshsea/memi",
      },
      now: () => new Date("2026-05-13T00:00:00.000Z"),
      fetchJson: async (url: string) => {
        calls.push(url);
        if (url.includes("registry.npmjs.org")) {
          return { "dist-tags": { latest: "1.0.0" }, versions: { "1.0.0": { mcpName: "io.github.sarveshsea/memi" } } };
        }
        if (url.includes("downloads/point/last-week/%40memi-design%2Fcli")) return { downloads: 128, start: "2026-05-05", end: "2026-05-11" };
        if (url.includes("downloads/point/last-month/%40memi-design%2Fcli")) return { downloads: 256, start: "2026-04-12", end: "2026-05-11" };
        if (url.includes("downloads/point/last-week/%40sarveshsea%2Fmemoire")) return { downloads: 979, start: "2026-05-05", end: "2026-05-11" };
        if (url.includes("downloads/point/last-month/%40sarveshsea%2Fmemoire")) return { downloads: 2232, start: "2026-04-12", end: "2026-05-11" };
        if (url.includes("repos/sarveshsea/memi-studio/releases/latest")) {
          return {
            tag_name: "v1.0.0",
            published_at: "2026-05-10T20:58:22Z",
            assets: [{ name: "Memoire.Studio_1.0.0_aarch64.dmg", download_count: 3 }],
          };
        }
        if (url.includes("repos/sarveshsea/memi")) return { stargazers_count: 10, forks_count: 2, open_issues_count: 2, html_url: "https://github.com/sarveshsea/memi", topics: [] };
        if (url.includes("registry.modelcontextprotocol.io")) return { servers: [], metadata: { count: 0 } };
        if (url.includes("/pulls/")) return { state: "open", number: 1, title: "PR", html_url: url, updated_at: "2026-05-13T00:00:00Z" };
        return {};
      },
      fetchText: async () => `cask "memi-studio" do\n  version "1.0.0"\nend\n`,
      directoryPullRequests: [],
      staleReferenceSources: {
        "README.md": `${staleRepoName} ${stalePackageName} ${staleForkName}`,
        "docs/README.md": "clean",
      },
    });

    expect(calls).toContain("https://api.npmjs.org/downloads/point/last-week/%40memi-design%2Fcli");
    expect(status.downloads.actualPackage.weekly.downloads).toBe(128);
    expect(status.growth.weeklyNpmDownloads).toMatchObject({
      target: 1_000_000,
      current: 128,
      gap: 999_872,
      achieved: false,
    });
    expect(status.downloads.legacyAliases[0].weekly.downloads).toBe(979);
    expect(status.studio.latestRelease).toMatchObject({ tag: "v1.0.0", totalDownloads: 3 });
    expect(status.homebrewStudioCask).toMatchObject({ version: "1.0.0" });
    expect(status.staleReferences.total).toBe(3);
  });

  it("counts stale package and repo references without mixing them into downloads", () => {
    expect(collectStaleReferenceMetrics({
      "README.md": `${staleRepoName} ${stalePackageName} ${staleForkName}`,
      "docs/ok.md": "memi-studio",
    })).toEqual({
      total: 3,
      byPattern: {
        [staleRepoName]: 1,
        [stalePackageName]: 1,
        [staleForkName]: 1,
      },
      byFile: {
        "README.md": 3,
      },
    });
  });

  it("computes the weekly npm download gap without hiding zero-download launches", () => {
    expect(buildWeeklyNpmDownloadGoal({ ok: true, downloads: 0, start: "2026-05-05", end: "2026-05-11" }, 1_000_000)).toEqual({
      target: 1_000_000,
      current: 0,
      gap: 1_000_000,
      achieved: false,
      percentToTarget: 0,
      multipleToTarget: null,
      start: "2026-05-05",
      end: "2026-05-11",
    });
  });
});
