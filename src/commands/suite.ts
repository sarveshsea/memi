import type { Command } from "commander";
import type { MemoireEngine } from "../engine/core.js";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { ui } from "../tui/format.js";

interface SuiteRecipe {
  id: string;
  title: string;
  prompt: string;
  commands: string[];
}

interface SuiteDoctorPayload {
  status: "ready" | "missing" | "invalid";
  manifestPath: string;
  checks: Array<{ code: string; status: "pass" | "fail"; detail: string }>;
  recipes: string[];
}

const DEFAULT_RECIPES: SuiteRecipe[] = [
  {
    id: "design-audit",
    title: "Design Audit",
    prompt: "Audit the UI with Memoire project memory, design tokens, Tailwind/shadcn conventions, accessibility, and product-team handoff notes.",
    commands: [
      "memi daemon status --json",
      "memi diagnose --json",
      "memi studio run --action audit --harness codex --mode brokered --prompt \"Audit this UI and produce a design-system fix plan\"",
    ],
  },
  {
    id: "tailwind-cleanup",
    title: "Tailwind + shadcn Cleanup",
    prompt: "Find Tailwind drift, duplicated shadcn primitives, token gaps, and unsafe UI edits before coding.",
    commands: [
      "memi daemon status --json",
      "memi shadcn validate",
      "memi fix plan --json",
    ],
  },
  {
    id: "product-handoff",
    title: "Product Team Handoff",
    prompt: "Create a compact product-team handoff with research evidence, UI decisions, component specs, and follow-up tasks.",
    commands: [
      "memi daemon status --json",
      "memi studio run --action handoff --harness claude-code --mode brokered --prompt \"Create a Memoire product-team handoff\"",
    ],
  },
  {
    id: "research-vibe-design",
    title: "Research Vibe Design",
    prompt: "Turn research and optional simulation output into Atomic Design specs plus Mermaid Jam-ready FigJam source for product design review.",
    commands: [
      "memi research synthesize",
      "memi research design --intent \"Design a research-backed product decision workspace\" --write-specs --mermaid-jam --json",
      "memi mermaid-jam export --from research --json",
      "memi studio run --action simulate --harness codex --mode brokered --prompt \"Generate a research-backed Scenario Lab FigJam handoff\"",
    ],
  },
];

export function registerSuiteCommand(program: Command, engine: MemoireEngine): void {
  const suite = program
    .command("suite")
    .description("Manage Memoire product-team suite manifests and recipes");

  suite
    .command("init")
    .description("Create memoire.agent.yaml for native agent workflows")
    .option("--project <path>", "Project/workspace root")
    .option("--force", "Overwrite an existing suite manifest")
    .option("--json", "Output manifest metadata as JSON")
    .action(async (opts: { project?: string; force?: boolean; json?: boolean }) => {
      const projectRoot = resolveProjectRoot(engine, opts.project);
      const manifestPath = suiteManifestPath(projectRoot);
      const exists = await pathExists(manifestPath);
      if (exists && !opts.force) {
        const payload = { action: "init", status: "exists", manifestPath };
        if (opts.json) console.log(JSON.stringify(payload, null, 2));
        else console.log(ui.warn(`Suite manifest already exists at ${manifestPath}; pass --force to overwrite.`));
        return;
      }
      await mkdir(dirname(manifestPath), { recursive: true });
      await writeFile(manifestPath, defaultManifest(projectRoot), "utf-8");
      const payload = {
        action: "init",
        status: exists ? "overwritten" : "created",
        manifestPath,
        recipes: DEFAULT_RECIPES.map((recipe) => recipe.id),
      };
      if (opts.json) console.log(JSON.stringify(payload, null, 2));
      else {
        console.log(ui.ok(`Suite manifest written to ${manifestPath}`));
        console.log(ui.dots("Recipes", payload.recipes.join(", ")));
      }
    });

  suite
    .command("doctor")
    .description("Validate memoire.agent.yaml and show suite readiness")
    .option("--project <path>", "Project/workspace root")
    .option("--json", "Output suite doctor as JSON")
    .action(async (opts: { project?: string; json?: boolean }) => {
      const payload = await suiteDoctor(resolveProjectRoot(engine, opts.project));
      if (opts.json) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }
      console.log(ui.section("MEMOIRE SUITE"));
      for (const check of payload.checks) {
        console.log(ui.dots(check.code, check.status === "pass" ? ui.green(check.detail) : ui.red(check.detail)));
      }
      console.log(ui.dots("Recipes", payload.recipes.join(", ") || "none"));
    });

  suite
    .command("run <recipe>")
    .description("Print the recipe prompt and commands for an agent-native product-team workflow")
    .option("--project <path>", "Project/workspace root")
    .option("--json", "Output recipe payload as JSON")
    .action(async (recipeId: string, opts: { project?: string; json?: boolean }) => {
      const projectRoot = resolveProjectRoot(engine, opts.project);
      const doctor = await suiteDoctor(projectRoot);
      if (doctor.status === "missing") {
        throw new Error(`Suite manifest missing at ${doctor.manifestPath}. Run: memi suite init --project ${projectRoot}`);
      }
      const recipe = DEFAULT_RECIPES.find((candidate) => candidate.id === recipeId)
        ?? parseRecipe(await readFile(doctor.manifestPath, "utf-8"), recipeId);
      if (!recipe) {
        throw new Error(`Unknown suite recipe "${recipeId}". Available: ${doctor.recipes.join(", ")}`);
      }
      const payload = {
        action: "run",
        status: "ready",
        projectRoot,
        manifestPath: doctor.manifestPath,
        recipe,
      };
      if (opts.json) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }
      console.log(ui.section(recipe.title));
      console.log(recipe.prompt);
      console.log();
      for (const command of recipe.commands) console.log(`  ${command}`);
    });
}

async function suiteDoctor(projectRoot: string): Promise<SuiteDoctorPayload> {
  const manifestPath = suiteManifestPath(projectRoot);
  const checks: SuiteDoctorPayload["checks"] = [];
  let content = "";
  try {
    content = await readFile(manifestPath, "utf-8");
    checks.push({ code: "manifest.exists", status: "pass", detail: "found" });
  } catch {
    return {
      status: "missing",
      manifestPath,
      checks: [{ code: "manifest.exists", status: "fail", detail: "missing" }],
      recipes: [],
    };
  }

  const required = ["schemaVersion:", "product:", "memory:", "harnesses:", "skills:", "recipes:"];
  for (const token of required) {
    checks.push({
      code: `manifest.${token.replace(":", "")}`,
      status: content.includes(token) ? "pass" : "fail",
      detail: content.includes(token) ? "present" : "missing",
    });
  }
  const recipes = parseRecipeIds(content);
  checks.push({
    code: "recipes.count",
    status: recipes.length > 0 ? "pass" : "fail",
    detail: `${recipes.length}`,
  });
  return {
    status: checks.every((check) => check.status === "pass") ? "ready" : "invalid",
    manifestPath,
    checks,
    recipes,
  };
}

function defaultManifest(projectRoot: string): string {
  const productName = basename(projectRoot) || "workspace";
  const recipeYaml = DEFAULT_RECIPES.map((recipe) => [
    `  - id: ${recipe.id}`,
    `    title: ${recipe.title}`,
    `    prompt: ${quoteYaml(recipe.prompt)}`,
    "    commands:",
    ...recipe.commands.map((command) => `      - ${quoteYaml(command)}`),
  ].join("\n")).join("\n");
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
    recipeYaml,
    "",
  ].join("\n");
}

function parseRecipeIds(content: string): string[] {
  return Array.from(content.matchAll(/^\s*-\s+id:\s*([a-z0-9-]+)/gm)).map((match) => match[1]);
}

function parseRecipe(content: string, recipeId: string): SuiteRecipe | null {
  const recipeStart = content.match(new RegExp(`^\\s*-\\s+id:\\s*${escapeRegex(recipeId)}\\s*$`, "m"));
  if (!recipeStart || typeof recipeStart.index !== "number") return null;
  const rest = content.slice(recipeStart.index);
  const next = rest.slice(1).search(/^\s*-\s+id:/m);
  const block = next >= 0 ? rest.slice(0, next + 1) : rest;
  const title = block.match(/^\s*title:\s*(.+)$/m)?.[1]?.trim() ?? recipeId;
  const prompt = unquoteYaml(block.match(/^\s*prompt:\s*(.+)$/m)?.[1]?.trim() ?? "");
  const commands = Array.from(block.matchAll(/^\s*-\s+["']?(.+?)["']?\s*$/gm))
    .map((match) => unquoteYaml(match[1].trim()))
    .filter((command) => command !== recipeId && !command.startsWith("id:"));
  return { id: recipeId, title, prompt, commands };
}

function suiteManifestPath(projectRoot: string): string {
  return join(projectRoot, "memoire.agent.yaml");
}

function resolveProjectRoot(engine: MemoireEngine, project?: string): string {
  return resolve(project ?? engine.config.projectRoot);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function quoteYaml(value: string): string {
  return JSON.stringify(value);
}

function unquoteYaml(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
