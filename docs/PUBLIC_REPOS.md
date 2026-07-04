# Public Repos And Distribution Surfaces

memi v2 needs public proof repos, not only package claims. Use this file to keep npm, GitHub, MCP, Agent Skills, Codex plugin, and example repos aligned.

## Primary repos

| Repo | Role | Public promise |
| --- | --- | --- |
| [`sarveshsea/memi`](https://github.com/sarveshsea/memi) | Engine, CLI, MCP server, Agent Skills, Codex plugin, examples, release gates | Interface understanding for AI coding agents. |
| [`sarveshsea/design-sandbox`](https://github.com/sarveshsea/design-sandbox) | Proof workspace | memi-ready Next.js, Tailwind, shadcn, MCP, and Agent Skills sandbox for design-to-code exploration. |
| [`sarveshsea/memi-studio`](https://github.com/sarveshsea/memi-studio) | macOS workbench | Supervised Codex and Claude Code runs with project memory, receipts, artifacts, and Figma/FigJam handoff. |
| [`sarveshsea/memoire-agent-skills`](https://github.com/sarveshsea/memoire-agent-skills) | Skill mirror | Mirror-ready Hermes/OpenClaw skill packages generated from the npm engine. |
| [`sarveshsea/memoire-community-notes`](https://github.com/sarveshsea/memoire-community-notes) | Community Notes | Reviewed skill packs for memi v2 surfaces, MCP setup, macOS Studio, design-sandbox proof, and interface craft. |

## GitHub descriptions

`sarveshsea/memi`:

```text
Interface understanding and design-system memory for AI coding agents.
```

`sarveshsea/design-sandbox`:

```text
memi-ready Next.js, Tailwind, shadcn, MCP, and Agent Skills sandbox for interface understanding and design-to-code exploration.
```

`sarveshsea/memi-studio`:

```text
AI workbench for product designers running Codex or Claude Code with project memory, receipts, and Figma/FigJam handoff.
```

`sarveshsea/memoire-community-notes`:

```text
Community Memoire Notes for memi, MCP, Agent Skills, macOS Studio, design-sandbox proof, and interface craft workflows.
```

## Topics

Use these topics on `sarveshsea/memi`:

```text
interface-understanding
design-systems
ai-coding-agents
shadcn-registry
tailwindcss
mcp-server
agent-skills
codex-plugin
ux-audit
figma-to-code
design-engineering
design-tokens
```

Use these topics on `sarveshsea/design-sandbox`:

```text
interface-understanding
design-systems
ai-coding-agents
shadcn
tailwindcss
mcp
agent-skills
codex
claude-code
ux-audit
figma-to-code
design-engineering
nextjs
```

## Public hashtags

```text
#InterfaceUnderstanding #DesignSystems #AICodingAgents #shadcn #TailwindCSS #MCP #AgentSkills #Codex #ClaudeCode #UXAudit #FigmaToCode #DesignEngineering
```

## Proof commands

For `sarveshsea/memi`:

```bash
npm i -g @memi-design/cli
memi diagnose
memi ux audit --json
memi craft audit --json
memi tokens --from ./src --report
memi shadcn export --out public/r
memi agent install universal --project .
memi mcp start --no-figma
```

For `sarveshsea/design-sandbox`:

```bash
pnpm install
pnpm memi:agent
pnpm memi:diagnose
pnpm memi:ux
pnpm memi:tokens
pnpm verify
```

## Architecture and cost positioning

- Start code-first; Figma is optional.
- Keep MCP local by default with `memi mcp start --no-figma`.
- Keep first-run proof free of model calls: diagnosis, UX audit, token extraction, registry export, and no-hex checks can run locally.
- Treat agent model usage, Figma API calls, browser automation, video generation, and extra packages as explicit upgrades.
- Use `memi agent install --dry-run --json` before writing skill or MCP files in public repos.

## Compatibility package story

| Surface | Package or file | Why it matters |
| --- | --- | --- |
| npm | `@memi-design/cli` | Main install and binary. |
| MCP | `server.json` + `memi mcp start --no-figma` | Registry-safe design tools. |
| Agent Skills | `skills/memoire-design-tooling/SKILL.md` | Standard skill ecosystem install. |
| Codex plugin | `plugins/memoire` | `/plugins` install path and MCP wiring. |
| Hermes/OpenClaw | `agent-kits/mirror` | Mirror-ready skill packages. |
| Design sandbox | `.agents/skills`, `.mcp.json`, `memoire.agent.yaml` | Public repo that proves integration. |
| Community Notes | `notes/<note-name>/note.json` | Reviewed downloadable Notes catalog at `/notes/community/catalog.v1.json`. |

## Next public repo targets

Add memi proof links where they are natural and honest:

- Design-system starter repos that already use shadcn/Tailwind.
- Internal-tool templates.
- AI chat UI templates.
- Dashboard/admin templates.
- Product-design agent examples.
- MCP client examples.
- Agent Skills directories.

Do not spam unrelated repos. Each link should include a runnable command and a reason memi improves the local design workflow.
