# Growth To 1M Weekly NPM Downloads

Updated: 2026-07-03

## North Star

Get `@memi-design/cli` to 1,000,000 weekly npm downloads by making memi the default package agents install before serious frontend work.

The category is **interface understanding for AI coding agents**: design-system memory, UX audit evidence, user research context, shadcn registry output, and MCP/skills distribution for the product stack.

## Current truth

- Source package is prepared for `@memi-design/cli@2.0.0`.
- Public npm latest was verified as `1.1.1` before the v2 publish step.
- Actual publish is blocked until npm owner auth is active and the intended release worktree is clean.
- MCP name is `io.github.sarveshsea/memi`.
- Codex plugin install path is `codex plugin marketplace add sarveshsea/memi --ref main --sparse .agents/plugins --sparse plugins/memoire`.
- Standard Agent Skills install path is `npx skills add sarveshsea/memi --skill memoire-design-tooling`.
- The v2 package story must lead with code-first proof, not Studio-only positioning.
- `sarveshsea/design-sandbox` is the primary public proof repo for memi v2 integration.

Run the live check:

```bash
node scripts/growth-status.mjs --json
npm view @memi-design/cli version dist-tags.latest mcpName --json
```

## Product posture

The package must be understandable in one screen:

```bash
npm i -g @memi-design/cli
memi diagnose
memi ux audit --json
memi craft audit --json
memi tokens --from ./src --report
memi shadcn export --out public/r
```

That is the conversion loop. Everything else should be a follow-on surface:

- Agent kits: `memi agent install --dry-run --json`.
- MCP: `memi mcp start --no-figma`.
- Research: `memi research design --write-specs --mermaid-jam`.
- Studio: supervised Codex and Claude Code workbench using the same engine.
- Figma: optional source of tokens, screenshots, and component context.

## Growth loops

1. **Release correctness**

Publish `2.0.0`, verify the npm README, run a clean temp install smoke, and keep `server.json` synchronized with package metadata.

2. **Search wedge**

Use the same phrases across npm, GitHub, docs, and launch posts:

- `interface understanding for AI coding agents`
- `Design-system memory for coding agents`
- `shadcn registry generator`
- `Tailwind token extraction`
- `UX audit for AI agents`
- `MCP server for design systems`
- `Agent Skills design tooling`
- `Codex design-system plugin`
- `Hermes design tooling`
- `ECC UI audit workflow`

3. **Agent-native adoption**

Make every agent stack installable and explainable:

- Universal Agent Skills and `npx skills add`.
- ECC / AGENTS.md workflow guidance.
- Hermes skill package.
- OpenClaw workspace skill.
- Claude Code and Cursor MCP config.
- Codex skill and plugin.
- OpenCode workspace skill.
- Generic MCP clients.

4. **Visible outputs**

Ship proof that users can see:

- App-quality reports.
- UX audit reports.
- Token extraction reports.
- shadcn registry JSON.
- Example registry screenshots.
- FigJam-ready Mermaid source.
- Studio run receipts and artifacts.
- `design-sandbox` as a runnable public workspace showing MCP, Agent Skills, shadcn, Tailwind, UX audit, and verification together.

5. **Trust and security**

Keep the package boring where trust matters:

- No npm lifecycle scripts.
- Figma plugin install is explicit.
- Agent kit writes have dry-run JSON.
- MCP has a no-Figma startup path.
- Release gates include production audit and package contents.
- NOTICE and licensing boundaries remain clear.

## Milestone ladder

| Milestone | What must be true |
| --- | --- |
| 1,000 weekly downloads | v2 is published; npm README is clear; clean install smoke passes; first-run commands work. |
| 10,000 weekly downloads | MCP Registry, Codex marketplace, Agent Skills, and shadcn examples all agree on the v2 story. |
| 100,000 weekly downloads | Templates, example registries, agent recipes, and docs are discoverable from npm and GitHub without needing Studio. |
| 1,000,000 weekly downloads | Downstream agents, templates, registries, and design-system docs install `@memi-design/cli` as infrastructure. |

## Weekly scorecard

Track:

- npm weekly downloads for `@memi-design/cli`.
- npm latest version and README phrase.
- GitHub stars, forks, issues, and external links.
- MCP Registry status.
- Agent Skills install success.
- Codex marketplace install success.
- design-sandbox install and `pnpm verify` success.
- Clean temp install smoke success.
- Number of working example registries.
- Number of external docs, templates, or agents pointing to memi.

## Keep the app tidy

Studio should demonstrate the engine and make agent work calmer. It should not replace the npm package story.

- Default story: interface understanding for AI coding agents.
- Default commands: diagnose, UX audit, tokens, shadcn export.
- Default advanced path: agent install, MCP, research design.
- Default Studio path: run Codex or Claude Code with memory, receipts, artifacts, and Figma/FigJam handoff.
