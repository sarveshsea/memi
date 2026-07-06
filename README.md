<p align="center">
  <img src="https://raw.githubusercontent.com/sarveshsea/memi/main/assets/authentic-logo.svg" alt="memi" width="80" height="80" />
</p>

<h1 align="center">memi</h1>

<p align="center">
  <strong>Interface understanding for AI coding agents.</strong><br/>
  <strong>Design-system memory for coding agents</strong> that need to audit, understand, and safely change real shadcn/Tailwind products.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@memi-design/cli"><img src="https://img.shields.io/npm/v/@memi-design/cli?color=black" alt="npm"></a>
  <a href="https://github.com/sarveshsea/memi/stargazers"><img src="https://img.shields.io/github/stars/sarveshsea/memi?style=social" alt="stars"></a>
  <a href="https://github.com/sarveshsea/memi/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-black.svg" alt="MIT"></a>
</p>

memi is a local design intelligence layer for product teams using Codex, Claude Code, Cursor, Hermes, OpenCode, OpenClaw, ECC-style agent stacks, MCP clients, shadcn/ui, Tailwind, Figma, FigJam, interface craft critique, and research-backed UX audits.

It turns an app into evidence an agent can use: tokens, components, screenshots, routes, Figma context, UX tenets and traps, interface craft dimensions, user research, Atomic Design specs, shadcn registry items, and repeatable run receipts.

Homepage: [memoire.cv](https://memoire.cv)
Package: [@memi-design/cli on npm](https://www.npmjs.com/package/@memi-design/cli)
Compatibility: [shadcn registry](https://ui.shadcn.com/docs/registry/getting-started) and [v0 design systems](https://v0.app/docs/design-systems)

## Install and prove it in five minutes

```bash
npm i -g @memi-design/cli

memi agent brief . --intent "Improve this interface" --json
memi diagnose
memi ux audit --json
memi craft audit --json
memi tokens --from ./src --report
memi shadcn export --out public/r
memi agent install universal --project .
memi mcp start --no-figma
```

That loop gives a coding agent enough interface understanding to stop guessing: a design-agent brief, app-quality findings, UX risks, interface craft critique, extracted tokens, registry output, an installable Agent Skills package, and a Figma-independent MCP server.

## What v2 is

Version 2 is the package release that moves memi from a design-system CLI into an agent-native interface-understanding stack.

| Layer | What it does | First command |
| --- | --- | --- |
| App quality | Audits real apps for UI debt, state gaps, accessibility risk, Tailwind drift, and UX traps. | `memi diagnose` |
| Design-agent brief | Creates a cost-aware preflight contract with evidence commands, design rules, compatibility installs, and handoff requirements. | `memi agent brief . --json` |
| UX audit | Scores UX tenets and trap risks from code, screenshots, routes, or local artifacts. | `memi ux audit --json` |
| Interface craft | Scores visual design, focusing mechanism, hierarchy, spacing rhythm, conventions, responsive resilience, and user context. | `memi craft audit --json` |
| Token memory | Extracts CSS variables, Tailwind v4 `@theme`, aliases, modes, repeated literals, and scale issues. | `memi tokens --from ./src --report` |
| Registry output | Exports shadcn-native registry files that work with shadcn, v0, npm, GitHub, and static hosts. | `memi shadcn export --out public/r` |
| Agent kits | Installs skills and MCP config for Codex, Claude Code, Cursor, Hermes, OpenCode, OpenClaw, and universal `.agents/skills` stacks. | `memi agent install --dry-run --json` |
| MCP server | Gives any MCP client Figma-independent design tools over stdio. | `memi mcp start --no-figma` |
| Research design | Turns research stores and simulation reports into Atomic Design specs and FigJam-ready source. | `memi research design --write-specs --mermaid-jam` |

## Why teams install it

Modern UI agents can write code, but they usually do not know the product system. memi gives them the missing context before the patch:

- Which tokens and components already exist.
- Which routes, states, and screenshots define the current interface.
- Which UX issues are evidence-backed, not taste.
- Which interface craft dimensions need stronger hierarchy, rhythm, polish, or conventions.
- Which shadcn registry items can be exported or installed.
- Which research evidence should change the spec.
- Which agent harness should receive which memory.
- Which artifacts prove the change was safe.

The wedge is simple: run memi before broad frontend work so every agent starts from the product system instead of a blank prompt.

## The mandate loop

v2.3 turns memi from an audit you can run into a gate a team can require. Every finding cites `file:line` and re-runs identically — checkers check, gates gate, and no LLM sits in the enforcement path.

```bash
memi init --team     # committed policy + loudly-accepted baseline + gitignore rules + agent kit
memi ci              # full-tree scan, PR-scoped blame, SARIF annotations, step summary — exit 1 on new debt
memi baseline status # accepted debt stays visible while it burns down
memi report --badge  # one self-contained design-health.html + SVG badge
```

- **Deterministic**: same commit + same `memoire.policy.json` = same result. Scores stamp the policy hash; runs under different rules are reported "not comparable" instead of pretending.
- **Fair to PRs**: whole-tree stats keep ratio thresholds valid, but a PR is only blamed for files it touched. Aggregate rules gate through score budgets, never per-file blame.
- **Honest by construction**: baselines suppress loudly (counts in every report), unassessable dimensions say "not-assessed" instead of inventing a score, and every finding carries provenance (`static-scan` today).

One workflow line wires it into GitHub: `uses: sarveshsea/memi@v2` — SARIF PR annotations, a score summary, and a report artifact. Recipes for every other CI in [docs/CI_RECIPES.md](docs/CI_RECIPES.md); the rollout path for teams in [docs/TEAM_ROLLOUT.md](docs/TEAM_ROLLOUT.md).

## Public proof repo

Use [`sarveshsea/design-sandbox`](https://github.com/sarveshsea/design-sandbox) as the reference workspace for memi v2. It is a small Next.js 16 + Tailwind 4 + shadcn repo wired with MCP, Agent Skills, Claude Code subagents, `memoire.agent.yaml`, UX audit commands, token extraction, and no-hex verification.

```bash
git clone https://github.com/sarveshsea/design-sandbox.git
cd design-sandbox
pnpm install
npm i -g @memi-design/cli
pnpm memi:agent
pnpm memi:diagnose
pnpm memi:ux
memi craft audit . --json
pnpm verify
```

This is the public "show me how it works in a real repo" path for design engineers, product teams, and agent-stack builders.

## Agent stack installs

```bash
memi suite init --project .
memi daemon start --project . --port auto
memi daemon status --json
memi agent brief . --intent "Improve this interface" --json

memi agent install universal --project .
memi agent install hermes
memi agent install openclaw --project .
memi agent install claude-code --project .
memi agent install cursor --project .
memi agent install codex
memi agent install codex-plugin
memi agent install opencode --project .

npx skills add sarveshsea/memi --skill memoire-design-tooling
```

| Stack | Install path | What to use it for |
| --- | --- | --- |
| Universal Agent Skills | `.agents/skills/memoire-design-tooling/SKILL.md` | Standard skill package for `.agents/skills` readers and ECC-style AGENTS.md workflows. |
| Hermes | `~/.hermes/skills/memoire/memoire-design-tooling/SKILL.md` | Transcript-first product design runs with design memory and research context. |
| OpenClaw | `<workspace>/skills/memoire/memoire-design-tooling/SKILL.md` | Workspace-local design evidence, UI audit, and shadcn registry workflows. |
| Claude Code | `.mcp.json` | Project MCP config for `memi mcp start --no-figma`. |
| Cursor | `.cursor/mcp.json` | Cursor MCP config for token, registry, and UX inspection. |
| Codex skill | `~/.codex/skills/memoire/memoire-design-tooling/SKILL.md` | Skill-only context for design audits and frontend changes. |
| Codex plugin | `~/plugins/memoire` plus marketplace entry | Full Codex plugin with bundled skill and MCP wiring. |
| OpenCode | `.opencode/skills/memoire/memoire-design-tooling` | Workspace skill pack for local frontend agents. |

Public Codex marketplace install:

```bash
codex plugin marketplace add sarveshsea/memi --ref main --sparse .agents/plugins --sparse plugins/memoire
```

More copy-paste workflows: [Agent stack guide](docs/AGENT_STACKS.md) and [Agent recipes](docs/AGENT_RECIPES.md).

## Design-agent brief

Use this as the first command when an agent is about to touch UI:

```bash
memi agent brief . --intent "Polish the onboarding flow" --json
memi agent brief http://localhost:3000 --intent "Audit the dashboard route" --json
memi agent brief . --mode research --intent "Design from interview findings" --json
memi agent brief https://example.com --mode full --agent hermes --intent "Benchmark this interface" --json
```

The brief is local-first by default. It returns the mission, evidence commands, design rules, cost controls, compatibility installs, MCP command, Agent Skills command, and final handoff checklist. MCP clients can request the same object through `prepare_design_agent_brief`.

## Full interface understanding loop

```bash
memi agent brief http://localhost:3000 --intent "Improve this route" --json
memi diagnose http://localhost:3000
memi ux audit http://localhost:3000 --json
memi craft audit http://localhost:3000 --json
memi design-doc http://localhost:3000 --spec
memi tokens --from ./src --save --report
memi shadcn doctor
memi shadcn export --out public/r
memi suite run design-audit --project . --json
```

The loop reads code, runtime routes, screenshots, tokens, specs, research memory, and Figma when available. It writes file-backed evidence under `.memoire/`, then agents can use that evidence to plan, implement, and verify UI changes.

Read the full protocol: [Interface Understanding](docs/INTERFACE_UNDERSTANDING.md).

## Research-backed product design

```bash
memi research synthesize
memi simulate plan --hypothesis "Evidence-linked acceptance criteria reduce launch risk" --json
memi simulate run-matrix --adapter local --hypothesis "Faster setup reduces churn" --json
memi research design --intent "Design an evidence-backed planning board" --json
memi research design --write-specs --mermaid-jam --json
memi mermaid-jam export --from research --json
```

Use this when a product change should be grounded in user research, interviews, survey data, support notes, competitive analysis, or scenario simulations. memi keeps the boundary explicit: research evidence -> design package -> Atomic Design specs -> FigJam-ready source -> codegen only after approval.

## shadcn registry workflows

```bash
memi tokens --from ./src --report
memi shadcn export --out public/r
memi publish --name @you/ds
memi add Button --from @you/ds
```

Install through shadcn or v0:

```bash
npx shadcn@latest add https://your-site.com/r/button.json
memi shadcn serve --port 4014
```

Featured example registries live in [examples](examples/README.md), including SaaS, docs, dashboard, auth, AI chat, ecommerce, landing page, and tweakcn-inspired themes.

## Figma and FigJam

```bash
memi connect
memi pull
memi tokens
memi research design --write-specs --mermaid-jam --open --json
```

Figma is optional. Most teams can start with code, screenshots, and routes. When Figma is connected, memi adds token pulls, component inspection, screenshots, and FigJam-ready planning artifacts to the same evidence loop.

## memi Studio

The macOS app lives in [sarveshsea/memi-studio](https://github.com/sarveshsea/memi-studio). This npm package owns the engine/runtime it embeds: MCP tools, agent kits, harness metadata, project memory, the Figma bridge, research workflows, and local Studio web/TUI compatibility.

```bash
memi studio web --port 1422
memi studio tui
memi studio logs --follow
memi studio run --harness codex --action design-doc --prompt "Audit this UI and generate a design spec"
```

Install the signed app:

```bash
brew install --cask sarveshsea/memi/memi-studio
```

Studio interface references and adapted components are documented in [NOTICE](NOTICE). The public reference set includes Hermes WebUI, Hermes Agent, and the MIT Warp UI framework boundary around `warpui_core` and `warpui`; Warp AGPL application/client code is not copied into memi.

## What ships in the package

| Path | Why it is included |
| --- | --- |
| `dist/` | CLI and MCP runtime. |
| `server.json` | Official MCP Registry descriptor for `io.github.sarveshsea/memi`. |
| `skills/memoire-design-tooling/` | Standard Agent Skills package for `npx skills add`. |
| `agent-kits/` | Native kit templates for Hermes, OpenClaw, Codex, OpenCode, Claude Code, Cursor, and universal skills. |
| `plugins/memoire/` | Codex plugin bundle and skill wiring. |
| `plugin/` | Explicit Figma plugin assets, installed only through user commands. |
| `notes/` | Built-in research, agent, design, and integration notes. |
| `docs/` | Package docs for interface understanding, agent stacks, release gates, and growth operations. |
| `assets/` | Registry catalog and visual proof assets. |

## Trust defaults

- No npm install-time lifecycle scripts.
- Figma plugin installation is explicit with `memi setup plugin`.
- The default packaged Figma plugin disables raw JavaScript execution.
- MCP startup has a Figma-independent mode: `memi mcp start --no-figma`.
- Agent kit installs support `--dry-run --json` before writing files.
- Public package gates check release metadata, tarball size, production audit, MCP smoke, Codex plugin smoke, skills install discovery, and npm publish dry-run.

## Docs map

| Start here | When you need |
| --- | --- |
| [Quickstart](docs/README.md) | The shortest path from install to proof. |
| [Team Rollout](docs/TEAM_ROLLOUT.md) | Zero to a shared, enforced design gate: policy, baseline, CI, debt burn-down. |
| [CI Recipes](docs/CI_RECIPES.md) | `memi ci`, the GitHub Action, SARIF annotations, and non-GitHub CI wiring. |
| [Private Registry](docs/PRIVATE_REGISTRY.md) | Ship your design system on infra you control; DTCG token interop. |
| [Interface Understanding](docs/INTERFACE_UNDERSTANDING.md) | The full evidence loop for UI agents. |
| [Agent Stacks](docs/AGENT_STACKS.md) | ECC, Hermes, OpenClaw, Codex, Claude Code, Cursor, OpenCode, MCP, and skills workflows. |
| [Agent Recipes](docs/AGENT_RECIPES.md) | Copy-paste prompts and setup commands. |
| [Examples](examples/README.md) | Installable registry examples and preset catalogs. |
| [Public Repos](docs/PUBLIC_REPOS.md) | Public proof repos, hashtags, GitHub topics, and distribution surfaces. |
| [v2 Positioning](docs/V2_PACKAGE_POSITIONING.md) | Category, distribution, and package-quality strategy. |
| [Growth to 1M](docs/GROWTH_TO_1M_NPM.md) | Operating plan for npm growth. |
| [Release Gates](docs/RELEASE_GATES.md) | Publish and public-release checks. |
| [Proof](docs/PROOF.md) | No-Figma proof examples. |

## Full command reference

<details>
<summary><strong>Core commands</strong></summary>

| Command | What it does |
| --- | --- |
| `memi init --team` | One-command shared design gate: policy, baseline, gitignore, agent kit. |
| `memi ci` | CI design gate: scan, PR scope, baseline filter, SARIF + step summary. |
| `memi baseline accept|status` | Accept existing debt loudly; watch it burn down. |
| `memi report --badge` | Compose one self-contained design-health artifact + SVG badge. |
| `memi diagnose [target]` | Diagnose UI debt from code, route, or URL. |
| `memi ux audit [target]` | Audit UX tenet coverage and trap risks. |
| `memi craft audit [target]` | Audit interface craft across visual design, hierarchy, conventions, and user context. |
| `memi tokens --from <path-or-url>` | Extract tokens, modes, aliases, repeated literal candidates, and reports. |
| `memi shadcn export --out public/r` | Export shadcn registry files. |
| `memi design-doc <url>` | Extract a design system from a route or public URL. |
| `memi spec <type> <name>` | Create component, page, dataviz, design, or IA specs. |
| `memi generate [name]` | Generate React + TypeScript + Tailwind from specs. |
| `memi research synthesize` | Synthesize research data into themes and personas. |
| `memi research design` | Generate research-backed design packages and specs. |
| `memi simulate <subcommand>` | Run product scenario simulations. |
| `memi mermaid-jam export` | Write FigJam-ready Mermaid/markdown source. |
| `memi agent install [target]` | Install agent kits and MCP config. |
| `memi mcp start --no-figma` | Start the MCP server for registry-safe clients. |
| `memi suite init|doctor|run` | Manage `memoire.agent.yaml` and product-team recipes. |
| `memi daemon start|status|stop` | Warm shared local runtime context. |
| `memi studio web|tui|logs|run` | Run the local Studio compatibility surfaces. |

</details>

## Install without npm

```bash
curl -fsSL https://memoire.cv/install.sh | sh
irm https://memoire.cv/install.ps1 | iex
brew install sarveshsea/memi/memoire
docker run --rm -it -v "$PWD:/work" -w /work ghcr.io/sarveshsea/memi --help
```

Manual archives are attached to [GitHub Releases](https://github.com/sarveshsea/memi/releases/latest). Keep `skills/`, `notes/`, `plugin/`, and runtime resources next to the binary because memi loads them at runtime.

## License

MIT. See [NOTICE](NOTICE) for Studio interface references, optional adapters, and attribution notes.
