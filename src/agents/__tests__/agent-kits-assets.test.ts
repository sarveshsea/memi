import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

interface AgentKitManifest {
  version: number;
  mirrorRepository: string;
  suiteManifest: string;
  daemon: {
    start: string;
    status: string;
  };
  targets: Array<{
    id: string;
    kind: string;
    source: string;
    defaultDestination: string;
  }>;
}

interface CodexPluginManifest {
  name: string;
  version: string;
  description: string;
  homepage: string;
  privacyPolicyURL: string;
  termsOfServiceURL: string;
  skills: string;
  mcpServers: string;
  interface: {
    displayName: string;
    defaultPrompt: string[];
    privacyPolicyURL: string;
    termsOfServiceURL: string;
    composerIcon: string;
    logo: string;
    screenshots: string[];
  };
}

interface PluginMarketplace {
  name: string;
  interface: {
    displayName: string;
  };
  plugins: Array<{
    name: string;
    source: {
      source: string;
      path: string;
    };
    policy: {
      installation: string;
      authentication: string;
    };
    category: string;
  }>;
}

describe("packaged agent kits", () => {
  it("declares every external agent kit with existing source files", async () => {
    const root = process.cwd();
    const manifest = JSON.parse(
      await readFile(join(root, "agent-kits", "manifest.json"), "utf-8"),
    ) as AgentKitManifest;

    expect(manifest.mirrorRepository).toBe("sarveshsea/memoire-agent-skills");
    expect(manifest.suiteManifest).toBe("memoire.agent.yaml");
    expect(manifest.daemon.status).toBe("memi daemon status --json");
    expect(manifest.targets.map((target) => target.id)).toEqual([
      "hermes",
      "openclaw",
      "claude-code",
      "cursor",
      "codex",
      "opencode",
    ]);

    for (const target of manifest.targets) {
      const sourcePath = join(root, "agent-kits", target.source);
      const sourceStat = await stat(sourcePath);
      expect(sourceStat.isFile() || sourceStat.isDirectory()).toBe(true);
    }
  });

  it("ships valid SKILL.md frontmatter for Hermes and OpenClaw", async () => {
    const root = process.cwd();
    const hermesSkill = await readFile(join(root, "agent-kits", "hermes", "memoire-design-tooling", "SKILL.md"), "utf-8");
    const openClawSkill = await readFile(join(root, "agent-kits", "openclaw", "memoire-design-tooling", "SKILL.md"), "utf-8");

    for (const skill of [hermesSkill, openClawSkill]) {
      expect(skill).toMatch(/^---\n/);
      expect(skill).toContain("name: memoire-design-tooling");
      expect(skill).toContain("description: Use when");
      expect(skill).toMatch(/\n---\n\n# memi Design Tooling/);
      expect(skill).toContain("npm i -g @memi-design/cli");
      expect(skill).toContain("memoire.agent.yaml");
      expect(skill).toContain("memi daemon status --json");
      expect(skill).toContain("memi mcp start --no-figma");
      expect(skill).toContain("memi");
    }
    expect(openClawSkill).toContain("metadata:");
    expect(openClawSkill).toContain("\"openclaw\"");
  });

  it("includes agent-kits in the npm package allowlist", async () => {
    const pkg = JSON.parse(await readFile(join(process.cwd(), "package.json"), "utf-8"));
    expect(pkg.files).toContain("agent-kits");
    expect(pkg.files).toContain("plugins");
  });

  it("ships registry-safe MCP config templates", async () => {
    const root = process.cwd();
    const claude = JSON.parse(await readFile(join(root, "agent-kits", "mcp", "claude-code", "mcp.json"), "utf-8"));
    const cursor = JSON.parse(await readFile(join(root, "agent-kits", "mcp", "cursor", "mcp.json"), "utf-8"));
    expect(claude.mcpServers.memoire.args).toEqual(["mcp", "start", "--no-figma"]);
    expect(cursor.mcpServers.memoire.args).toEqual(["mcp", "start", "--no-figma"]);
  });

  it("ships a Codex plugin manifest, MCP config, and synced skill", async () => {
    const root = process.cwd();
    const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf-8"));
    const manifest = JSON.parse(
      await readFile(join(root, "plugins", "memoire", ".codex-plugin", "plugin.json"), "utf-8"),
    ) as CodexPluginManifest;
    const mcpConfig = JSON.parse(await readFile(join(root, "plugins", "memoire", ".mcp.json"), "utf-8"));
    const pluginSkill = await readFile(join(root, "plugins", "memoire", "skills", "memoire-design-tooling", "SKILL.md"), "utf-8");
    const codexSkill = await readFile(join(root, "agent-kits", "codex", "memoire-design-tooling", "SKILL.md"), "utf-8");

    expect(manifest).toMatchObject({
      name: "memoire",
      version: pkg.version,
      homepage: "https://www.memoire.cv/codex-plugin",
      privacyPolicyURL: "https://www.memoire.cv/privacy",
      termsOfServiceURL: "https://www.memoire.cv/terms",
      skills: "./skills/",
      mcpServers: "./.mcp.json",
      interface: {
        displayName: "memi",
        privacyPolicyURL: "https://www.memoire.cv/privacy",
        termsOfServiceURL: "https://www.memoire.cv/terms",
        composerIcon: "./assets/authentic-logo.png",
        logo: "./assets/authentic-logo.png",
      },
    });
    expect(manifest.description).toContain("memi design memory");
    expect(manifest.interface.defaultPrompt.length).toBeLessThanOrEqual(3);
    expect(manifest.interface.defaultPrompt).toContain("Audit this UI with memi before editing.");
    expect(manifest.interface.screenshots).toEqual(["./assets/screenshot-plugin-overview.png"]);
    for (const relativePath of [manifest.interface.logo, manifest.interface.composerIcon, ...manifest.interface.screenshots]) {
      const buffer = await readFile(join(root, "plugins", "memoire", relativePath.replace(/^\.\//, "")));
      expect(isPng(buffer)).toBe(true);
      expect(buffer.byteLength).toBeGreaterThan(1000);
    }
    expect(mcpConfig.mcpServers.memoire).toMatchObject({
      command: "memi",
      args: ["mcp", "start", "--no-figma"],
      env: {
        FIGMA_TOKEN: "${FIGMA_TOKEN}",
        FIGMA_FILE_KEY: "${FIGMA_FILE_KEY}",
      },
    });
    expect(pluginSkill).toBe(codexSkill);
  });

  it("documents public Git-backed Codex marketplace installation", async () => {
    const root = process.cwd();
    const readme = await readFile(join(root, "README.md"), "utf-8");
    const codexPage = await readFile(join(root, "docs", "CODEX_PLUGIN.md"), "utf-8");
    const smokeScript = await readFile(join(root, "scripts", "smoke-codex-plugin-marketplace.mjs"), "utf-8");
    const installCommand = "codex plugin marketplace add sarveshsea/memi --ref main --sparse .agents/plugins --sparse plugins/memoire";

    expect(readme).toContain(installCommand);
    expect(codexPage).toContain(installCommand);
    expect(codexPage).toContain("https://www.memoire.cv/codex-plugin");
    expect(smokeScript).toContain(installCommand);
  });

  it("declares the repo-local Codex plugin marketplace entry", async () => {
    const root = process.cwd();
    const marketplace = JSON.parse(
      await readFile(join(root, ".agents", "plugins", "marketplace.json"), "utf-8"),
    ) as PluginMarketplace;
    const entry = marketplace.plugins.find((plugin) => plugin.name === "memoire");

    expect(marketplace).toMatchObject({
      name: "memoire-local",
      interface: {
        displayName: "Memoire Local",
      },
    });
    expect(entry).toEqual({
      name: "memoire",
      source: {
        source: "local",
        path: "./plugins/memoire",
      },
      policy: {
        installation: "AVAILABLE",
        authentication: "ON_INSTALL",
      },
      category: "Productivity",
    });
  });

  it("includes agent kit files in npm pack dry-run output", () => {
    const npmCache = mkdtempSync(join(tmpdir(), "memoire-npm-cache-"));
    const pack = spawnSync("npm", ["pack", "--dry-run", "--json"], {
      cwd: process.cwd(),
      encoding: "utf-8",
      env: {
        ...process.env,
        npm_config_cache: npmCache,
        npm_config_update_notifier: "false",
      },
      maxBuffer: 8 * 1024 * 1024,
    });
    try {
      expect(pack.status, pack.stderr || pack.stdout).toBe(0);
    } finally {
      rmSync(npmCache, { recursive: true, force: true });
    }

    const [packageInfo] = JSON.parse(pack.stdout) as Array<{
      files: Array<{ path: string }>;
    }>;
    const paths = new Set(packageInfo.files.map((file) => file.path));
    expect(paths).toContain("agent-kits/manifest.json");
    expect(paths).toContain("agent-kits/hermes/memoire-design-tooling/SKILL.md");
    expect(paths).toContain("agent-kits/openclaw/memoire-design-tooling/SKILL.md");
    expect(paths).toContain("agent-kits/mirror/README.md");
    expect(paths).toContain("plugins/memoire/.codex-plugin/plugin.json");
    expect(paths).toContain("plugins/memoire/.mcp.json");
    expect(paths).toContain("plugins/memoire/skills/memoire-design-tooling/SKILL.md");
    expect(paths).toContain("plugins/memoire/assets/authentic-logo.png");
    expect(paths).toContain("plugins/memoire/assets/screenshot-plugin-overview.png");
  });
});

function isPng(buffer: Buffer): boolean {
  return buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a;
}
