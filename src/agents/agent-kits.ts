import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { packagePath } from "../utils/asset-path.js";

export const AGENT_INSTALL_TARGETS = [
  "universal",
  "hermes",
  "openclaw",
  "claude-code",
  "cursor",
  "codex",
  "codex-plugin",
  "opencode",
] as const;

export type AgentInstallTarget = typeof AGENT_INSTALL_TARGETS[number];
export type AgentInstallTargetInput = AgentInstallTarget | "all";
export type AgentKitKind = "skill" | "mcp-config" | "plugin";

export interface AgentInstallOptions {
  target: AgentInstallTargetInput;
  projectRoot: string;
  homeDir?: string;
  dryRun?: boolean;
  force?: boolean;
  global?: boolean;
}

export interface AgentInstallPlan {
  target: AgentInstallTarget;
  kind: AgentKitKind;
  source: string;
  destination: string;
  marketplaceDestination?: string;
  wouldWrite: boolean;
  exists: boolean;
  overwritten: boolean;
  note: string;
}

export interface AgentSuiteManifestPlan {
  destination: string;
  wouldWrite: boolean;
  exists: boolean;
  overwritten: boolean;
  note: string;
}

export interface AgentInstallResult {
  action: "install";
  status: "planned" | "completed";
  target: AgentInstallTargetInput;
  dryRun: boolean;
  force: boolean;
  suiteManifest: AgentSuiteManifestPlan;
  plans: AgentInstallPlan[];
}

interface AgentKitDefinition {
  target: AgentInstallTarget;
  kind: AgentKitKind;
  source: string;
  sourceBase?: "agent-kits" | "package";
  note: string;
  installSuiteManifest?: boolean;
  destination(input: Required<Pick<AgentInstallOptions, "projectRoot" | "homeDir">> & Pick<AgentInstallOptions, "global">): string;
  marketplaceDestination?(input: Required<Pick<AgentInstallOptions, "projectRoot" | "homeDir">> & Pick<AgentInstallOptions, "global">): string;
}

const DEFAULT_AGENT_INSTALL_TARGETS: readonly AgentInstallTarget[] = AGENT_INSTALL_TARGETS.filter((target) => target !== "codex-plugin");

const MCP_SERVER_CONFIG = {
  command: "memi",
  args: ["mcp", "start", "--no-figma"],
  env: {
    FIGMA_TOKEN: "${FIGMA_TOKEN}",
    FIGMA_FILE_KEY: "${FIGMA_FILE_KEY}",
  },
};

const KIT_DEFINITIONS: AgentKitDefinition[] = [
  {
    target: "universal",
    kind: "skill",
    source: "skills/memoire-design-tooling",
    sourceBase: "package",
    note: "Standard Agent Skills package for agents that read .agents/skills.",
    destination: ({ projectRoot, homeDir, global }) => join(
      global ? homeDir : projectRoot,
      ".agents",
      "skills",
      "memoire-design-tooling",
    ),
  },
  {
    target: "hermes",
    kind: "skill",
    source: "hermes/memoire-design-tooling",
    note: "Hermes slash-command skill for Memoire design tooling.",
    destination: ({ homeDir }) => join(homeDir, ".hermes", "skills", "memoire", "memoire-design-tooling"),
  },
  {
    target: "openclaw",
    kind: "skill",
    source: "openclaw/memoire-design-tooling",
    note: "OpenClaw workspace skill for Memoire design tooling.",
    destination: ({ projectRoot }) => join(projectRoot, "skills", "memoire", "memoire-design-tooling"),
  },
  {
    target: "claude-code",
    kind: "mcp-config",
    source: "mcp/claude-code/mcp.json",
    note: "Claude Code MCP config for the Memoire server.",
    destination: ({ projectRoot, homeDir, global }) => global
      ? join(homeDir, ".claude", "settings.json")
      : join(projectRoot, ".mcp.json"),
  },
  {
    target: "cursor",
    kind: "mcp-config",
    source: "mcp/cursor/mcp.json",
    note: "Cursor MCP config for the Memoire server.",
    destination: ({ projectRoot }) => join(projectRoot, ".cursor", "mcp.json"),
  },
  {
    target: "codex",
    kind: "skill",
    source: "codex/memoire-design-tooling",
    note: "Codex skill that teaches Memoire design tooling workflows.",
    destination: ({ homeDir }) => join(homeDir, ".codex", "skills", "memoire", "memoire-design-tooling"),
  },
  {
    target: "codex-plugin",
    kind: "plugin",
    source: "plugins/memoire",
    sourceBase: "package",
    note: "Codex plugin with Memoire skill and MCP server wiring.",
    installSuiteManifest: false,
    destination: ({ homeDir }) => join(homeDir, "plugins", "memoire"),
    marketplaceDestination: ({ homeDir }) => join(homeDir, ".agents", "plugins", "marketplace.json"),
  },
  {
    target: "opencode",
    kind: "skill",
    source: "opencode/memoire-design-tooling",
    note: "OpenCode workspace skill-style context pack for Memoire design tooling.",
    destination: ({ projectRoot }) => join(projectRoot, ".opencode", "skills", "memoire", "memoire-design-tooling"),
  },
];

export function normalizeAgentInstallTarget(target: string | undefined): AgentInstallTargetInput {
  const normalized = (target ?? "all").trim() || "all";
  if (normalized === "all" || AGENT_INSTALL_TARGETS.includes(normalized as AgentInstallTarget)) {
    return normalized as AgentInstallTargetInput;
  }
  throw new Error(`Invalid agent install target "${target}". Use: ${["all", ...AGENT_INSTALL_TARGETS].join(", ")}`);
}

export async function planAgentInstall(options: AgentInstallOptions): Promise<AgentInstallPlan[]> {
  const target = normalizeAgentInstallTarget(options.target);
  const homeDir = options.homeDir ?? homedir();
  const projectRoot = options.projectRoot;
  const selected = target === "all"
    ? KIT_DEFINITIONS.filter((definition) => DEFAULT_AGENT_INSTALL_TARGETS.includes(definition.target))
    : KIT_DEFINITIONS.filter((definition) => definition.target === target);

  const plans: AgentInstallPlan[] = [];
  for (const definition of selected) {
    const source = definition.sourceBase === "package"
      ? packagePath(definition.source)
      : packagePath("agent-kits", definition.source);
    const destination = definition.destination({ projectRoot, homeDir, global: options.global });
    const exists = await pathExists(destination);
    plans.push({
      target: definition.target,
      kind: definition.kind,
      source,
      destination,
      marketplaceDestination: definition.marketplaceDestination?.({ projectRoot, homeDir, global: options.global }),
      wouldWrite: !exists || Boolean(options.force),
      exists,
      overwritten: exists && Boolean(options.force),
      note: definition.note,
    });
  }
  return plans;
}

export async function installAgentKits(options: AgentInstallOptions): Promise<AgentInstallResult> {
  const target = normalizeAgentInstallTarget(options.target);
  const dryRun = Boolean(options.dryRun);
  const force = Boolean(options.force);
  const plans = await planAgentInstall({ ...options, target });
  const suiteManifest = await planInstallSuiteManifest(target, options.projectRoot, force);

  if (dryRun) {
    return { action: "install", status: "planned", target, dryRun, force, suiteManifest, plans };
  }

  await installSuiteManifest(suiteManifest, options.projectRoot);
  for (const plan of plans) {
    await assertSourceExists(plan);
    switch (plan.kind) {
      case "skill":
        await installSkillDirectory(plan, force);
        break;
      case "mcp-config":
        await installMcpConfig(plan, force);
        break;
      case "plugin":
        await installCodexPlugin(plan, force);
        break;
    }
  }

  return { action: "install", status: "completed", target, dryRun, force, suiteManifest, plans };
}

async function planInstallSuiteManifest(target: AgentInstallTargetInput, projectRoot: string, force: boolean): Promise<AgentSuiteManifestPlan> {
  const selected = target === "all"
    ? KIT_DEFINITIONS.filter((definition) => DEFAULT_AGENT_INSTALL_TARGETS.includes(definition.target))
    : KIT_DEFINITIONS.filter((definition) => definition.target === target);
  const shouldInstall = selected.some((definition) => definition.installSuiteManifest !== false);
  if (shouldInstall) {
    return planSuiteManifest(projectRoot, force);
  }
  const destination = join(projectRoot, "memoire.agent.yaml");
  return {
    destination,
    wouldWrite: false,
    exists: await pathExists(destination),
    overwritten: false,
    note: "Codex plugin installs are home-local and do not require a project suite manifest.",
  };
}

export async function planSuiteManifest(projectRoot: string, force = false): Promise<AgentSuiteManifestPlan> {
  const destination = join(projectRoot, "memoire.agent.yaml");
  const exists = await pathExists(destination);
  return {
    destination,
    wouldWrite: !exists || force,
    exists,
    overwritten: exists && force,
    note: exists && !force
      ? "Existing Memoire suite manifest will be preserved."
      : "Memoire suite manifest for warmed daemon context and product-team recipes.",
  };
}

async function installSuiteManifest(plan: AgentSuiteManifestPlan, projectRoot: string): Promise<void> {
  if (!plan.wouldWrite) return;
  await writeFile(plan.destination, buildSuiteManifest(projectRoot), "utf-8");
}

async function installSkillDirectory(plan: AgentInstallPlan, force: boolean): Promise<void> {
  if (plan.exists && !force) {
    throw new Error(`${plan.target} kit already exists at ${plan.destination}; pass --force to overwrite it.`);
  }
  if (plan.exists && force) {
    await rm(plan.destination, { recursive: true, force: true });
  }
  await mkdir(dirname(plan.destination), { recursive: true });
  await cp(plan.source, plan.destination, { recursive: true, force: true });
}

async function installMcpConfig(plan: AgentInstallPlan, force: boolean): Promise<void> {
  let existing: Record<string, unknown> = {};
  let existingMemoire = false;

  try {
    existing = JSON.parse(await readFile(plan.destination, "utf-8")) as Record<string, unknown>;
    const servers = asRecord(existing.mcpServers);
    existingMemoire = Boolean(servers?.memoire);
  } catch {
    existing = {};
  }

  if (existingMemoire && !force) {
    throw new Error(`${plan.target} MCP config already has a memoire server at ${plan.destination}; pass --force to overwrite it.`);
  }

  const servers = asRecord(existing.mcpServers) ?? {};
  servers.memoire = MCP_SERVER_CONFIG;
  existing.mcpServers = servers;

  await mkdir(dirname(plan.destination), { recursive: true });
  await writeFile(plan.destination, JSON.stringify(existing, null, 2) + "\n", "utf-8");
}

async function installCodexPlugin(plan: AgentInstallPlan, force: boolean): Promise<void> {
  if (!plan.marketplaceDestination) {
    throw new Error("Codex plugin install is missing its marketplace destination.");
  }
  await assertCodexPluginMarketplaceWritable(plan.marketplaceDestination, force);
  if (plan.exists && !force) {
    throw new Error(`${plan.target} plugin already exists at ${plan.destination}; pass --force to overwrite it.`);
  }
  if (plan.exists && force) {
    await rm(plan.destination, { recursive: true, force: true });
  }
  await mkdir(dirname(plan.destination), { recursive: true });
  await cp(plan.source, plan.destination, { recursive: true, force: true });
  await upsertCodexPluginMarketplace(plan.marketplaceDestination, force);
}

async function assertCodexPluginMarketplaceWritable(marketplaceDestination: string, force: boolean): Promise<void> {
  const marketplace = await readPluginMarketplace(marketplaceDestination);
  if (!marketplace) return;
  const plugins = Array.isArray(marketplace.plugins) ? marketplace.plugins : [];
  const hasMemoire = plugins.some((plugin) => asRecord(plugin)?.name === "memoire");
  if (hasMemoire && !force) {
    throw new Error(`Codex plugin marketplace already has a memoire entry at ${marketplaceDestination}; pass --force to overwrite it.`);
  }
}

async function upsertCodexPluginMarketplace(marketplaceDestination: string, force: boolean): Promise<void> {
  const existing = await readPluginMarketplace(marketplaceDestination);
  const marketplace: Record<string, unknown> = existing ?? {};
  marketplace.name = typeof marketplace.name === "string" ? marketplace.name : "memoire-local";
  const iface = asRecord(marketplace.interface) ?? {};
  iface.displayName = typeof iface.displayName === "string" ? iface.displayName : "Memoire Local";
  marketplace.interface = iface;

  const entry = {
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
  };

  const plugins = Array.isArray(marketplace.plugins) ? [...marketplace.plugins] : [];
  const existingIndex = plugins.findIndex((plugin) => asRecord(plugin)?.name === "memoire");
  if (existingIndex >= 0) {
    if (!force) {
      throw new Error(`Codex plugin marketplace already has a memoire entry at ${marketplaceDestination}; pass --force to overwrite it.`);
    }
    plugins[existingIndex] = entry;
  } else {
    plugins.push(entry);
  }
  marketplace.plugins = plugins;

  await mkdir(dirname(marketplaceDestination), { recursive: true });
  await writeFile(marketplaceDestination, JSON.stringify(marketplace, null, 2) + "\n", "utf-8");
}

async function readPluginMarketplace(marketplaceDestination: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(marketplaceDestination, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function assertSourceExists(plan: AgentInstallPlan): Promise<void> {
  try {
    await stat(plan.source);
  } catch {
    throw new Error(`Packaged ${plan.target} agent kit is missing: ${plan.source}`);
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function buildSuiteManifest(projectRoot: string): string {
  const productName = projectRoot.split(/[\\/]/).filter(Boolean).at(-1) ?? "workspace";
  return [
    "schemaVersion: 1",
    "product:",
    `  name: ${productName}`,
    "  suite: memoire-product-team",
    "memory:",
    "  sources:",
    "    - README.md",
    "    - docs",
    "    - specs",
    "    - .memoire",
    "harnesses:",
    "  default: codex",
    "  enabled:",
    "    - codex",
    "    - claude-code",
    "    - hermes",
    "    - opencode",
    "skills:",
    "  - memoire-design-tooling",
    "recipes:",
    "  - id: design-audit",
    "    title: Design Audit",
    "    prompt: \"Audit the UI with Memoire project memory, design tokens, Tailwind/shadcn conventions, accessibility, and product-team handoff notes.\"",
    "    commands:",
    "      - \"memi daemon status --json\"",
    "      - \"memi diagnose --json\"",
    "  - id: tailwind-cleanup",
    "    title: Tailwind + shadcn Cleanup",
    "    prompt: \"Find Tailwind drift, duplicated shadcn primitives, token gaps, and unsafe UI edits before coding.\"",
    "    commands:",
    "      - \"memi daemon status --json\"",
    "      - \"memi shadcn validate\"",
    "      - \"memi fix plan --json\"",
    "  - id: product-handoff",
    "    title: Product Team Handoff",
    "    prompt: \"Create a compact product-team handoff with research evidence, UI decisions, component specs, and follow-up tasks.\"",
    "    commands:",
    "      - \"memi daemon status --json\"",
    "      - \"memi studio run --action handoff --mode brokered --prompt \\\"Create a Memoire product-team handoff\\\"\"",
    "  - id: research-vibe-design",
    "    title: Research Vibe Design",
    "    prompt: \"Turn research and optional simulation output into Atomic Design specs plus Mermaid Jam-ready FigJam source for product design review.\"",
    "    commands:",
    "      - \"memi research synthesize\"",
    "      - \"memi research design --intent \\\"Design a research-backed product decision workspace\\\" --write-specs --mermaid-jam --json\"",
    "      - \"memi mermaid-jam export --from research --json\"",
    "",
  ].join("\n");
}
