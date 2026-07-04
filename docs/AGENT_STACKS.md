# Agent Stacks

Memoire v2 treats agent support as a package surface, not an afterthought. The same design evidence can be installed into universal Agent Skills, ECC-style repositories, Hermes, OpenClaw, Codex, Claude Code, Cursor, OpenCode, and MCP clients.

## First command

```bash
npm i -g @memi-design/cli
memi agent brief . --intent "Prepare this repo for design-agent work" --json
memi agent install --dry-run --json
```

Use the brief first when an agent is about to touch UI; it returns evidence commands, design rules, cost controls, compatibility installs, and handoff requirements. Use the install dry run when setting up a team repo. It shows every file memi would write before changing the workspace.

## Stack matrix

| Stack | Install | Output | Best use |
| --- | --- | --- | --- |
| Universal Agent Skills | `memi agent install universal --project .` | `.agents/skills/memoire-design-tooling/SKILL.md` | Agents that read standard project skills. |
| Agent Skills ecosystem | `npx skills add sarveshsea/memi --skill memoire-design-tooling` | Installed `memoire-design-tooling` skill | Shareable package install path for skill-first users. |
| Design-agent brief | `memi agent brief . --json` | JSON preflight contract | Any agent that needs evidence commands, cost controls, compatibility installs, and handoff rules before UI edits. |
| ECC / AGENTS.md stacks | `memi agent install universal --project .` | `.agents/skills` plus local AGENTS.md instructions | Repos that use strict workflow rules, subagents, TDD, security review, and release gates. |
| Hermes | `memi agent install hermes` | `~/.hermes/skills/memoire/memoire-design-tooling/SKILL.md` | Transcript-first design runs, product workbench flows, and research-aware UI work. |
| OpenClaw | `memi agent install openclaw --project .` | `<workspace>/skills/memoire/memoire-design-tooling` | Workspace-local agent adoption and ClawHub-style skill distribution. |
| Claude Code | `memi agent install claude-code --project .` | `.mcp.json` | Project MCP server approval and design-system tools. |
| Cursor | `memi agent install cursor --project .` | `.cursor/mcp.json` | Editor-native MCP access to token, registry, and audit tools. |
| Codex skill | `memi agent install codex` | `~/.codex/skills/memoire/memoire-design-tooling` | Skill-only Codex workflows. |
| Codex plugin | `memi agent install codex-plugin` | `~/plugins/memoire` and marketplace entry | Full Codex plugin with MCP wiring. |
| OpenCode | `memi agent install opencode --project .` | `.opencode/skills/memoire/memoire-design-tooling` | Local workspace skill pack for frontend agents. |
| Generic MCP client | `memi mcp start --no-figma` | stdio MCP server | Registry-safe design tools without Figma. |

## ECC workflow

Everything Claude Code style repos usually enforce planning, TDD, code review, security review, and release gates through `AGENTS.md`. memi should be installed as the design evidence layer inside that process:

```bash
memi suite init --project .
memi agent install universal --project .
memi agent brief . --intent "Improve this interface" --json
memi diagnose .
memi ux audit . --json
memi craft audit . --json
memi tokens --from ./src --report
memi suite run design-audit --project . --json
```

Recommended AGENTS.md rule:

```text
Before broad UI edits, run Memoire evidence collection: memi diagnose, memi ux audit, memi craft audit, and memi tokens --from ./src --report. Use the resulting artifacts to plan Atomic Design changes and cite the verification commands in the final handoff.
```

Stronger rule:

```text
Before broad UI edits, run `memi agent brief . --intent "<task>" --json`, then run the evidence commands from the brief. Treat the brief as the cost, compatibility, and handoff contract.
```

Reference repo: [`sarveshsea/design-sandbox`](https://github.com/sarveshsea/design-sandbox) shows this pattern with `AGENTS.md`, `.agents/skills/memoire-design-tooling`, `.mcp.json`, `memoire.agent.yaml`, and `pnpm verify`.

## Hermes workflow

```bash
memi agent install hermes
memi agent brief . --agent hermes --intent "Audit this interface" --json
memi daemon start --project . --port auto
memi suite run design-audit --project . --json
```

Use Hermes when the run benefits from transcript-first supervision, local receipts, research memory, and a calmer product workbench.

## Codex workflow

```bash
memi agent install codex
memi agent install codex-plugin
memi agent brief . --agent codex --intent "Prepare a UI patch plan" --json
codex plugin marketplace add sarveshsea/memi --ref main --sparse .agents/plugins --sparse plugins/memoire
```

Recommended prompt:

```text
Use the Memoire skill before frontend changes. Run memi diagnose, memi ux audit, memi craft audit, and memi tokens when UI quality, Tailwind, shadcn/ui, accessibility, component registry, screenshot critique, or Figma context matters. Ground the final answer in Memoire evidence.
```

## Claude Code and Cursor MCP workflow

```bash
memi agent install claude-code --project .
memi agent install cursor --project .
memi agent brief . --agent claude-code --intent "Prepare MCP design context" --json
memi mcp start --no-figma
```

The project MCP config points clients at the Figma-independent server. Figma can be added later with `memi connect`; it is not required for app-quality work.

## OpenClaw and OpenCode workflow

```bash
memi agent install openclaw --project .
memi agent install opencode --project .
memi suite init --project .
```

Use this when the project should carry its own skill pack in the workspace, especially for teams that want repeatable local setup across multiple agents.

## Shared daemon and suite manifest

```bash
memi suite init --project .
memi daemon start --project . --port auto
memi daemon status --json
memi suite doctor --project . --json
```

`memoire.agent.yaml` is the shared contract. It declares product memory, harnesses, installed skills, recipes, and expected evidence sources so agents do not rebuild context on every run.

## Safety defaults

- Use `--dry-run --json` before writing agent kits in shared repos.
- Treat external skills and generated code as untrusted until reviewed.
- Do not paste secrets into prompts, logs, or research files.
- Prefer `memi mcp start --no-figma` for registry crawlers and clients that do not need desktop Figma.
- Keep final handoffs grounded in commands, artifacts, and changed files.
