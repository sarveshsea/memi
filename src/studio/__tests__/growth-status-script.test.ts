// @ts-nocheck
import { describe, expect, it } from "vitest";
import {
  actualDownloadPointUrl,
  buildWeeklyNpmDownloadGoal,
  buildGrowthStatus,
  collectStaleReferenceMetrics,
  parseHomebrewStudioCask,
  parseSkillsShPage,
  WEEKLY_NPM_DOWNLOAD_TARGET,
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

  it("parses skills.sh discovery and install counts", () => {
    const page = `
      <meta name="description" content="4 agent skills from sarveshsea/memi — including audit-frontend-design.">
      <span>27<!-- --> total installs</span>
    `;

    expect(parseSkillsShPage(page)).toEqual({
      ok: true,
      url: "https://skills.sh/sarveshsea/memi",
      discoveredSkills: 4,
      totalInstalls: 27,
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
      target: 7_830,
      current: 128,
      gap: 7_702,
      achieved: false,
    });
    expect(status.downloads.legacyAliases[0].weekly.downloads).toBe(979);
    expect(status.studio.latestRelease).toMatchObject({ tag: "v1.0.0", totalDownloads: 3 });
    expect(status.homebrewStudioCask).toMatchObject({ version: "1.0.0" });
    expect(status.staleReferences.total).toBe(3);
  });

  it("does not recommend publishing an older local package over a newer npm latest", async () => {
    const status = await buildGrowthStatus({
      packageJson: {
        name: "@memi-design/cli",
        version: "1.0.2",
        mcpName: "io.github.sarveshsea/memi",
      },
      now: () => new Date("2026-06-07T00:00:00.000Z"),
      fetchJson: async (url: string) => {
        if (url.includes("registry.npmjs.org")) {
          return { "dist-tags": { latest: "1.1.0" }, versions: { "1.1.0": { mcpName: "io.github.sarveshsea/memi" } } };
        }
        if (url.includes("downloads/point/")) return { downloads: 188, start: "2026-05-27", end: "2026-06-02" };
        if (url.includes("repos/sarveshsea/memi-studio/releases/latest")) {
          return { tag_name: "v1.0.3", published_at: "2026-05-27T19:26:42Z", assets: [] };
        }
        if (url.includes("repos/sarveshsea/memi")) return { stargazers_count: 16, forks_count: 3, open_issues_count: 1, html_url: "https://github.com/sarveshsea/memi", topics: [] };
        if (url.includes("registry.modelcontextprotocol.io")) return { servers: [{ name: "io.github.sarveshsea/memi" }], metadata: { count: 1 } };
        if (url.includes("/pulls/")) return { state: "closed", number: 2, title: "SafeSkill", html_url: url, updated_at: "2026-06-07T00:00:00Z" };
        return {};
      },
      fetchText: async () => `cask "memi-studio" do\n  version "1.0.3"\nend\n`,
      directoryPullRequests: [],
      staleReferenceSources: {},
    });

    expect(status.nextActions).toContain("Sync local package metadata from 1.0.2 to npm latest 1.1.0 before publishing or tagging.");
    expect(status.nextActions).not.toContain("Publish 1.0.2 to npm; npm latest is 1.1.0.");
  });

  it("detects the current wrapped MCP Registry search response shape", async () => {
    const status = await buildGrowthStatus({
      packageJson: {
        name: "@memi-design/cli",
        version: "1.1.0",
        mcpName: "io.github.sarveshsea/memi",
      },
      now: () => new Date("2026-06-07T00:00:00.000Z"),
      fetchJson: async (url: string) => {
        if (url.includes("registry.npmjs.org")) {
          return { "dist-tags": { latest: "1.1.0" }, versions: { "1.1.0": { mcpName: "io.github.sarveshsea/memi" } } };
        }
        if (url.includes("downloads/point/")) return { downloads: 188, start: "2026-05-27", end: "2026-06-02" };
        if (url.includes("repos/sarveshsea/memi-studio/releases/latest")) {
          return { tag_name: "v1.0.3", published_at: "2026-05-27T19:26:42Z", assets: [] };
        }
        if (url.includes("repos/sarveshsea/memi")) return { stargazers_count: 16, forks_count: 3, open_issues_count: 1, html_url: "https://github.com/sarveshsea/memi", topics: [] };
        if (url.includes("registry.modelcontextprotocol.io")) {
          return {
            servers: [
              {
                server: { name: "io.github.sarveshsea/memi", version: "1.1.0" },
                _meta: {
                  "io.modelcontextprotocol.registry/official": {
                    status: "active",
                    isLatest: true,
                  },
                },
              },
            ],
            metadata: { count: 1 },
          };
        }
        if (url.includes("/pulls/")) return { state: "closed", number: 2, title: "SafeSkill", html_url: url, updated_at: "2026-06-07T00:00:00Z" };
        return {};
      },
      fetchText: async () => `cask "memi-studio" do\n  version "1.0.3"\nend\n`,
      directoryPullRequests: [],
      staleReferenceSources: {},
    });

    expect(status.officialMcpRegistry).toMatchObject({
      listed: true,
      count: 1,
      latestVersion: "1.1.0",
    });
    expect(status.nextActions).not.toContain("Publish server.json to the Official MCP Registry after npm is current.");
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
    expect(WEEKLY_NPM_DOWNLOAD_TARGET).toBe(7_830);
    expect(buildWeeklyNpmDownloadGoal({ ok: true, downloads: 0, start: "2026-05-05", end: "2026-05-11" })).toEqual({
      target: 7_830,
      current: 0,
      gap: 7_830,
      achieved: false,
      percentToTarget: 0,
      multipleToTarget: null,
      start: "2026-05-05",
      end: "2026-05-11",
    });
  });
});
