# Memoire Agent Recipes

Memoire is for coding agents first: it gives Claude Code, Codex, Cursor, OpenCode, Hermes, and OpenClaw a repeatable way to inspect UI quality, design tokens, shadcn registries, Figma context, and project memory before editing files.

## Before Any UI Patch

```bash
npm i -g @sarveshsea/memoire
memi diagnose
memi tokens --from ./src --report
memi shadcn export --out public/r
```

Use this when an agent is asked to fix layout, polish visual design, remove Tailwind drift, improve accessibility, convert Figma to code, or create a component registry. Treat the reports under `.memoire/app-quality/` as evidence for the patch plan.

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
Before changing UI code, use the Memoire MCP server to diagnose app quality, inspect tokens, and read shadcn registry context. Ground every UI patch in Memoire evidence.
```

## Codex

```bash
memi agent install codex
```

Recommended prompt:

```text
Use the Memoire skill before frontend changes. Run memi diagnose and memi tokens when UI quality, Tailwind, shadcn/ui, accessibility, component registry, or Figma context matters.
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
npm view @sarveshsea/memoire version dist-tags.latest mcpName --json
mcp-publisher login github
mcp-publisher publish server.json
npm run check:public-release
```
