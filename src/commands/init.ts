import type { Command } from "commander";
import type { MemoireEngine } from "../engine/core.js";
import type { ComponentSpec, DataVizSpec, PageSpec } from "../specs/types.js";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, resolve as resolvePath } from "path";
import ora from "ora";
import { ui } from "../tui/format.js";
import { publishRegistry } from "../registry/publisher.js";
import { getMemoirePackageVersion } from "../utils/package-version.js";

interface InitOptions {
  dir?: string;
  team?: boolean;
  kit?: string;
  maxFiles?: string;
  json?: boolean;
}

export function registerInitCommand(program: Command, engine: MemoireEngine) {
  program
    .command("init [name]")
    .description("Scaffold a design system registry package (or initialize a Memoire project)")
    .option("--dir <path>", "Output directory (defaults to ./<name>)")
    .option("--team", "Team setup: commit policy + baseline, gitignore rules, and an agent kit — the repeatable design gate")
    .option("--kit <target>", "Agent kit to install with --team (universal, claude-code, cursor, …; 'none' skips)", "universal")
    .option("--max-files <count>", "Maximum source files to scan with --team", "500")
    .option("--json", "Output --team setup results as JSON")
    .action(async (name: string | undefined, opts: InitOptions) => {
      // Team setup mode — `memi init --team`
      if (opts.team) {
        await initTeam(engine, opts);
        return;
      }
      // Registry scaffold mode — `memi init <name>`
      if (name) {
        await scaffoldRegistry(engine, name, opts.dir);
        return;
      }
      // Legacy project init — `memi init` (no args)
      const root = engine.config.projectRoot;

      // ── Brand ───────────────────────────────────────
      console.log(ui.brand("Registry-First Design System Workflow"));

      // ── Detect ──────────────────────────────────────
      const detect = ora({ text: "Detecting project...", indent: 2, color: "cyan" }).start();
      await engine.init();
      const project = engine.project;

      const parts: string[] = [];
      if (project?.framework) parts.push(project.framework);
      if (project?.language) parts.push(project.language);
      if (project?.styling.tailwind) parts.push("tailwind");
      if (project?.shadcn.installed) parts.push(`shadcn (${project.shadcn.components.length})`);

      detect.stop();
      console.log(ui.dots("DETECT", parts.length > 0 ? parts.join(" + ") : "no framework detected"));

      // ── Keys guide ──────────────────────────────────
      console.log(ui.section("KEYS"));
      console.log();
      console.log(ui.dots("FIGMA_TOKEN", "required for sync"));
      console.log(ui.instructions([
        '1. Open Figma > Settings > Account',
        '2. Scroll to "Personal Access Tokens"',
        '3. Generate new token named "Memoire"',
        '4. export FIGMA_TOKEN="figd_xxxxx"',
      ]));
      console.log();
      console.log(ui.dots("FIGMA_FILE_KEY", "optional default"));
      console.log("  From URL: figma.com/design/[THIS_PART]/...");
      console.log('  export FIGMA_FILE_KEY="abc123def456"');

      // ── Structure ───────────────────────────────────
      console.log(ui.section("STRUCTURE"));

      const dirGroups: [string, string[]][] = [
        ["specs/", ["components", "pages", "dataviz", "design", "ia"]],
        ["research/", ["reports"]],
        ["generated/", ["components", "pages", "dataviz"]],
        ["prototype/", []],
        [".memoire/", ["notes"]],
      ];

      for (const [parent, children] of dirGroups) {
        const fullChildren = children.map((c) => parent + c);
        const allPaths = [parent, ...fullChildren];
        for (const dir of allPaths) {
          await mkdir(join(root, dir), { recursive: true });
        }
        const desc = children.length > 0 ? ui.dim("  " + children.join(", ")) : "";
        console.log(ui.ok(parent + desc));
      }

      // ── Starter specs ───────────────────────────────
      console.log(ui.section("SPECS"));
      const createdSpecs: string[] = [];

      const metricCard: ComponentSpec = {
        name: "MetricCard",
        type: "component",
        level: "molecule",
        composesSpecs: [],
        codeConnect: { props: {}, mapped: false },
        purpose: "Display a single KPI metric with title, value, and optional trend indicator",
        researchBacking: [],
        designTokens: { source: "none", mapped: false },
        variants: ["default", "compact", "highlighted"],
        props: {
          title: "string",
          value: "string",
          change: "string?",
          trend: "up | down | flat",
        },
        shadcnBase: ["Card", "Badge"],
        accessibility: { role: "article", ariaLabel: "required", keyboardNav: false, focusStyle: "outline", focusWidth: "2px", touchTarget: "default", reducedMotion: false, liveRegion: "off", colorIndependent: true },
        dataviz: null,
        tags: ["dashboard", "kpi"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (await engine.registry.getSpec(metricCard.name)) {
        console.log(ui.skip("MetricCard" + ui.dim("  already exists")));
      } else {
        await engine.registry.saveSpec(metricCard);
        createdSpecs.push(metricCard.name);
        console.log(ui.ok("MetricCard" + ui.dim("  component")));
      }

      const activityChart: DataVizSpec = {
        name: "ActivityChart",
        type: "dataviz",
        purpose: "Show daily activity trend over the last 30 days",
        chartType: "area",
        library: "recharts",
        dataShape: { x: "date", y: "value", series: ["users", "sessions"] },
        interactions: ["hover-tooltip", "brush"],
        accessibility: { altText: "required", keyboardNav: true, dataTableFallback: true, patternFill: false, announceUpdates: false, highContrastMode: false },
        responsive: {
          mobile: { height: 200, simplify: true },
          desktop: { height: 400 },
        },
        shadcnWrapper: "Card",
        sampleData: [
          { date: "Mon", users: 120, sessions: 340 },
          { date: "Tue", users: 150, sessions: 420 },
          { date: "Wed", users: 180, sessions: 510 },
          { date: "Thu", users: 140, sessions: 380 },
          { date: "Fri", users: 200, sessions: 580 },
          { date: "Sat", users: 90, sessions: 210 },
          { date: "Sun", users: 70, sessions: 160 },
        ],
        tags: ["dashboard", "analytics"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (await engine.registry.getSpec(activityChart.name)) {
        console.log(ui.skip("ActivityChart" + ui.dim("  already exists")));
      } else {
        await engine.registry.saveSpec(activityChart);
        createdSpecs.push(activityChart.name);
        console.log(ui.ok("ActivityChart" + ui.dim("  dataviz")));
      }

      const dashboard: PageSpec = {
        name: "Dashboard",
        type: "page",
        purpose: "Main application dashboard showing KPIs and activity trends",
        researchBacking: [],
        layout: "dashboard",
        sections: [
          { name: "metrics-row", component: "MetricCard", repeat: 4, layout: "grid-4", props: {} },
          { name: "activity-chart", component: "ActivityChart", repeat: 1, layout: "full-width", props: {} },
        ],
        shadcnLayout: ["SidebarProvider", "SidebarInset"],
        responsive: { mobile: "stack", tablet: "grid-2", desktop: "grid-4" },
        accessibility: { language: "en", landmarks: true, skipLink: true, headingHierarchy: true, consistentNav: true, consistentHelp: true },
        meta: { title: "Dashboard", description: "Overview of key metrics" },
        tags: ["dashboard"],
        layoutLocked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (await engine.registry.getSpec(dashboard.name)) {
        console.log(ui.skip("Dashboard" + ui.dim("  already exists")));
      } else {
        await engine.registry.saveSpec(dashboard);
        createdSpecs.push(dashboard.name);
        console.log(ui.ok("Dashboard" + ui.dim("  page")));
      }

      // ── Codegen ─────────────────────────────────────
      console.log(ui.section("CODEGEN"));

      if (createdSpecs.length === 0) {
        console.log(ui.skip("Starter specs already present"));
      } else {
        for (const specName of createdSpecs) {
          const gen = ora({ text: specName, indent: 2, color: "cyan" }).start();
          try {
            const result = await engine.generateFromSpec(specName);
            gen.stop();
            if (result.blocked) {
              console.log(ui.warn(specName + ui.dim("  blocked by quality gate")));
            } else {
              console.log(ui.ok(specName));
            }
          } catch (err) {
            gen.stop();
            const msg = err instanceof Error ? err.message : String(err);
            console.log(ui.warn(specName + ui.dim("  " + msg)));
          }
        }
      }

      // ── CLAUDE.md — tells Claude to use Memoire tools ──
      const claudeMdPath = join(root, "CLAUDE.md");
      if (!existsSync(claudeMdPath)) {
        await writeFile(claudeMdPath, [
          "# Memoire",
          "",
          "This project uses [Memoire](https://memoire.cv) for design system management.",
          "",
          "## MCP tools available",
          "",
          "The `memoire` MCP server is configured in `.mcp.json`. Use these tools for any design-related tasks:",
          "",
          "| Tool | Use for |",
          "|------|---------|",
          "| `mcp__memoire__pull_design_system` | Sync tokens, components, styles from Figma |",
          "| `mcp__memoire__get_specs` | List all component/page/dataviz specs |",
          "| `mcp__memoire__create_spec` | Create a new component spec |",
          "| `mcp__memoire__generate_code` | Generate React + Tailwind code from a spec |",
          "| `mcp__memoire__get_tokens` | Read design tokens |",
          "| `mcp__memoire__compose` | Execute a design task with natural language |",
          "| `mcp__memoire__design_doc` | Extract design system from any URL |",
          "| `mcp__memoire__analyze_design` | AI vision analysis of a Figma screenshot |",
          "",
          "## Workflow",
          "",
          "1. Run `memi pull` or `mcp__memoire__pull_design_system` to sync the latest design system from Figma",
          "2. Use `mcp__memoire__create_spec` to spec a component before generating code",
          "3. Use `mcp__memoire__generate_code` to produce production-ready shadcn/ui components",
          "4. Generated components land in `generated/` — export to your source tree with `memi export`",
          "",
          "## Specs",
          "",
          "All component specs live in `specs/`. Every generated component has a corresponding JSON spec.",
          "Run `memi validate` to check all specs against their schemas.",
          "",
          "## Stack",
          "",
          "- Components: shadcn/ui exclusively",
          "- Styling: Tailwind exclusively",
          "- Architecture: Atomic Design (atom → molecule → organism → template → page)",
          "",
        ].join("\n"));
        console.log(ui.ok("CLAUDE.md" + ui.dim("  AI session context written")));
      } else {
        console.log(ui.skip("CLAUDE.md" + ui.dim("  already exists")));
      }

      // ── .mcp.json — MCP server config ───────────────
      const mcpJsonPath = join(root, ".mcp.json");
      if (!existsSync(mcpJsonPath)) {
        await writeFile(mcpJsonPath, JSON.stringify({
          mcpServers: {
            memoire: {
              command: "memi",
              args: ["mcp", "start", "--no-figma"],
              env: {
                FIGMA_TOKEN: "${FIGMA_TOKEN}",
                FIGMA_FILE_KEY: "${FIGMA_FILE_KEY}",
              },
            },
          },
        }, null, 2) + "\n");
        console.log(ui.ok(".mcp.json" + ui.dim("  MCP server configured")));
      } else {
        console.log(ui.skip(".mcp.json" + ui.dim("  already exists")));
      }

      // ── Onboarding marker ───────────────────────────
      await writeFile(
        join(root, ".memoire", "onboarded.json"),
        JSON.stringify({ completedAt: new Date().toISOString(), version: "0.1.0" })
      );

      // ── Ready ───────────────────────────────────────
      console.log();
      console.log(ui.rule());
      console.log();
      console.log(ui.ready("READY"));
      console.log("  " + createdSpecs.length + " specs created" + ui.dim(" · ") + "shadcn components generated");
      console.log("  Research directory ready for data");

      // Plugin info
      const home = process.env.HOME || process.env.USERPROFILE || "";
      const homePlugin = join(home, ".memoire", "plugin", "manifest.json");
      const localPlugin = join(root, "plugin", "manifest.json");
      const pluginPath = existsSync(homePlugin) ? homePlugin : localPlugin;

      console.log();
      console.log(ui.dots("Plugin", pluginPath));
      console.log("  Import in Figma: Plugins > Development > Import from manifest");

      // Next steps
      console.log(ui.section("NEXT"));
      console.log(ui.guide("memi connect", "guided Figma setup"));
      console.log(ui.guide("memi pull", "sync design system"));
      console.log(ui.guide("memi ia extract app", "extract page tree"));
      console.log(ui.guide("memi dashboard", "launch dashboard"));
      console.log(ui.guide("memi spec component Name", "create a spec"));
      console.log(ui.guide("memi generate", "generate code"));
      console.log();
      console.log("  " + ui.dim("memi status") + "    " + ui.dim("check progress"));
      console.log("  " + ui.dim("memi --help") + "    " + ui.dim("all commands"));
      console.log();
    });
}

// ── Registry scaffolder ────────────────────────────────────────

async function scaffoldRegistry(engine: MemoireEngine, name: string, dirOpt?: string): Promise<void> {
  const validName = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name);
  if (!validName) {
    console.error(`\n  Invalid name "${name}". Use npm-style: "@scope/name" or "name"\n`);
    process.exitCode = 1;
    return;
  }

  const baseName = name.replace(/^@[^/]+\//, "");
  const outDir = dirOpt ? resolvePath(dirOpt) : resolvePath(engine.config.projectRoot, baseName);

  await engine.init();

  console.log();
  console.log(ui.brand("REGISTRY SCAFFOLD"));
  console.log(ui.dots("Name", name));
  console.log(ui.dots("Output", outDir));
  console.log();

  const spinner = ora({ text: "Building registry package...", indent: 2, color: "cyan" }).start();

  const pkgVersion = getMemoirePackageVersion();

  const result = await publishRegistry({
    name,
    version: "0.1.0",
    description: `Design system registry`,
    outDir,
    designSystem: engine.registry.designSystem,
    specs: (await engine.registry.getAllSpecs()).filter(s => s.type === "component") as ComponentSpec[],
    memoireVersion: pkgVersion,
  });

  spinner.stop();

  console.log(ui.ok(`${result.filesWritten.length} files written`));
  console.log();
  console.log(ui.dim("  Next:"));
  console.log(`    cd ${baseName}`);
  console.log("    npm publish --access public");
  console.log();
  console.log(ui.dim("  Or add components from another source first:"));
  console.log(`    memi publish --figma <url> --name ${name} --dir ${outDir}`);
  console.log();
}

// ── Team setup ─────────────────────────────────────────────────
//
// One command from "designer chaos" to a repeatable gate: commit a policy,
// accept the honest baseline (loudly), fix .gitignore so the baseline is
// shared while workspace state stays local, and install an agent kit.
// Re-running on a repo a teammate already set up is safe: existing policy
// and baseline are preserved and reported, never overwritten.

async function initTeam(engine: MemoireEngine, opts: InitOptions): Promise<void> {
  const { loadPolicy, POLICY_FILE_NAME } = await import("../app-quality/policy.js");
  const { diagnoseAppQuality } = await import("../app-quality/engine.js");
  const { buildBaseline, filterWithBaseline, readBaseline, writeBaseline } = await import("../app-quality/baseline.js");
  const { ensureGitignorePolicy } = await import("../utils/gitignore-policy.js");

  const json = opts.json === true;
  const log = (line: string) => { if (!json) console.log(line); };
  const result: Record<string, unknown> = { status: "completed" };

  try {
    const root = engine.config.projectRoot;
    log(ui.brand("Team Design Gate Setup"));

    // 1. Policy — write the recommended preset unless the team already has one.
    const policyPath = join(root, POLICY_FILE_NAME);
    const policyExisted = existsSync(policyPath);
    if (!policyExisted) {
      await writeFile(policyPath, `${JSON.stringify({ schemaVersion: 1, preset: "memi-recommended" }, null, 2)}\n`, "utf-8");
    }
    const policy = await loadPolicy(root);
    result.policy = { path: policyPath, created: !policyExisted, preset: policy.preset, hash: policy.policyHash };
    log(policyExisted
      ? ui.skip(POLICY_FILE_NAME + ui.dim(`  already committed (${policy.preset}, ${policy.policyHash})`))
      : ui.ok(POLICY_FILE_NAME + ui.dim(`  created (preset ${policy.preset}, hash ${policy.policyHash})`)));

    // 2. First scan → baseline. Loud about how much debt gets accepted.
    const maxFiles = Number.parseInt(opts.maxFiles ?? "500", 10);
    const diagnosis = await diagnoseAppQuality({
      projectRoot: root,
      maxFiles: Number.isFinite(maxFiles) ? maxFiles : 500,
      write: true,
      policy,
    });
    log(ui.dots("Score", `${diagnosis.summary.score}/100 (${diagnosis.summary.verdict})`));

    const existingBaseline = await readBaseline(root);
    if (!existingBaseline) {
      const file = buildBaseline(diagnosis.issues, { policyHash: policy.policyHash, note: "accepted by memi init --team" });
      const baselinePath = await writeBaseline(root, file);
      result.baseline = { path: baselinePath, created: true, acceptedFindings: diagnosis.issues.length, acceptedFingerprints: file.entries.length };
      if (diagnosis.issues.length > 0) {
        log(ui.warn(`Accepted existing debt: ${diagnosis.issues.length} finding(s) → ${file.entries.length} fingerprint(s)`));
        log(ui.dim("  From here, gates only fail on NEW findings. Burn this debt down over time."));
      } else {
        log(ui.ok("Baseline created" + ui.dim("  no existing debt — clean start")));
      }
    } else {
      // Teammate #2: the baseline is shared state — report it, don't re-accept.
      const filtered = filterWithBaseline(diagnosis.issues, existingBaseline);
      result.baseline = { created: false, suppressed: filtered.suppressed.length, active: filtered.active.length, policyHashMatches: existingBaseline.policyHash === policy.policyHash };
      log(ui.skip(".memoire/baseline.json" + ui.dim(`  already committed — ${filtered.suppressed.length} accepted, ${filtered.active.length} new active`)));
      if (existingBaseline.policyHash !== policy.policyHash) {
        log(ui.warn(`Baseline was accepted under a different policy (${existingBaseline.policyHash ?? "unknown"} vs ${policy.policyHash}) — re-run \`memi baseline accept\` after aligning the policy`));
      }
    }

    // 3. .gitignore — baseline is shared, the rest of .memoire/ stays local.
    const gitignore = await ensureGitignorePolicy(root);
    result.gitignore = gitignore;
    log(gitignore.action === "unchanged"
      ? ui.skip(".gitignore" + ui.dim("  managed block already present"))
      : ui.ok(".gitignore" + ui.dim(`  managed block ${gitignore.action} (.memoire/* local, baseline.json shared)`)));
    if (gitignore.conflictingLine) {
      log(ui.warn(`.gitignore has a "${gitignore.conflictingLine}" line outside the managed block — remove it, or git will keep ignoring the baseline`));
    }

    // 4. Agent kit — so every teammate's coding agent gets the same tooling.
    const kit = (opts.kit ?? "universal").toLowerCase();
    if (kit === "none") {
      result.kit = { target: "none", installed: false };
      log(ui.skip("agent kit" + ui.dim("  skipped (--kit none)")));
    } else {
      const { installAgentKits, normalizeAgentInstallTarget } = await import("../agents/agent-kits.js");
      try {
        const install = await installAgentKits({ target: normalizeAgentInstallTarget(kit), projectRoot: root });
        result.kit = { target: kit, installed: true, files: install.plans.map((plan) => plan.destination) };
        log(ui.ok(`agent kit (${kit})` + ui.dim(`  ${install.plans.length} artifact(s) installed`)));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/already exists/i.test(message)) {
          result.kit = { target: kit, installed: false, reason: "already installed" };
          log(ui.skip(`agent kit (${kit})` + ui.dim("  already installed")));
        } else {
          throw err;
        }
      }
    }

    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    log(ui.section("NEXT"));
    log(ui.guide(`git add ${POLICY_FILE_NAME} .memoire/baseline.json .gitignore`, "commit the shared gate"));
    log(ui.guide("memi ci", "run the gate locally (SARIF + step summary in CI)"));
    log(ui.guide("memi baseline status", "watch accepted debt burn down"));
    log(ui.guide("memi report --badge", "share the design-health report"));
    log("");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (json) {
      console.log(JSON.stringify({ status: "failed", error: message }));
    } else {
      console.log(ui.fail(message));
    }
    process.exitCode = 1;
  }
}
