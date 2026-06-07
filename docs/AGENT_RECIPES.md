# Memoire Agent Recipes

Memoire is for coding agents first: it gives Claude Code, Codex, Cursor, OpenCode, Hermes, and OpenClaw a repeatable way to inspect UI quality, design tokens, shadcn registries, Figma context, and project memory before editing files.

## Before Any UI Patch

```bash
npm i -g @memi-design/cli
memi suite init --project .
memi daemon start --project . --port auto
memi daemon status --json
memi diagnose
memi ux audit --json
memi tokens --from ./src --report
memi shadcn export --out public/r
```

Use this when an agent is asked to fix layout, polish visual design, remove Tailwind drift, improve accessibility, convert Figma to code, critique screenshots, or create a component registry. Treat `memoire.agent.yaml` as the workspace contract and the reports under `.memoire/app-quality/` as evidence for the patch plan, including UX Tenets and Traps when `ux` appears in diagnosis or fix-plan JSON.

## Claude Code

```bash
memi agent install claude-code --project .
```

Claude Code reads the project `.mcp.json` and asks the user to approve project MCP servers. After approval, use Memoire MCP tools before broad UI edits:

```bash
memi mcp start --no-figma
```

Recommended prompt:

```text
Before changing UI code, use the Memoire MCP server to diagnose app quality, inspect tokens, audit UX tenets and traps, and read shadcn registry context. Ground every UI patch in Memoire evidence.
```

## Codex

```bash
memi agent install codex
memi agent install codex-plugin
```

`memi agent install codex` installs the skill-only context pack at `~/.codex/skills/memoire/memoire-design-tooling`. `memi agent install codex-plugin` installs the full home-local Codex plugin at `~/plugins/memoire` and updates `~/.agents/plugins/marketplace.json` so Codex can discover the bundled skill and Memoire MCP server wiring.

Public marketplace install:

```bash
codex plugin marketplace add sarveshsea/memi --ref main --sparse .agents/plugins --sparse plugins/memoire
```

Then open `/plugins` in Codex and install Memoire from the marketplace list.

Recommended prompt:

```text
Use the Memoire skill before frontend changes. Run memi diagnose, memi ux audit, and memi tokens when UI quality, Tailwind, shadcn/ui, accessibility, component registry, screenshot critique, or Figma context matters.
```

## Cursor

```bash
memi agent install cursor --project .
```

Cursor receives `.cursor/mcp.json` for the Memoire MCP server. Use it for design-system inspection, token extraction, registry export, and UI audit tools before code generation.

## OpenCode

```bash
memi agent install opencode --project .
```

OpenCode receives a workspace skill pack at `.opencode/skills/memoire/memoire-design-tooling`. Use it as the default UI/design-system workflow for local frontend work.

## Hermes

```bash
memi agent install hermes
```

Hermes receives `memoire-design-tooling` under `~/.hermes/skills/memoire/memoire-design-tooling`. Use it for Atomic Design, Figma bridge workflows, shadcn/ui, Tailwind, research synthesis, and design-system audits.

## OpenClaw

```bash
memi agent install openclaw --project .
```

OpenClaw receives `<workspace>/skills/memoire/memoire-design-tooling`. This is the ClawHub-style skill path for local agent adoption.

## Native Runtime

Use the shared daemon when a local agent shell, Studio, MCP client, or terminal adapter will ask Memoire for context more than once:

```bash
memi suite init --project .
memi daemon start --project . --port auto
memi daemon status --json
memi suite run design-audit --project . --json
```

The daemon warms markdown/YAML knowledge, project memory, harness metadata, MCP tools, and agent-kit install plans once per workspace. `memoire.agent.yaml` carries the product name, memory sources, harness list, installed skills, and repeatable product-team recipes.

## Product Scenario Simulation

Use `memi simulate` when a product agent needs to pressure-test a spec hypothesis against research evidence before implementation. The local and model-swarm adapters are clean-room TypeScript and use Memoire research data, not copied MiroFish source.

```bash
memi research synthesize
memi simulate models --json
memi simulate generate-agents --adapter model-swarm --count 24 --json
memi simulate plan --hypothesis "This product change reduces risk for the target cohort" --json
memi simulate run <scenario-id> --adapter local --json
memi simulate run <scenario-id> --adapter model-swarm --max-agents 24 --rounds 3 --json
memi simulate run-matrix --adapter model-swarm --hypothesis "Codex debate improves the spec" --hypothesis "Strict evidence links improve the spec" --json
memi simulate transcript <run-id> --json
memi simulate costs <run-id> --json
memi simulate compare <run-a> <run-b> --json
memi simulate interview <run-id> --agent <agent-id> --prompt "What spec requirement should change?" --json
memi simulate report <run-id> --json
memi simulate export-spec <run-id> --json
```

Studio exposes the same flow through the `simulate` action, Scenario Lab, and tools: `simulation.models`, `simulation.generate_agents`, `simulation.plan`, `simulation.run`, `simulation.run_matrix`, `simulation.stream`, `simulation.status`, `simulation.transcript`, `simulation.compare`, `simulation.costs`, `simulation.interview`, `simulation.report`, and `simulation.export_spec`. Live model calls are opt-in; deterministic fallback is the default when credentials or CLIs are missing.

MiroFish compatibility is an optional fork bridge. Memoire may call a separately licensed server with `--adapter mirofish --url <server>`, but the MIT npm package must not vendor MiroFish source.

## Research-Backed Vibe Design

Use this when Codex, Claude Code, Hermes, OpenCode, or OpenClaw needs to design from research rather than moodboard guesswork. The workflow generates a preview package first, then writes specs or Mermaid Jam source only when requested.

```bash
memi research synthesize
memi research design --intent "Design an evidence-backed planning board" --hypothesis "Evidence links improve product confidence" --json
memi research design --write-specs --mermaid-jam --json
memi mermaid-jam export --from research --json
memi suite run research-vibe-design --project . --json
```

Studio and MCP expose `research.design_package`, `research.generate_specs`, and `mermaid_jam.export`. Scenario Lab’s Export to FigJam action writes `.memoire/mermaid-jam/<package-id>/` Mermaid/markdown sources and opens Mermaid Jam through the local manifest when available. Agents should preserve the source + open boundary: do not attempt clipboard or direct paste automation unless the user explicitly asks for a later manual-assist workflow.

## Trust Defaults

Memoire does not run npm install-time lifecycle scripts in the public package. Install the Figma plugin explicitly with `memi setup plugin` or repair it with `memi doctor --repair-plugin`. The public Figma plugin build disables raw JavaScript execution; use typed Memoire Figma tools, MCP tools, and explicit local commands instead.

## Registry and Glama Publication

Memoire publishes as an npm package first, then as an MCP Registry server. Registry crawlers should inspect the Figma-independent startup path:

```bash
memi mcp start --no-figma
```

Release order:

```bash
npm logout --registry=https://registry.npmjs.org/
npm login --auth-type=web --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
npm publish --access public --auth-type=web
npm view @memi-design/cli version dist-tags.latest mcpName --json
mcp-publisher login github
mcp-publisher publish server.json
npm run check:public-release
```
