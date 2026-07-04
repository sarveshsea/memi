/**
 * MCP Tool registrations for Mémoire.
 *
 * Each tool wraps an existing engine method and returns structured
 * CallToolResult payloads. Errors are caught and returned as
 * { isError: true } per MCP convention.
 */

import { z } from "zod";
import { stat } from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MemoireEngine } from "../engine/core.js";
import { AgentOrchestrator } from "../agents/orchestrator.js";
import { DesignAnalyzer } from "../agents/design-analyzer.js";
import { buildDesignAgentBrief, DESIGN_AGENT_BRIEF_MODES } from "../agents/design-agent-brief.js";
import { getAI, getTracker } from "../ai/index.js";
import { ComponentSpecSchema, PageSpecSchema, DataVizSpecSchema, type ComponentSpec } from "../specs/types.js";
import { fetchPageAssets, parseCSSTokens } from "../research/css-extractor.js";
import { buildShadcnRegistry, toShadcnItemName } from "../shadcn/index.js";
import { diagnoseAppQuality } from "../app-quality/engine.js";
import { buildUiFixPlan } from "../app-quality/fix-plan.js";
import { buildUxAuditReport } from "../ux/tenets-traps.js";
import { buildInterfaceCraftReport } from "../ux/interface-craft.js";
import { resolveMermaidJamIntegration } from "../integrations/mermaid-jam.js";
import {
  buildResearchDesignPackage,
  saveResearchDesignSpecs,
  writeMermaidJamArtifacts,
} from "../research/design-package.js";
import {
  compareSimulationRuns,
  FileSimulationStore,
  LocalSimulationAdapter,
  ModelSwarmSimulationAdapter,
  SimulationModelRouter,
  buildProductSimulationScenarioFromResearch,
  exportProductSpecFromRun,
  simulationCosts,
  type SimulationAdapter,
  type SimulationAdapterKind,
  type SimulationBudget,
  type SimulationReport,
} from "../simulation/index.js";
import type { ResearchStore } from "../research/engine.js";

function requireFigma(engine: MemoireEngine): void {
  if (!engine.figma.isConnected) {
    throw new Error("Figma not connected. Start the daemon (`memi daemon start`) or connect (`memi connect`) first.");
  }
}

export function registerTools(server: McpServer, engine: MemoireEngine): void {
  // ── pull_design_system ──────────────────────────────────
  server.tool(
    "pull_design_system",
    `Pull the full design system from Figma into the local registry (tokens, components, styles).

Prerequisites: Figma bridge must be running and a plugin must be connected. Start with \`memi connect\` or \`memi daemon start\` if not already connected. Check bridge status first with check_bridge_health.

Returns on success: { tokens: number, components: number, styles: number, lastSync: ISO timestamp }

Error behavior: Throws "Figma not connected" if no plugin is connected. Network timeouts surface as bridge errors.

Use this tool: at the start of any session that touches design tokens or component styles, or after a designer has made changes in Figma that need to be reflected in code. After pulling, use get_tokens to inspect specific token values.`,
    {},
    async () => {
      requireFigma(engine);
      await engine.pullDesignSystem();
      const ds = engine.registry.designSystem;
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            tokens: ds.tokens.length,
            components: ds.components.length,
            styles: ds.styles.length,
            lastSync: ds.lastSync,
          }, null, 2),
        }],
      };
    },
  );

  // ── pull_design_system_rest ─────────────────────────────
  server.tool(
    "pull_design_system_rest",
    `Pull the design system from Figma via REST API — no plugin or Figma Desktop required.

Prerequisites: FIGMA_TOKEN and FIGMA_FILE_KEY environment variables must be set. No bridge or plugin connection needed.

Returns on success: { tokens: number, components: number, styles: number, lastSync: ISO timestamp }

Error behavior: Throws if FIGMA_TOKEN or FIGMA_FILE_KEY are missing, or if the Figma API returns an error (403 = bad token, 404 = bad file key).

Use this tool: when the Figma plugin is not available (CI, headless, remote), or when you want to pull tokens without starting the bridge. Equivalent to \`memi pull --rest\`.`,
    {},
    async () => {
      await engine.pullDesignSystemREST();
      const ds = engine.registry.designSystem;
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            tokens: ds.tokens.length,
            components: ds.components.length,
            styles: ds.styles.length,
            lastSync: ds.lastSync,
          }, null, 2),
        }],
      };
    },
  );

  // ── get_specs ───────────────────────────────────────────
  server.tool(
    "get_specs",
    `List all specs saved in the current project.

Prerequisites: None — reads from local registry. Engine must have been initialized (happens automatically when MCP server starts).

Returns on success: Array of summary objects, each with shape { name: string, type: "component"|"page"|"dataviz"|"design"|"ia", purpose?: string }. The purpose field is omitted for spec types that don't carry it.

Error behavior: Returns an empty array [] if no specs exist yet — not an error.

Use this tool: before create_spec (to check whether a spec already exists and would be overwritten), before generate_code (to confirm the target spec name), or to discover what components are defined in the project. Use get_spec to fetch the full body of a specific spec.`,
    {},
    async () => {
      const specs = await engine.registry.getAllSpecs();
      return {
        content: [{
          type: "text",
          text: JSON.stringify(specs.map((s) => ({
            name: s.name,
            type: s.type,
            purpose: "purpose" in s ? s.purpose : undefined,
          })), null, 2),
        }],
      };
    },
  );

  // ── get_spec ────────────────────────────────────────────
  server.tool(
    "get_spec",
    `Fetch the full body of a single spec by name.

Prerequisites: Spec must exist in the registry. Use get_specs to enumerate available spec names.

Returns on success: Full spec object as JSON — shape depends on type: ComponentSpec includes atomicLevel, props, variants, composesSpecs, codeConnect, and WCAG fields; PageSpec includes sections and meta; DataVizSpec includes chartType and dataShape.

Error behavior: Returns isError with message \`Spec "<name>" not found\` if the name does not match any saved spec.

Use this tool vs get_specs: get_specs gives you names and types (cheap list operation); get_spec gives you the full schema body for a single spec. Use get_spec when you need to read, modify, or verify the details of a known spec before generating code or calling analyze_design with spec-compliance mode.`,
    { name: z.string().describe("Name of the spec to retrieve (case-sensitive, matches the spec's 'name' field, not the filename). Use get_specs first to list available names.") },
    async ({ name }) => {
      const spec = await engine.registry.getSpec(name);
      if (!spec) {
        return { isError: true, content: [{ type: "text" as const, text: `Spec "${name}" not found` }] };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(spec, null, 2) }] };
    },
  );

  // ── create_spec ─────────────────────────────────────────
  server.tool(
    "create_spec",
    `Create or overwrite a spec in the local registry. Validates against Zod schemas before saving.

Prerequisites: None. The spec body must be valid JSON. If a spec with the same name already exists, it is silently overwritten.

Returns on success: Plain confirmation string \`Spec "<name>" saved (<type>)\`.

Error behavior: Returns isError with Zod validation error details if the spec body doesn't match the schema. Returns isError for JSON parse failures or unknown type values.

Spec type schemas:
- "component": Must include name, type="component", atomicLevel ("atom"|"molecule"|"organism"|"template"), purpose, props[], variants[], composesSpecs[], codeConnect{}. Atoms must have composesSpecs=[].
- "page": Must include name, type="page", purpose, sections[].
- "dataviz": Must include name, type="dataviz", chartType, dataShape.

Use this tool: to define a new component before calling generate_code, or to update an existing spec's props or variants. Always call get_specs first to avoid accidentally overwriting an existing spec.`,
    { spec: z.string().describe("JSON string of the full spec object. Must include a 'type' field ('component', 'page', or 'dataviz') and all required fields for that spec type. Zod validation errors are returned as structured error messages if the shape is invalid.") },
    async ({ spec: specJson }) => {
      try {
        const raw = JSON.parse(specJson);
        let parsed;
        switch (raw.type) {
          case "component": parsed = ComponentSpecSchema.parse(raw); break;
          case "page": parsed = PageSpecSchema.parse(raw); break;
          case "dataviz": parsed = DataVizSpecSchema.parse(raw); break;
          default: return { isError: true, content: [{ type: "text" as const, text: `Unknown spec type: ${raw.type}. Must be component, page, or dataviz.` }] };
        }
        // Validate prop names are valid TypeScript identifiers
        if (raw.type === "component" && raw.props) {
          for (const key of Object.keys(raw.props as Record<string, unknown>)) {
            if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
              return { isError: true, content: [{ type: "text" as const, text: `Invalid prop name "${key}" — must be a valid TypeScript identifier (letters, numbers, _, $)` }] };
            }
          }
        }
        await engine.registry.saveSpec(parsed);
        return { content: [{ type: "text" as const, text: `Spec "${parsed.name}" saved (${parsed.type})` }] };
      } catch (err) {
        return { isError: true, content: [{ type: "text" as const, text: `Failed to create spec: ${(err as Error).message}` }] };
      }
    },
  );

  // ── generate_code ───────────────────────────────────────
  server.tool(
    "generate_code",
    `Generate shadcn/ui + Tailwind component code from a saved spec and write output files to the project.

Prerequisites: The spec must exist in the registry (use get_specs to list names, create_spec to create one). Output is written into atomic design folders: atoms → components/ui/, molecules → components/molecules/, organisms → components/organisms/, templates → components/templates/.

Returns on success: { entryFile: string (absolute path to main generated file), files: string[] (all generated file paths), generatedAt: ISO timestamp }

Error behavior: Throws if specName is not found. If code generation fails (e.g. schema mismatch), an error message is returned with the failure reason.

Use this tool: after create_spec to turn a spec into working code. For pages, the page spec must reference template and component specs that already exist. Run npm install to add any missing shadcn components after generation.`,
    { specName: z.string().describe("Name of the spec to generate code for (case-sensitive, must match a spec returned by get_specs).") },
    async ({ specName }) => {
      const entryFile = await engine.generateFromSpec(specName);
      const gen = engine.registry.getGenerationState(specName);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            entryFile,
            files: gen?.files ?? [],
            generatedAt: gen?.generatedAt,
          }, null, 2),
        }],
      };
    },
  );

  // ── get_tokens ──────────────────────────────────────────
  server.tool(
    "get_tokens",
    `Get all design tokens currently stored in the local registry.

Prerequisites: None — reads from local registry without requiring a Figma connection. Run pull_design_system first if the registry is empty or stale.

Returns on success: Array of token objects, each with shape { name: string, type: "color"|"spacing"|"typography"|"radius"|"shadow"|"other", values: Record<string, string|number>, cssVariable?: string }. The values map is keyed by mode name (e.g. "Light", "Dark", "Default").

Error behavior: Returns an empty array [] if no tokens have been pulled yet — not an error.

Use this tool: to inspect available tokens before writing code (e.g. find the exact token name for a primary color), to validate token coverage before running sync_design_tokens, or to check which modes are defined. For a Tailwind-ready mapping, use sync_design_tokens instead.`,
    {},
    async () => ({
      content: [{
        type: "text" as const,
        text: JSON.stringify(engine.registry.designSystem.tokens, null, 2),
      }],
    }),
  );

  // ── get_shadcn_registry ────────────────────────────────
  server.tool(
    "get_shadcn_registry",
    `Build and return a shadcn-native registry index from the current Memoire workspace.

Prerequisites: Component specs must exist in the local registry. Tokens are optional but will be mapped into a registry:theme item when present.

Returns on success: shadcn registry.json-compatible data with { $schema, name, homepage, items[] }. Items include file targets, registryDependencies, cssVars, and Memoire metadata.

Use this tool: to provide AI editors and v0-compatible workflows with a registry context without writing files to disk. For an individual item, use get_registry_item.`,
    {
      name: z.string().default("memoire").describe("Registry name to embed in the shadcn registry index."),
      homepage: z.string().url().optional().describe("Public homepage used to generate /r/*.json and Open-in-v0 metadata."),
    },
    async ({ name, homepage }) => {
      const specs = (await engine.registry.getAllSpecs()).filter((spec): spec is ComponentSpec => spec.type === "component");
      const registry = buildShadcnRegistry({
        name,
        homepage,
        designSystem: engine.registry.designSystem,
        specs,
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(registry, null, 2) }] };
    },
  );

  // ── get_registry_item ──────────────────────────────────
  server.tool(
    "get_registry_item",
    `Return one shadcn-native registry item generated from the current Memoire workspace.

Prerequisites: The requested component spec must exist. Use get_specs to list available specs or get_shadcn_registry to inspect generated item names.

Returns on success: registry-item.json-compatible data with files, targets, dependencies, cssVars metadata when applicable, and Memoire Atomic Design metadata.

Use this tool: when an AI editor needs the exact installable context for one component or block.`,
    {
      name: z.string().describe("Component spec name or shadcn item slug, e.g. Button or button."),
      homepage: z.string().url().optional().describe("Public homepage used to generate item URL and Open-in-v0 metadata."),
    },
    async ({ name, homepage }) => {
      const specs = (await engine.registry.getAllSpecs()).filter((spec): spec is ComponentSpec => spec.type === "component");
      const registry = buildShadcnRegistry({
        name: "memoire",
        homepage,
        designSystem: engine.registry.designSystem,
        specs,
      });
      const itemName = toShadcnItemName(name);
      const item = registry.items.find((candidate) => toShadcnItemName(candidate.name) === itemName);
      if (!item) {
        return { isError: true, content: [{ type: "text" as const, text: `Registry item "${name}" not found` }] };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(item, null, 2) }] };
    },
  );

  // ── diagnose_app_quality ───────────────────────────────
  server.tool(
    "diagnose_app_quality",
    `Diagnose UI quality for an existing shadcn/Tailwind app from code or a public URL.

Returns on success: App-quality diagnosis V2 with scores, issues, evidence locations, affected files, confidence, effort estimates, fix categories, and app graph summary.

Use this tool: before planning UI fixes, exporting a registry, or giving an AI editor context on real app design debt.`,
    {
      target: z.string().optional().describe("Local path or public URL to scan. Defaults to the current project root."),
      maxFiles: z.number().default(500).describe("Maximum source files to scan."),
    },
    async ({ target, maxFiles }) => {
      const diagnosis = await diagnoseAppQuality({
        projectRoot: engine.config.projectRoot,
        target,
        maxFiles,
        write: false,
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(diagnosis, null, 2) }] };
    },
  );

  // ── plan_ui_fixes ──────────────────────────────────────
  server.tool(
    "plan_ui_fixes",
    `Build a dry-run UI fix plan from diagnosis evidence and app graph data.

Returns on success: { patches[], summary, caveats[] } where every patch includes risk, confidence, affected files, operations, and writeSafe. This tool never modifies source files.

Use this tool: to decide what a human or coding agent should patch before calling memi fix apply or making manual edits.`,
    {
      target: z.string().optional().describe("Local path or public URL to scan. Defaults to the current project root."),
      maxFiles: z.number().default(500).describe("Maximum source files to scan."),
    },
    async ({ target, maxFiles }) => {
      const plan = await buildUiFixPlan({
        projectRoot: engine.config.projectRoot,
        target,
        maxFiles,
        write: false,
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(plan, null, 2) }] };
    },
  );

  // ── audit_ux_tenets_traps ──────────────────────────────
  server.tool(
    "audit_ux_tenets_traps",
    `Audit UX tenets and traps from app-quality evidence or a screenshot artifact.

Returns on success: UX audit JSON with score, tenetCoverage, trapRisks, findings, and recommendedTweaks. This tool does not modify source files.

Use this tool: when an agent needs a focused design critique packet for clarity, feedback, control, consistency, accessibility, error recovery, progressive disclosure, workflow fit, trust, and state continuity.`,
    {
      target: z.string().optional().describe("Local path or public URL to scan. Defaults to the current project root."),
      screenshotPath: z.string().optional().describe("Optional screenshot artifact path to attach to the UX audit."),
      maxFiles: z.number().default(500).describe("Maximum source files to scan when target evidence is used."),
    },
    async ({ target, screenshotPath, maxFiles }) => {
      if (screenshotPath) await assertReadableArtifact(screenshotPath);

      if (screenshotPath && !target) {
        const report = buildUxAuditReport({
          target: "screenshot",
          artifactPath: screenshotPath,
          source: "mcp",
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }] };
      }

      const diagnosis = await diagnoseAppQuality({
        projectRoot: engine.config.projectRoot,
        target,
        maxFiles,
        write: false,
      });
      const report = screenshotPath
        ? buildUxAuditReport({
          target: diagnosis.target,
          issues: diagnosis.issues,
          appQualityScore: diagnosis.summary.score,
          artifactPath: screenshotPath,
          source: "mcp",
        })
        : diagnosis.ux;
      return { content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }] };
    },
  );

  // ── audit_interface_craft ──────────────────────────────
  server.tool(
    "audit_interface_craft",
    `Audit first-class interface design craft from local app-quality evidence or a screenshot artifact.

Returns on success: InterfaceCraftReport JSON with score, critique, dimensions, findings, and topOpportunities. Lenses cover visual design, interface design, conventions, and user context.

Use this tool: before an agent edits UI, after a redesign pass, or whenever the task requires visual polish beyond generic UX checks. Pair it with diagnose_app_quality and audit_ux_tenets_traps for the full local evidence loop.`,
    {
      target: z.string().optional().describe("Local path or public URL to scan. Defaults to the current project root."),
      screenshotPath: z.string().optional().describe("Optional screenshot artifact path to attach to the craft audit."),
      maxFiles: z.number().int().min(1).max(5000).default(500).describe("Maximum source files to scan when target evidence is used."),
    },
    async ({ target, screenshotPath, maxFiles }) => {
      if (screenshotPath) await assertReadableArtifact(screenshotPath);

      if (screenshotPath && !target) {
        const report = buildInterfaceCraftReport({
          target: "screenshot",
          artifactPath: screenshotPath,
          source: "mcp",
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }] };
      }

      const diagnosis = await diagnoseAppQuality({
        projectRoot: engine.config.projectRoot,
        target,
        maxFiles,
        write: false,
      });
      const report = buildInterfaceCraftReport({
        target: diagnosis.target,
        issues: diagnosis.issues,
        appQualityScore: diagnosis.summary.score,
        artifactPath: screenshotPath,
        source: "mcp",
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }] };
    },
  );

  // ── prepare_design_agent_brief ─────────────────────────
  server.tool(
    "prepare_design_agent_brief",
    `Prepare a cost-aware design-agent brief before editing UI.

Returns on success: JSON with mission, evidenceCommands, designRules, costControls, compatibility installs, MCP command, Agent Skills command, and handoffChecklist.

Use this tool: as the first MCP call when a coding agent is asked to design, polish, audit, refactor, or generate interface code. It is local-first and does not call Figma, browsers, or models.`,
    {
      target: z.string().optional().describe("Local path or URL the agent should inspect. Defaults to '.'."),
      intent: z.string().optional().describe("Natural language product/design task to optimize the brief around."),
      mode: z.enum(DESIGN_AGENT_BRIEF_MODES).default("local").describe("Evidence mode: local, figma, research, or full."),
      agent: z.string().default("design-agent").describe("Agent stack to prioritize in compatibility guidance, such as codex, hermes, openclaw, cursor, or claude-code."),
    },
    async ({ target, intent, mode, agent }) => {
      const brief = buildDesignAgentBrief({
        projectRoot: engine.config.projectRoot,
        target,
        intent,
        mode,
        agent,
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(brief, null, 2) }] };
    },
  );

  // ── update_token ────────────────────────────────────────
  server.tool(
    "update_token",
    `Update a design token value in the local registry, and optionally push the change back to Figma.

Prerequisites: Token must already exist in the registry (use get_tokens to list names). To push to Figma, a plugin connection is also required.

Returns on success: Plain confirmation string \`Token "<name>" updated\`.

Error behavior: Returns isError if the token name is not found in the registry. If pushToFigma is true but Figma is not connected, the local update still succeeds — the push is silently skipped (no error thrown). To verify the push landed in Figma, capture a screenshot afterward.

Use this tool: to apply a token override (e.g. change a brand color for a client theme) and optionally propagate it to Figma immediately. For bulk token mapping to Tailwind, use sync_design_tokens instead.`,
    {
      name: z.string().describe("Exact token name as it appears in get_tokens output (e.g. \"Colors/Primary\", \"Spacing/XS\"). Case-sensitive."),
      values: z.record(z.union([z.string(), z.number()])).describe("Mode-to-value map to merge into existing values (e.g. { \"Light\": \"#FF0000\", \"Dark\": \"#FF6666\" }). Only the modes you provide are updated — other modes are preserved."),
      pushToFigma: z.boolean().default(false).describe("If true and Figma is connected, push this token change to the Figma file immediately. Defaults to false (local registry only)."),
    },
    async ({ name, values, pushToFigma }) => {
      const token = engine.registry.designSystem.tokens.find((t) => t.name === name);
      if (!token) {
        return { isError: true, content: [{ type: "text" as const, text: `Token "${name}" not found` }] };
      }
      const updated = { ...token, values: { ...token.values, ...values } };
      engine.registry.updateToken(name, updated);

      if (pushToFigma && engine.figma.isConnected) {
        await engine.figma.pushTokens([{ name: updated.name, values: updated.values }]);
      }

      return { content: [{ type: "text" as const, text: `Token "${name}" updated` }] };
    },
  );

  // ── capture_screenshot ──────────────────────────────────
  server.tool(
    "capture_screenshot",
    `Capture a screenshot of a specific Figma node or the entire current page, returned as image data.

Prerequisites: Requires Figma bridge running and plugin connected. Use check_bridge_health to verify. Node IDs can be retrieved from get_selection or get_page_tree.

Returns on success: An image content block — { type: "image", data: base64 string, mimeType: "image/png" or "image/svg+xml" }. The image is returned directly in the response and can be passed to analyze_design for visual analysis.

Error behavior: Throws "Figma not connected" if plugin is not connected. Returns a bridge error if the node ID is invalid or the node is not visible.

Use this tool: to visually inspect a component or frame before/after mutations, as the first step in the self-heal loop (CREATE → SCREENSHOT → ANALYZE → FIX), or to feed a node image into analyze_design. Prefer SVG for vector components and PNG for complex frames.`,
    {
      nodeId: z.string().optional().describe("Figma node ID to capture (e.g. '123:456'). Omit to capture the entire current page. Obtain IDs from get_selection or get_page_tree."),
      format: z.enum(["PNG", "SVG"]).default("PNG").describe("Export format. PNG for raster output (default, works for all node types). SVG for vector output (best for icons and simple components)."),
      scale: z.number().default(2).describe("Export scale multiplier (default 2 = @2x). Use 1 for quick inspection, 2–3 for high-quality analysis."),
    },
    async ({ nodeId, format, scale }) => {
      requireFigma(engine);
      const result = await engine.figma.captureScreenshot(nodeId, format, scale);
      return {
        content: [{
          type: "image" as const,
          data: result.base64,
          mimeType: format === "SVG" ? "image/svg+xml" : "image/png",
        }],
      };
    },
  );

  // ── get_selection ───────────────────────────────────────
  server.tool(
    "get_selection",
    `Get the nodes currently selected in Figma, with full property details.

Prerequisites: Requires Figma bridge running and plugin connected. The user must have selected at least one node in Figma. Returns an empty array if nothing is selected.

Returns on success: Array of node objects. Each node includes: { id: string (node ID usable in other tools), name: string, type: string (e.g. "FRAME", "COMPONENT", "TEXT", "RECTANGLE"), width: number, height: number, x: number, y: number, layoutMode?: "HORIZONTAL"|"VERTICAL"|"NONE", primaryAxisSizingMode?: string, counterAxisSizingMode?: string, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number, itemSpacing?: number, fills?: array, strokes?: array, effects?: array, styles?: Record<string, string>, variantProperties?: Record<string, string> (only for component instances) }

Error behavior: Throws "Figma not connected" if no plugin is connected.

Use this tool: to retrieve node IDs for use in capture_screenshot or analyze_design; to inspect layout properties of a selected component; or to read variant properties before writing a spec.`,
    {},
    async () => {
      requireFigma(engine);
      const selection = await engine.figma.getSelection();
      return { content: [{ type: "text" as const, text: JSON.stringify(selection, null, 2) }] };
    },
  );

  // ── compose ─────────────────────────────────────────────
  server.tool(
    "compose",
    `Run the agent orchestrator with a natural language design intent — classifies the task, builds a multi-step plan, and executes it.

Prerequisites: No Figma connection required for spec/code tasks. Figma-touching tasks (design generation, audits) require the bridge to be running. The orchestrator automatically dispatches to registered agent workers when available, or falls back to internal execution.

Returns on success: Orchestrator result object with shape { success: boolean, plan: { steps: [] }, results: [], summary: string, errors?: [] }. Each step includes the agent role that handled it and its output.

Error behavior: Returns success=false with an errors array if planning fails or execution throws. Individual step failures are captured per-step and do not abort the entire plan.

Intent examples:
- "create a dashboard page with KPI cards, a chart, and a data table" — generates specs and code
- "audit button variants for WCAG contrast and touch target compliance" — runs accessibility checks
- "generate a login page with email/password form and OAuth buttons" — spec + codegen
- "pull design system, then generate all missing component specs" — chained multi-step pipeline
- "create a molecule spec for a search bar composing Input and Button atoms" — atomic design authoring

Be specific — vague intents like "make something nice" produce generic plans. Include component names, atomic levels, and target pages when relevant.`,
    {
      intent: z.string().describe("Natural language design task. Be specific about what to create, modify, or check. Include atomic level if relevant (atom/molecule/organism/template/page), component names, and target output (spec, code, audit). Examples: 'create a KPI card atom with value, label, and trend props', 'audit all organism specs for WCAG 2.2 compliance', 'generate the LoginPage template from the AuthForm organism spec'."),
      dryRun: z.boolean().default(false).describe("If true, returns the execution plan without running any steps. Use to inspect what the orchestrator intends to do before committing. Defaults to false."),
    },
    async ({ intent, dryRun }) => {
      const orchestrator = new AgentOrchestrator(engine);
      const result = await orchestrator.execute(intent, { dryRun });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── run_audit ───────────────────────────────────────────
  server.tool(
    "run_audit",
    `Run a design system audit through the agent orchestrator and return a structured findings report.

Prerequisites: No Figma connection required for spec-level audits. For visual/contrast checks, the bridge must be running (WCAG contrast checks query the design system tokens; pixel-level checks use AI vision via analyze_design).

Returns on success: Orchestrator result with audit findings — { success: boolean, results: AuditResult[], summary: string }. Each AuditResult includes { check: string, status: "pass"|"warn"|"fail", details: string, affected?: string[] }.

WCAG checks performed (when focus includes "accessibility"):
1. WA-101: Color contrast ratio — text/background pairs against 4.5:1 (AA normal) and 3:1 (AA large) thresholds
2. WA-201: Touch target size — interactive elements checked against 24×24px (AA) and 44×44px (AAA) minimums
3. WA-202: Focus indicator visibility — focus ring width ≥ 2px and contrast ≥ 3:1
4. WA-301: Text spacing overrides — specs must tolerate 1.5× line-height and 0.12em letter-spacing
5. WA-401: Keyboard navigation — component specs checked for keyboard interaction definitions

Error behavior: Never throws — returns success=false with an error message if the orchestrator fails to initialize.

Use this tool vs analyze_design: run_audit operates on specs and the token registry (no screenshot needed); analyze_design operates on a live Figma screenshot with AI vision. Use run_audit for systematic spec compliance; use analyze_design for visual quality review of a specific frame.`,
    {
      focus: z.string().optional().describe("Optional focus area to narrow the audit scope. Examples: 'accessibility' (runs all 5 WCAG checks), 'token coverage' (checks which components use design tokens vs hardcoded values), 'naming' (validates spec name conventions), 'contrast' (color contrast only), 'touch-targets' (interactive element sizing only). Omit to run the full default audit suite."),
    },
    async ({ focus }) => {
      const intent = focus ? `design-audit focusing on ${focus}` : "design-audit";
      const orchestrator = new AgentOrchestrator(engine);
      const result = await orchestrator.execute(intent);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── get_research ────────────────────────────────────────
  server.tool(
    "get_research",
    `Load and return the project's user research V2 store — observations, findings, personas, themes, quantitative metrics, and quality metadata.

Prerequisites: None — reads from the local .memoire/research/ directory. Research data is populated by running \`memi research from-file\`, \`memi research from-stickies\`, \`memi research from-transcript\`, \`memi research web\`, or \`memi research synthesize\`. Returns an empty V2 store if no research has been imported yet.

Returns on success: Research store object with shape { version, sources, observations, findings, themes, personas, quantitativeMetrics, opportunities, risks, contradictions, quality, summary, methods }. Findings include auditable evidence links via \`evidenceObservationIds\` and \`evidenceSourceIds\`. Themes reference \`findingIds[]\`.

Error behavior: Never throws — loads gracefully and returns an empty store if files are missing.

Use this tool: before running compose with a research-driven intent (e.g. "generate a dashboard based on user research"), to inspect what research context is available, or to verify that a research import or synthesis succeeded. Combine with compose to ground design decisions in actual user data.`,
    {},
    async () => {
      await engine.research.load();
      const store = engine.research.getStore();
      return { content: [{ type: "text" as const, text: JSON.stringify(store, null, 2) }] };
    },
  );

  // ── research_design_package ─────────────────────────────
  server.tool(
    "research_design_package",
    `Preview a research-backed vibe design package from ResearchStore V2 plus an optional simulation run.

Returns on success: { package } with brief, Atomic Design specs, evidence ids, Mermaid Jam-ready source artifacts, and warnings. This tool is non-mutating; call research_generate_specs to write specs or mermaid_jam_export to write FigJam source files.`,
    {
      intent: z.string().optional().describe("Design intent for the package."),
      hypothesis: z.string().optional().describe("Product/design hypothesis to ground generated specs."),
      runId: z.string().optional().describe("Optional simulation run id to fold report recommendations and timeline into the package."),
      research: z.string().optional().describe("Optional ResearchStore JSON string. Omit to load workspace research."),
    },
    async ({ intent, hypothesis, runId, research }) => {
      const store = research ? JSON.parse(research) as ResearchStore : await loadMcpResearchStore(engine);
      const simulationReport = runId ? await loadMcpSimulationReport(engine.config.projectRoot, runId) : null;
      const designPackage = buildResearchDesignPackage(store, { intent, hypothesis, simulationReport });
      return { content: [{ type: "text" as const, text: JSON.stringify({ package: designPackage }, null, 2) }] };
    },
  );

  server.tool(
    "research_generate_specs",
    `Write research-backed Atomic Design specs generated from ResearchStore V2.

Prerequisites: Call research_design_package first to preview. This tool requires approved=true to make the write explicit. Writes DesignSpec, IASpec, PageSpec, ComponentSpec, and DataVizSpec objects through the Memoire registry.`,
    {
      intent: z.string().optional(),
      hypothesis: z.string().optional(),
      runId: z.string().optional(),
      research: z.string().optional().describe("Optional ResearchStore JSON string. Omit to load workspace research."),
      approved: z.boolean().default(false).describe("Must be true to write generated specs."),
    },
    async ({ intent, hypothesis, runId, research, approved }) => {
      if (!approved) {
        return { isError: true, content: [{ type: "text" as const, text: "Approval required: pass approved=true to write generated research specs." }] };
      }
      const store = research ? JSON.parse(research) as ResearchStore : await loadMcpResearchStore(engine);
      const simulationReport = runId ? await loadMcpSimulationReport(engine.config.projectRoot, runId) : null;
      const designPackage = buildResearchDesignPackage(store, { intent, hypothesis, simulationReport });
      const specWrite = await saveResearchDesignSpecs(designPackage, engine.registry);
      return { content: [{ type: "text" as const, text: JSON.stringify({ package: designPackage, specWrite }, null, 2) }] };
    },
  );

  server.tool(
    "mermaid_jam_export",
    `Write Mermaid Jam-ready FigJam source artifacts from research or a simulation run.

This is source + open friendly: it writes .mmd/.md files under .memoire/mermaid-jam and returns next steps. It does not attempt clipboard or direct paste automation.`,
    {
      source: z.string().default("research").describe("Use 'research' or a simulation run id."),
      intent: z.string().optional(),
      hypothesis: z.string().optional(),
      research: z.string().optional().describe("Optional ResearchStore JSON string. Omit to load workspace research."),
    },
    async ({ source, intent, hypothesis, research }) => {
      const store = research ? JSON.parse(research) as ResearchStore : await loadMcpResearchStore(engine);
      const simulationReport = source && source !== "research"
        ? await loadMcpSimulationReport(engine.config.projectRoot, source)
        : null;
      const designPackage = buildResearchDesignPackage(store, { intent, hypothesis, simulationReport });
      const integration = await resolveMermaidJamIntegration({ projectRoot: engine.config.projectRoot });
      const exports = await writeMermaidJamArtifacts(designPackage, { projectRoot: engine.config.projectRoot, integration });
      return { content: [{ type: "text" as const, text: JSON.stringify({ package: designPackage, exports, integration }, null, 2) }] };
    },
  );

  // ── simulation_models ───────────────────────────────────
  server.tool(
    "simulation_models",
    `List Codex-first model profiles available to Memoire model-swarm simulations. Live model execution is opt-in; unavailable providers automatically fall back to deterministic clean-room simulation.`,
    {},
    async () => {
      const profiles = new SimulationModelRouter().listProfiles();
      return { content: [{ type: "text" as const, text: JSON.stringify({ profiles }, null, 2) }] };
    },
  );

  server.tool(
    "simulation_generate_agents",
    `Generate a 20-60 agent model-swarm cohort from Memoire research evidence without starting a run.`,
    {
      count: z.number().int().min(1).max(60).optional().describe("Target agent count. Model-swarm defaults to 24."),
      adapter: z.enum(["local", "model-swarm"]).optional().describe("Adapter mode. Defaults to model-swarm."),
      research: z.string().optional().describe("Optional ResearchStore JSON string. Omit to load workspace research."),
    },
    async ({ count, adapter, research }) => {
      const store = research ? JSON.parse(research) as ResearchStore : await loadMcpResearchStore(engine);
      const scenario = buildProductSimulationScenarioFromResearch(store, {
        adapter: adapter ?? "model-swarm",
        agentCount: count ?? (adapter === "local" ? undefined : 24),
      });
      return { content: [{ type: "text" as const, text: JSON.stringify({ agents: scenario.agents, graph: scenario.graph, budget: scenario.metadata.budget }, null, 2) }] };
    },
  );

  // ── simulation_plan ─────────────────────────────────────
  server.tool(
    "simulation_plan",
    `Create a clean-room product simulation scenario from Memoire research evidence.

Prerequisites: Research data should exist in research/store.v2.json, or pass a full ResearchStore JSON string. This tool does not call or vendor third-party fork source; it uses Memoire's local TypeScript simulation core. Use adapter=model-swarm for Codex-first model profile planning with deterministic fallback unless live models are explicitly allowed during run.

Returns on success: { scenario, warnings } where scenario includes agents, variables, graph nodes/edges, and evidenceFindingIds.`,
    {
      name: z.string().optional().describe("Scenario name. Defaults to the top research theme."),
      hypothesis: z.string().optional().describe("Product hypothesis to pressure-test."),
      research: z.string().optional().describe("Optional ResearchStore JSON string. Omit to load the current workspace research store."),
      adapter: z.enum(["local", "model-swarm"]).optional().describe("Adapter mode. Defaults to local."),
      agentCount: z.number().int().min(1).max(60).optional().describe("Target model-swarm agent count."),
      maxAgents: z.number().int().min(1).max(60).optional().describe("Run budget max agents."),
      rounds: z.number().int().min(1).max(12).optional().describe("Run budget max rounds."),
    },
    async ({ name, hypothesis, research, adapter, agentCount, maxAgents, rounds }) => {
      const store = research ? JSON.parse(research) as ResearchStore : await loadMcpResearchStore(engine);
      const adapterKind = adapter ?? "local";
      const budget = budgetFromMcp({ maxAgents, rounds });
      const scenario = buildProductSimulationScenarioFromResearch(store, {
        name,
        hypothesis,
        adapter: adapterKind,
        agentCount: agentCount ?? (adapterKind === "model-swarm" ? 24 : undefined),
        budget,
        modelProfiles: adapterKind === "model-swarm" ? new SimulationModelRouter().listProfiles() : [],
      });
      const simulationAdapter = createMcpSimulationAdapter(engine.config.projectRoot, adapterKind, budget);
      const prepared = await simulationAdapter.prepare(scenario);
      return { content: [{ type: "text" as const, text: JSON.stringify(prepared, null, 2) }] };
    },
  );

  server.tool(
    "simulation_run",
    `Run a prepared local or model-swarm product simulation scenario.

Prerequisites: Call simulation_plan first and pass the returned scenario.id.

Returns on success: SimulationRun with status, events, eventCount, and persisted run id.`,
    {
      scenarioId: z.string().describe("Scenario id returned by simulation_plan."),
      adapter: z.enum(["local", "model-swarm"]).optional().describe("Adapter mode. Defaults to the scenario adapter."),
      maxAgents: z.number().int().min(1).max(60).optional(),
      rounds: z.number().int().min(1).max(12).optional(),
      allowLiveModels: z.boolean().optional().describe("Opt into live provider calls. Defaults to false."),
    },
    async ({ scenarioId, adapter, maxAgents, rounds, allowLiveModels }) => {
      const store = new FileSimulationStore(engine.config.projectRoot);
      const scenario = await store.loadScenario(scenarioId);
      const adapterKind = adapter ?? scenario?.adapter ?? "local";
      const run = await createMcpSimulationAdapter(engine.config.projectRoot, adapterKind, budgetFromMcp({ maxAgents, rounds, allowLiveModels })).start(scenarioId);
      return { content: [{ type: "text" as const, text: JSON.stringify({ run }, null, 2) }] };
    },
  );

  server.tool(
    "simulation_run_matrix",
    `Plan and run multiple model-swarm hypotheses, then compare outcomes for product-spec decision work.`,
    {
      hypotheses: z.array(z.string()).min(1).describe("Hypotheses to run."),
      maxAgents: z.number().int().min(1).max(60).optional(),
      rounds: z.number().int().min(1).max(12).optional(),
      research: z.string().optional().describe("Optional ResearchStore JSON string."),
    },
    async ({ hypotheses, maxAgents, rounds, research }) => {
      const store = research ? JSON.parse(research) as ResearchStore : await loadMcpResearchStore(engine);
      const budget = budgetFromMcp({ maxAgents, rounds });
      const adapter = createMcpSimulationAdapter(engine.config.projectRoot, "model-swarm", budget);
      const runs = [];
      for (let index = 0; index < hypotheses.length; index += 1) {
        const scenario = buildProductSimulationScenarioFromResearch(store, {
          adapter: "model-swarm",
          name: `MCP simulation matrix ${index + 1}`,
          hypothesis: hypotheses[index],
          agentCount: maxAgents ?? 24,
          budget,
          modelProfiles: new SimulationModelRouter().listProfiles(),
        });
        const prepared = await adapter.prepare(scenario);
        const run = await adapter.start(prepared.scenario.id);
        runs.push({ hypothesis: hypotheses[index], scenario: prepared.scenario, run });
      }
      const comparison = compareSimulationRuns(runs.map((entry) => entry.run));
      return { content: [{ type: "text" as const, text: JSON.stringify({ runs, comparison }, null, 2) }] };
    },
  );

  server.tool(
    "simulation_stream",
    `Read persisted simulation events in stream order.`,
    { runId: z.string().describe("Simulation run id.") },
    async ({ runId }) => {
      const adapter = await createMcpAdapterForRun(engine.config.projectRoot, runId);
      const events = [];
      for await (const event of adapter.stream(runId)) events.push(event);
      return { content: [{ type: "text" as const, text: JSON.stringify({ events }, null, 2) }] };
    },
  );

  server.tool(
    "simulation_status",
    `Read a local simulation run status from .memoire/simulations/runs.`,
    {
      runId: z.string().describe("Simulation run id."),
    },
    async ({ runId }) => {
      const store = new FileSimulationStore(engine.config.projectRoot);
      const run = await store.loadRun(runId);
      if (!run) return { isError: true, content: [{ type: "text" as const, text: `Unknown simulation run: ${runId}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify({ run }, null, 2) }] };
    },
  );

  server.tool(
    "simulation_interview",
    `Interview a simulated product stakeholder from a completed local or model-swarm run.`,
    {
      runId: z.string().describe("Simulation run id."),
      agentId: z.string().describe("Agent id from the scenario."),
      prompt: z.string().describe("Question to ask the simulated agent."),
    },
    async ({ runId, agentId, prompt }) => {
      const adapter = await createMcpAdapterForRun(engine.config.projectRoot, runId);
      const interview = await adapter.interview(runId, { agentId, prompt });
      return { content: [{ type: "text" as const, text: JSON.stringify({ interview }, null, 2) }] };
    },
  );

  server.tool(
    "simulation_transcript",
    `Read model-swarm transcript memory for a run.`,
    { runId: z.string().describe("Simulation run id.") },
    async ({ runId }) => {
      const store = new FileSimulationStore(engine.config.projectRoot);
      const run = await store.loadRun(runId);
      if (!run) return { isError: true, content: [{ type: "text" as const, text: `Unknown simulation run: ${runId}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify({ transcripts: run.transcripts }, null, 2) }] };
    },
  );

  server.tool(
    "simulation_compare",
    `Compare completed simulation runs by adoption, confidence, evidence coverage, risk, and cost.`,
    { runIds: z.array(z.string()).min(1).describe("Simulation run ids.") },
    async ({ runIds }) => {
      const store = new FileSimulationStore(engine.config.projectRoot);
      const runs = await Promise.all(runIds.map(async (runId) => {
        const run = await store.loadRun(runId);
        if (!run) throw new Error(`Unknown simulation run: ${runId}`);
        return run;
      }));
      const comparison = compareSimulationRuns(runs);
      return { content: [{ type: "text" as const, text: JSON.stringify({ comparison }, null, 2) }] };
    },
  );

  server.tool(
    "simulation_costs",
    `Summarize token and cost usage for a simulation run.`,
    { runId: z.string().describe("Simulation run id.") },
    async ({ runId }) => {
      const store = new FileSimulationStore(engine.config.projectRoot);
      const run = await store.loadRun(runId);
      if (!run) return { isError: true, content: [{ type: "text" as const, text: `Unknown simulation run: ${runId}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify({ costs: simulationCosts(run) }, null, 2) }] };
    },
  );

  server.tool(
    "simulation_report",
    `Export a simulation report with recommendations, risks, assumptions, events, interviews, and evidenceFindingIds.`,
    {
      runId: z.string().describe("Simulation run id."),
    },
    async ({ runId }) => {
      const adapter = await createMcpAdapterForRun(engine.config.projectRoot, runId);
      const report = await adapter.exportReport(runId);
      return { content: [{ type: "text" as const, text: JSON.stringify({ report }, null, 2) }] };
    },
  );

  server.tool(
    "simulation_export_spec",
    `Convert a simulation report into a product-spec impact artifact that agents can paste into specs or handoff docs.`,
    {
      runId: z.string().describe("Simulation run id."),
    },
    async ({ runId }) => {
      const adapter = await createMcpAdapterForRun(engine.config.projectRoot, runId);
      const report = await adapter.exportReport(runId);
      const spec = exportProductSpecFromRun(report);
      return { content: [{ type: "text" as const, text: JSON.stringify({ spec }, null, 2) }] };
    },
  );

  // ── analyze_design ──────────────────────────────────────
  server.tool(
    "analyze_design",
    `Capture a Figma node as a screenshot and analyze it with AI vision (Claude).

Prerequisites: Requires Figma bridge running and plugin connected. Also requires ANTHROPIC_API_KEY to be set in the environment — returns isError if the key is missing. For spec-compliance mode, the spec must exist in the registry.

Returns on success: Analysis object — shape varies by mode:
- general: { summary: string, issues: [], suggestions: [], qualityScore: number }
- accessibility: { summary: string, contrastIssues: [], touchTargetIssues: [], focusIssues: [], wcagLevel: "A"|"AA"|"AAA"|"fail" }
- spec-compliance: { summary: string, compliant: boolean, mismatches: [], missingProps: [], extraElements: [] }

Error behavior: Returns isError if ANTHROPIC_API_KEY is not set, if Figma is not connected, if the node ID is invalid, or if specName is missing/not found when using spec-compliance mode.

Mode selection guide:
- "general" — visual polish review: spacing consistency, color harmony, typography hierarchy, alignment. Use after creating or modifying a design to catch obvious quality issues.
- "accessibility" — contrast ratio checks, touch target sizes, focus indicator visibility, text readability. Use when validating WCAG compliance of a specific frame or component.
- "spec-compliance" — compares the rendered design against a saved spec's props, variants, and layout rules. Use to verify that what's in Figma matches what's in the spec before generating code.

This tool is best used as part of the self-heal loop: create → capture_screenshot → analyze_design → fix → verify.`,
    {
      nodeId: z.string().optional().describe("Figma node ID to capture and analyze (e.g. '123:456'). Omit to capture the entire current page. Obtain IDs from get_selection or get_page_tree."),
      mode: z.enum(["general", "accessibility", "spec-compliance"]).default("general").describe("Analysis mode: 'general' for visual quality and polish, 'accessibility' for WCAG contrast/touch/focus checks, 'spec-compliance' to verify the design matches a saved spec (requires specName)."),
      specName: z.string().optional().describe("Name of the spec to compare against (required when mode='spec-compliance'). Use get_specs to list available spec names."),
    },
    async ({ nodeId, mode, specName }) => {
      requireFigma(engine);
      const ai = getAI();
      if (!ai) {
        return { isError: true, content: [{ type: "text" as const, text: "ANTHROPIC_API_KEY not set — AI vision requires an API key" }] };
      }

      const screenshot = await engine.figma.captureScreenshot(nodeId, "PNG", 2);
      const analyzer = new DesignAnalyzer(ai);

      let analysis;
      switch (mode) {
        case "accessibility":
          analysis = await analyzer.auditAccessibility(screenshot.base64);
          break;
        case "spec-compliance": {
          if (!specName) {
            return { isError: true, content: [{ type: "text" as const, text: "specName required for spec-compliance mode" }] };
          }
          const spec = await engine.registry.getSpec(specName);
          if (!spec) {
            return { isError: true, content: [{ type: "text" as const, text: `Spec "${specName}" not found` }] };
          }
          analysis = await analyzer.checkSpecCompliance(screenshot.base64, JSON.stringify(spec, null, 2), engine.registry.designSystem);
          break;
        }
        default:
          analysis = await analyzer.analyzeDesign(screenshot.base64);
      }

      return { content: [{ type: "text" as const, text: JSON.stringify(analysis, null, 2) }] };
    },
  );

  // ── get_page_tree ───────────────────────────────────────
  server.tool(
    "get_page_tree",
    `Get the hierarchical node tree of the current Figma file, up to a configurable depth.

Prerequisites: Requires Figma bridge running and plugin connected.

Returns on success: Nested tree structure — top level is an array of page objects, each with { id, name, type: "PAGE", children: [] }. Children are frames, components, groups, and other nodes. Each node has { id, name, type, children? }. Node IDs from this tree can be passed directly to capture_screenshot or analyze_design.

Error behavior: Throws "Figma not connected" if no plugin is connected. Very high depth values may time out for large files.

Use this tool: at the start of a session to understand file structure and locate frames by name, to find node IDs without requiring manual selection in Figma, or to enumerate all pages before performing bulk operations. Use depth=1 to list pages only, depth=2 (default) to see top-level frames, depth=3+ to drill into component internals.`,
    { depth: z.number().default(2).describe("Maximum tree depth to traverse (default 2). Depth 1 = pages only, depth 2 = pages + top-level frames, depth 3+ = deeper into component trees. Large files at depth 4+ may be slow.") },
    async ({ depth }) => {
      requireFigma(engine);
      const tree = await engine.figma.getPageTree(depth);
      return { content: [{ type: "text" as const, text: JSON.stringify(tree, null, 2) }] };
    },
  );

  // ── measure_text ───────────────────────────────────────
  server.tool(
    "measure_text",
    `Predict text layout dimensions — height, line count, overflow risk, and breakpoint behavior — without a browser or Figma connection.

Prerequisites: None — runs entirely in Node.js using canvas-based text measurement. No Figma or AI dependencies.

Returns on success: Result object with { height: number (px), lineCount: number, lines: string[] (wrapped line strings) }. If containerHeight is provided, adds { overflow: { overflows: boolean, excessHeight: number } }. If checkBreakpoints is true, adds { breakpoints: { mobile: {...}, tablet: {...}, desktop: {...} } } each with the same height/lineCount/overflow shape.

Error behavior: Never throws — returns 0 height and 1 line if the font string is unparseable.

Use this tool: to validate that a UI label or body text will fit inside a fixed-height container before generating Figma designs or code, to detect which breakpoints cause overflow for responsive layouts, or to size containers accurately without a live browser. Particularly useful when a spec defines a maxLines constraint and you need to verify the real text content respects it.`,
    {
      text: z.string().describe("The text content to measure. Include all characters including newlines if the source content has them."),
      maxWidth: z.number().describe("Maximum container width in pixels for line wrapping calculations."),
      font: z.string().default("16px sans-serif").describe("CSS font shorthand string used for measurement (e.g. '16px Inter', 'bold 14px sans-serif', '500 13px/1.4 system-ui'). Use the same font as your target UI for accurate results."),
      lineHeight: z.number().optional().describe("Line height in pixels. Defaults to fontSize × 1.5 if omitted. Provide this to match your Tailwind leading-* or Figma line height setting."),
      containerHeight: z.number().optional().describe("If provided, checks whether the measured text fits within this height (in pixels) and reports overflow. Omit if you only need dimensions."),
      checkBreakpoints: z.boolean().default(false).describe("If true, also measures text at mobile (375px), tablet (768px), and desktop (1280px) widths in addition to maxWidth. Useful for responsive overflow detection."),
    },
    async ({ text, maxWidth, font, lineHeight, containerHeight, checkBreakpoints: doBreakpoints }) => {
      const { getTextMeasurer } = await import("../engine/text-measurer.js");
      const measurer = getTextMeasurer();

      const result: Record<string, unknown> = {};

      // Basic measurement
      const measurement = measurer.measureDetailed(text, { maxWidth, font, lineHeight });
      result.height = measurement.height;
      result.lineCount = measurement.lineCount;
      result.lines = measurement.lines;

      // Overflow check
      if (containerHeight !== undefined) {
        const overflow = measurer.checkOverflow(text, { maxWidth, font, lineHeight, containerHeight });
        result.overflow = overflow;
      }

      // Breakpoint analysis
      if (doBreakpoints) {
        const breakpoints = measurer.checkBreakpoints(text, { font, lineHeight, containerHeight });
        result.breakpoints = breakpoints;
      }

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── sync_design_tokens ─────────────────────────────────
  server.tool(
    "sync_design_tokens",
    `Map design system tokens from the local registry to a Tailwind config theme extension object.

Prerequisites: Tokens must already be in the local registry (run pull_design_system or get_tokens to verify). No Figma connection required.

Returns on success: A partial Tailwind theme object ready to merge into tailwind.config.ts under theme.extend, e.g. { colors: { primary: "var(--colors-primary)", ... }, spacing: { xs: "var(--spacing-xs)", ... }, fontSize: {...}, borderRadius: {...}, boxShadow: {...} }. Empty token categories are omitted. Token keys are derived from the last segment of the token name, lowercased and hyphenated. CSS variables are preferred over raw values when available.

Error behavior: Never throws — returns an empty object {} if no tokens are in the registry.

Use this tool vs get_tokens: get_tokens returns raw token data for inspection; sync_design_tokens returns a Tailwind-ready patch you can directly paste into your config. Tokens of type "other" are skipped as they have no standard Tailwind mapping.`,
    {},
    async () => {
      const tokens = engine.registry.designSystem.tokens;
      const patch: Record<string, Record<string, string>> = {
        colors: {},
        spacing: {},
        fontSize: {},
        borderRadius: {},
        boxShadow: {},
      };

      for (const token of tokens) {
        // Derive a Tailwind-friendly key from the token name
        // e.g. "Colors/Primary" → "primary", "Spacing/XS" → "xs"
        const parts = token.name.split("/");
        const key = (parts[parts.length - 1] ?? token.name)
          .replace(/\s+/g, "-")
          .toLowerCase();

        // Pick first mode value as the default, or use the CSS variable
        const firstValue = Object.values(token.values)[0];
        const value = token.cssVariable
          ? `var(${token.cssVariable})`
          : String(firstValue ?? "");

        switch (token.type) {
          case "color":
            patch.colors[key] = value;
            break;
          case "spacing":
            patch.spacing[key] = value;
            break;
          case "typography":
            patch.fontSize[key] = value;
            break;
          case "radius":
            patch.borderRadius[key] = value;
            break;
          case "shadow":
            patch.boxShadow[key] = value;
            break;
          // "other" tokens are skipped — no standard Tailwind mapping
        }
      }

      // Remove empty groups
      for (const group of Object.keys(patch)) {
        if (Object.keys(patch[group]).length === 0) {
          delete patch[group];
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(patch, null, 2),
        }],
      };
    },
  );

  // ── check_bridge_health ────────────────────────────────
  server.tool(
    "check_bridge_health",
    `Check the health and connection state of the Figma WebSocket bridge server.

Prerequisites: None — this tool works even when no Figma plugin is connected. It queries the bridge server directly and does not require a plugin handshake.

Returns on success: Health object with shape { status: "healthy"|"degraded"|"down", connected: boolean, clientCount: number, latencyMs: number, uptimeSeconds: number, port: number, error?: string }. latencyMs is measured via a round-trip ping to the bridge server. clientCount is the number of connected plugin clients (0 means no plugin is open in Figma).

Error behavior: Never throws — returns { status: "down", error: string } if the bridge server is not running or unreachable.

Use this tool: as the first diagnostic step before calling any Figma-dependent tool (pull_design_system, capture_screenshot, get_selection), to verify bridge connectivity after running \`memi connect\`, or to detect stale connections (clientCount=0 despite expecting a connected plugin).`,
    {},
    async () => {
      const health = await engine.figma.wsServer.checkHealth();
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(health, null, 2),
        }],
      };
    },
  );

  // ── design_doc ────────────────────────────────────────
  server.tool(
    "design_doc",
    `Scrape a public URL and extract its design system as a structured DESIGN.md document.

Fetches the page HTML and all linked stylesheets, parses CSS custom properties, color values, font families, spacing, radii, and shadows, then uses Claude to synthesize a structured DESIGN.md.

Prerequisites: URL must be publicly accessible (no authentication required). ANTHROPIC_API_KEY must be set for AI synthesis mode — use raw=true as a fallback when the key is not available.

Returns on success (raw=false): A full DESIGN.md markdown document with sections: ## Color System, ## Typography, ## Spacing, ## Borders & Surfaces, ## Component Patterns, ## Voice & Tone, ## Do / Don't, ## Tailwind Config Sketch. Values are drawn from the page's actual CSS.

Returns on success (raw=true): JSON object with shape { url, title, tokens: { cssVarCount, colorCount, fontCount, cssVars: Record<string,string>, colors: string[], fonts: string[], fontSizes: string[], spacing: string[], radii: string[], shadows: string[] } }

Error behavior: Returns isError if the URL is unreachable or returns no usable CSS. Returns isError with "ANTHROPIC_API_KEY required" message if AI synthesis is needed but the key is missing.

Use this tool: to reverse-engineer a competitor's or reference site's design system before creating specs, to quickly document a client's existing web style guide, or to extract tokens for comparison with the project's own system. Pass raw=true when you want to programmatically process the token data rather than read a document.`,
    {
      url: z.string().url().describe("Fully-qualified public URL to extract design tokens from (e.g. 'https://stripe.com', 'https://linear.app'). Must be accessible without authentication."),
      raw: z.boolean().default(false).describe("If false (default), returns an AI-synthesized DESIGN.md document (requires ANTHROPIC_API_KEY). If true, returns the raw parsed token data as JSON without calling the AI — useful when ANTHROPIC_API_KEY is unavailable or you want structured data."),
    },
    async ({ url, raw }) => {
      try {
        const assets = await fetchPageAssets(url);
        if (!assets.html && assets.cssBlocks.length === 0) {
          return { isError: true, content: [{ type: "text" as const, text: `Could not fetch ${url}` }] };
        }
        const tokens = parseCSSTokens(assets.cssBlocks);

        if (raw) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                url,
                title: assets.title,
                tokens: {
                  cssVarCount: Object.keys(tokens.cssVars).length,
                  colorCount: tokens.colors.length,
                  fontCount: tokens.fonts.length,
                  cssVars: tokens.cssVars,
                  colors: tokens.colors,
                  fonts: tokens.fonts,
                  fontSizes: tokens.fontSizes,
                  spacing: tokens.spacing,
                  radii: tokens.radii,
                  shadows: tokens.shadows,
                },
              }, null, 2),
            }],
          };
        }

        const ai = getAI();
        if (!ai) {
          return { isError: true, content: [{ type: "text" as const, text: "ANTHROPIC_API_KEY required for AI synthesis. Use raw=true for parsed tokens without AI." }] };
        }

        const varSample = Object.entries(tokens.cssVars).slice(0, 60).map(([k, v]) => `${k}: ${v}`).join("\n");
        const response = await ai.complete({
          system: "You are a design system analyst. Extract precise, actionable design systems from raw CSS data.",
          messages: [{
            role: "user",
            content: `Extract a DESIGN.md from: ${url}\nTitle: ${assets.title}\n\nCSS Variables:\n${varSample || "(none)"}\n\nColors: ${tokens.colors.slice(0, 30).join(", ") || "(none)"}\nFonts: ${tokens.fonts.slice(0, 8).join(" | ") || "(none)"}\nFont sizes: ${tokens.fontSizes.slice(0, 12).join(", ") || "(none)"}\nSpacing: ${tokens.spacing.slice(0, 12).join(", ") || "(none)"}\nRadii: ${tokens.radii.slice(0, 8).join(", ") || "(none)"}\nShadows: ${tokens.shadows.slice(0, 4).join("; ") || "(none)"}\n\nOutput a DESIGN.md with: ## Color System, ## Typography, ## Spacing, ## Borders & Surfaces, ## Component Patterns, ## Voice & Tone, ## Do / Don't, ## Tailwind Config Sketch. Be specific, use actual values.`,
          }],
          model: "deep",
          maxTokens: 4096,
        });

        return { content: [{ type: "text" as const, text: response.content }] };
      } catch (err) {
        return { isError: true, content: [{ type: "text" as const, text: `design_doc failed: ${(err as Error).message}` }] };
      }
    },
  );

  // ── get_ai_usage ──────────────────────────────────────
  server.tool(
    "get_ai_usage",
    `Get AI token usage and estimated cost for the current MCP server session.

Prerequisites: None — reads from the in-memory usage tracker. Returns zero values if no AI calls have been made yet.

Returns on success: { calls: number (total AI API calls made), inputTokens: number, outputTokens: number, estimatedCost: string (formatted as "$0.0000"), summary: string (human-readable breakdown) }

Error behavior: Never throws — returns a zero-value object with summary "No AI client initialized" if ANTHROPIC_API_KEY was not set when the server started.

Use this tool: to monitor token spend during a session involving analyze_design, design_doc, or compose calls, to estimate costs before running large batch operations, or to audit which tools are the heaviest AI consumers in a workflow.`,
    {},
    async () => {
      const tracker = getTracker();
      if (!tracker) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ calls: 0, inputTokens: 0, outputTokens: 0, estimatedCost: "$0.0000", summary: "No AI client initialized" }, null, 2) }] };
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            calls: tracker.callCount,
            inputTokens: tracker.totalInput,
            outputTokens: tracker.totalOutput,
            estimatedCost: `$${tracker.totalCost.toFixed(4)}`,
            summary: tracker.summary,
          }, null, 2),
        }],
      };
    },
  );
}

async function assertReadableArtifact(path: string): Promise<void> {
  const info = await stat(path).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Artifact is not readable: ${path}. ${message}`);
  });
  if (!info.isFile()) {
    throw new Error(`Artifact is not a file: ${path}`);
  }
}

async function loadMcpResearchStore(engine: MemoireEngine): Promise<ResearchStore> {
  await engine.research.load();
  return engine.research.getStore();
}

async function loadMcpSimulationReport(projectRoot: string, runId: string): Promise<SimulationReport | null> {
  const store = new FileSimulationStore(projectRoot);
  const run = await store.loadRun(runId);
  if (!run) return null;
  const adapter = createMcpSimulationAdapter(projectRoot, run.adapter);
  return adapter.exportReport(runId);
}

function createMcpSimulationAdapter(projectRoot: string, adapter: SimulationAdapterKind, budget?: Partial<SimulationBudget>): SimulationAdapter {
  if (adapter === "model-swarm") {
    return new ModelSwarmSimulationAdapter({ store: new FileSimulationStore(projectRoot), defaultBudget: budget });
  }
  return new LocalSimulationAdapter({ store: new FileSimulationStore(projectRoot) });
}

async function createMcpAdapterForRun(projectRoot: string, runId: string): Promise<SimulationAdapter> {
  const store = new FileSimulationStore(projectRoot);
  const run = await store.loadRun(runId);
  return createMcpSimulationAdapter(projectRoot, run?.adapter ?? "local");
}

function budgetFromMcp(input: {
  maxAgents?: number;
  rounds?: number;
  allowLiveModels?: boolean;
}): Partial<SimulationBudget> | undefined {
  const budget: Partial<SimulationBudget> = {};
  if (input.maxAgents !== undefined) budget.maxAgents = input.maxAgents;
  if (input.rounds !== undefined) budget.maxRounds = input.rounds;
  if (input.allowLiveModels !== undefined) budget.allowLiveModels = input.allowLiveModels;
  return Object.keys(budget).length ? budget : undefined;
}
