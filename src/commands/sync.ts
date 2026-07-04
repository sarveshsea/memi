import type { Command } from "commander";
import type { MemoireEngine } from "../engine/core.js";
import type { SyncDirection } from "../engine/sync.js";
import { ui } from "../tui/format.js";

export interface SyncPayload {
  status: "completed" | "partial" | "failed";
  figma: {
    connected: boolean;
    cached: boolean;
    error?: string;
  };
  designSystem: {
    tokens: number;
    components: number;
    styles: number;
  };
  specs: {
    regenerated: number;
    total: number;
  };
  sync?: {
    direction: SyncDirection;
    applied: number;
    pushed: number;
    conflicts: number;
  };
  elapsedMs: number;
  error?: string;
}

export function registerSyncCommand(program: Command, engine: MemoireEngine) {
  program
    .command("sync")
    .description("Full sync: Figma → design system → regenerate all specs → preview")
    .option("--json", "Output sync results as JSON")
    .option("--live", "Keep running and sync on every change (live mode)")
    .option("--direction <dir>", "Sync direction: figma-to-code, code-to-figma, bidirectional", "bidirectional")
    .option("--conflicts", "Show and resolve pending sync conflicts")
    .option("--auto-pr", "After sync, commit changes and open a PR via `gh pr create`")
    .option("--base <branch>", "Base branch for --auto-pr (default: main)", "main")
    .action(async (opts: { json?: boolean; live?: boolean; direction?: string; conflicts?: boolean; autoPr?: boolean; base?: string }) => {
      const start = Date.now();
      await engine.init();

      const direction = (opts.direction ?? "bidirectional") as SyncDirection;

      // ── Conflict resolution mode ────────────────────
      if (opts.conflicts) {
        const conflicts = engine.sync.getConflicts();

        if (opts.json) {
          console.log(JSON.stringify({ conflicts }, null, 2));
          return;
        }

        if (conflicts.length === 0) {
          console.log();
          console.log(ui.ok("No unresolved sync conflicts"));
          console.log();
          return;
        }

        console.log();
        console.log(ui.section("SYNC CONFLICTS"));
        for (const c of conflicts) {
          console.log(ui.dots(c.name, `${c.entityType} — figma: ${c.figmaHash.slice(0, 8)} vs code: ${c.codeHash.slice(0, 8)}`));
          console.log(`    Detected: ${c.detectedAt}`);
        }
        console.log();
        console.log(`  Resolve with: memi sync --direction figma-to-code  (Figma wins)`);
        console.log(`                memi sync --direction code-to-figma   (Code wins)`);
        console.log();
        return;
      }

      if (!opts.json) console.log("\n  Starting full sync...\n");

      // Step 1: Connect to Figma if not connected
      let figmaError: string | undefined;
      try {
        await engine.ensureFigmaConnected(15000);
      } catch (err) {
        figmaError = err instanceof Error ? err.message : String(err);
        if (!opts.json) {
          console.log("  Figma not available — syncing from cached design system.\n");
        }
      }

      // Step 2: Pull design system (if connected)
      if (engine.figma.isConnected) {
        await engine.pullDesignSystem();
      }

      // Step 2.5: Run bidirectional sync
      let syncApplied = 0;
      let syncPushed = 0;
      let syncConflicts = 0;
      try {
        const syncResult = await engine.sync.sync();
        syncApplied = syncResult.applied;
        syncPushed = syncResult.pushed;
        syncConflicts = syncResult.conflicts.length;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!opts.json) {
          console.log(`  Sync warning: ${msg}\n`);
        }
      }

      // Step 3: Regenerate all specs
      const specs = await engine.registry.getAllSpecs();
      let regenerated = 0;
      for (const spec of specs) {
        try {
          const result = await engine.generateFromSpec(spec.name);
          if (!result.blocked) regenerated++;
        } catch {
          // individual spec failures don't halt the sync
        }
      }

      const ds = engine.registry.designSystem;
      const usedCache = !engine.figma.isConnected;

      const payload: SyncPayload = {
        status: figmaError ? "partial" : "completed",
        figma: {
          connected: engine.figma.isConnected,
          cached: usedCache,
          ...(figmaError ? { error: figmaError } : {}),
        },
        designSystem: {
          tokens: ds.tokens.length,
          components: ds.components.length,
          styles: ds.styles.length,
        },
        specs: {
          regenerated,
          total: specs.length,
        },
        sync: {
          direction,
          applied: syncApplied,
          pushed: syncPushed,
          conflicts: syncConflicts,
        },
        elapsedMs: Date.now() - start,
      };

      if (opts.json) {
        console.log(JSON.stringify(payload, null, 2));
        if (!opts.live) return;
      }

      if (!opts.json) {
        console.log("\n  Full sync complete.\n");
        if (syncApplied > 0 || syncPushed > 0) {
          console.log(ui.dots("Applied", `${syncApplied} changes from Figma`));
          console.log(ui.dots("Pushed", `${syncPushed} changes to Figma`));
        }
        if (syncConflicts > 0) {
          console.log(ui.warn(`${syncConflicts} conflict${syncConflicts > 1 ? "s" : ""} detected — run memi sync --conflicts`));
        }
        console.log();
      }

      // ── Auto-PR mode ──────────────────────────────────
      if (opts.autoPr) {
        const { openAutoPR } = await import("../sync/auto-pr.js");
        const { readFile } = await import("node:fs/promises");
        const { join } = await import("node:path");
        let previous: import("../engine/registry.js").DesignSystem | null = null;
        try {
          previous = JSON.parse(await readFile(join(engine.config.projectRoot, ".memoire", "design-system.prev.json"), "utf-8"));
        } catch { /* no prior snapshot */ }

        const current = engine.registry.designSystem;
        const diff = previous
          ? computeDesignSystemDiff(previous, current)
          : { tokens: { added: current.tokens.map(t => t.name), removed: [], changed: [] }, components: { added: current.components.map(c => c.name), removed: [] }, lastSync: current.lastSync, previousSync: null };

        if (!opts.json) console.log(ui.active("Opening auto-PR..."));
        const pr = await openAutoPR({ cwd: engine.config.projectRoot, diff, base: opts.base });

        if (opts.json) {
          console.log(JSON.stringify({ autoPr: pr }, null, 2));
        } else {
          if (pr.status === "opened") {
            console.log(ui.ok(`PR opened: ${pr.prUrl}`));
          } else if (pr.status === "pushed-no-gh") {
            console.log(ui.ok(`Branch pushed: ${pr.branch}`));
            console.log(ui.dim("  Install `gh` CLI to auto-open PRs: https://cli.github.com"));
          } else if (pr.status === "skipped-no-changes") {
            console.log(ui.dim("  No changes to PR."));
          } else {
            console.log(ui.fail(`Auto-PR failed: ${pr.error}`));
          }
          console.log();
        }
      }

      // ── Live mode ─────────────────────────────────────
      if (opts.live) {
        if (!opts.json) {
          console.log(ui.active("Live sync active — watching for changes..."));
          console.log();
        }

        // Listen for Figma document changes
        engine.figma.on("document-changed", async () => {
          if (!opts.json) console.log(ui.event("·", "SYNC", "Figma document changed — syncing..."));
          try {
            const result = await engine.sync.sync();
            if (!opts.json && result.diff.hasChanges) {
              console.log(ui.event("+", "SYNC", result.diff.summary));
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!opts.json) console.log(ui.event("x", "SYNC", msg));
          }
        });

        // Listen for code changes
        engine.codeWatcher.on("code-changed", async () => {
          if (!opts.json) console.log(ui.event("·", "SYNC", "Code changed — syncing..."));
          try {
            const result = await engine.sync.sync();
            if (!opts.json && result.pushed > 0) {
              console.log(ui.event("+", "SYNC", `Pushed ${result.pushed} changes to Figma`));
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!opts.json) console.log(ui.event("x", "SYNC", msg));
          }
        });

        await engine.codeWatcher.start();

        // Graceful shutdown
        const cleanup = () => {
          engine.codeWatcher.stop();
          process.exit(0);
        };
        process.once("SIGINT", cleanup);
        process.once("SIGTERM", cleanup);

        // Keep alive
        setInterval(() => {}, 60_000);
      }
    });
}

// ── Diff helper for --auto-pr ──────────────────────────────────

function computeDesignSystemDiff(
  previous: import("../engine/registry.js").DesignSystem,
  current: import("../engine/registry.js").DesignSystem,
): import("./diff.js").DiffPayload {
  const prevTokens = new Map(previous.tokens.map(t => [t.name, t]));
  const currTokens = new Map(current.tokens.map(t => [t.name, t]));

  const added: string[] = [];
  const removed: string[] = [];
  const changed: { name: string; field: string; from: string; to: string }[] = [];

  for (const [name, token] of currTokens) {
    const prev = prevTokens.get(name);
    if (!prev) { added.push(name); continue; }
    const p = JSON.stringify(prev.values);
    const c = JSON.stringify(token.values);
    if (p !== c) {
      changed.push({
        name,
        field: "values",
        from: String(Object.values(prev.values)[0] ?? ""),
        to: String(Object.values(token.values)[0] ?? ""),
      });
    }
  }
  for (const name of prevTokens.keys()) if (!currTokens.has(name)) removed.push(name);

  const prevComps = new Set(previous.components.map(c => c.name));
  const currComps = new Set(current.components.map(c => c.name));

  return {
    tokens: { added, removed, changed },
    components: {
      added: [...currComps].filter(n => !prevComps.has(n)),
      removed: [...prevComps].filter(n => !currComps.has(n)),
    },
    lastSync: current.lastSync,
    previousSync: previous.lastSync,
  };
}
