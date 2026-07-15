# Distribution Submissions

Use this as the operating board for Product Hunt and real directory work. Every entry should improve memi discovery, trust, or npm activation.

## Canonical Positioning

```text
memi is interface understanding for AI coding agents: UX audits, Tailwind tokens, shadcn registries, MCP tools, Agent Skills, research-backed specs, and Figma/FigJam handoff for product UI work.
```

## Primary Paths

NPM engine:

```bash
npm i -g @memi-design/cli
memi diagnose
memi ux audit --json
memi craft audit --json
memi tokens --from ./src --report
memi shadcn export --out public/r
```

MCP and agent skills:

```bash
memi mcp start --no-figma
npx skills add sarveshsea/memi --skill memoire-design-tooling
```

Codex plugin:

```bash
codex plugin marketplace add sarveshsea/memi --ref main --sparse .agents/plugins --sparse plugins/memoire
```

macOS app:

```bash
brew install --cask sarveshsea/memi/memi-studio
```

## Directory Matrix

| Priority | Target | Lane | Status | Next action |
| --- | --- | --- | --- | --- |
| P0 | Product Hunt | Launch | Ready after agent-design-CI surfaces stay green | Submit with v1 → v2.5 major-update proof and npm/MCP/Codex links |
| P0 | Official MCP Registry | MCP directory | Ready for `io.github.sarveshsea/memi@2.5.0` after npm publish | Use as trust proof in MCP directory refreshes |
| P0 | npm | CLI distribution | `@memi-design/cli@2.5.0` release candidate | Run the one-line npm publish command |
| P0 | GitHub Releases | Traceability | `v2.5.0` release target | Link release in directory follow-ups |
| P0 | Codex plugin | Agent distribution | Sparse checkout smoke passes locally | Keep marketplace command in launch replies |
| P0 | design-sandbox | Public proof repo | Pushed with `pnpm verify` proof loop | Link as the runnable example for design engineers |
| P1 | Glama / MCP directories | MCP discovery | mcp.so submitted; Glama/Smithery still need owner UI/API action after registry refresh | Refresh to memi workbench + design-memory engine copy |
| P1 | Awesome MCP lists | Ecosystem discovery | New update PRs opened for largest stale listings | Follow up only for maintainer requests or new v2.5 proof |
| P1 | shadcn / v0 communities | Engine proof | shadcn list PR opened with raw registry proof | Share CLI workflow after launch spike |
| P2 | Hacker News | Launch | Draft | Post only after Product Hunt assets are stable |
| P2 | Reddit `r/mcp` | Community | Draft | Share practical MCP setup, not launch hype |
| P2 | Dev.to / Hashnode | Tutorial | Draft | Write Studio + CLI walkthrough |

## Product Hunt Submission

Name:

```text
memi
```

Tagline:

```text
Agent design CI for AI coding agents
```

Description:

```text
Agent design CI for Codex, Claude, Cursor, Grok, and MCP clients: deterministic UI audits, Tailwind token extraction, shadcn registry context, compact design-agent briefs, and spec-first file scaffolds before agents edit UI.
```

URL:

```text
https://www.memoire.cv
```

Major update answer:

```text
The original memi launch was a v1 product-design workbench. v2.5 is now an agent design CI layer for AI coding agents: npm CLI, MCP server, Codex plugin, Claude/Cursor/Grok agent kits, GitHub Action, compact design-agent briefs, and spec-first Atomic Design scaffolds. The macOS Studio is now the companion workbench, not the whole product.
```

## Ready-To-Submit Entries

### MCP Directory One-Liner

```text
Interface-understanding MCP server and CLI for AI coding agents working on product UI.
```

### MCP Directory Description

```text
memi gives AI coding tools interface understanding before frontend work. The CLI and MCP server expose UI diagnosis, UX tenet audits, token extraction, shadcn registry context, research-backed specs, Figma-aware workflows, and agent kits for Codex, Claude Code, Cursor, OpenCode, Hermes, OpenClaw, and Agent Skills.
```

### Codex Plugin Description

```text
memi gives Codex design-system memory, MCP tools, Tailwind and shadcn diagnostics, Atomic Design guidance, and research-backed UX audit workflows before frontend edits.
```

### design-sandbox Description

```text
design-sandbox is the public proof repo for memi v2: a Next.js, Tailwind, shadcn, MCP, and Agent Skills workspace where agents run UX audits, token extraction, and no-hex verification before changing a sandbox UI.
```

### Show HN Post

Title: `Show HN: memi, an agent design CI layer for AI coding agents`

```text
I built memi, a signed macOS workbench for running Codex or Claude Code on product-design work.

It keeps the product context visible: project memory, design-system context, Figma/FigJam handoff, run receipts, logs, and artifacts.

The engine is also available as an npm package and MCP server:

  npm i -g @memi-design/cli
  memi diagnose
  memi ux audit --json
  memi craft audit --json
  memi mcp start --no-figma

The wedge is supervised design-aware agent runs. I want product designers to see what context went in, what happened during the run, and what should be kept after the session ends.

https://www.memoire.cv
https://github.com/sarveshsea/memi
https://github.com/sarveshsea/design-sandbox
```

## Live Distribution Links

| Surface | Link | Status |
| --- | --- | --- |
| design-sandbox proof repo | https://github.com/sarveshsea/design-sandbox | Pushed; pre-publish verification passes with local `MEMI_BIN` |
| design-sandbox raw shadcn registry | https://raw.githubusercontent.com/sarveshsea/design-sandbox/main/public/r/registry.json | Public proof artifact |
| mcp.so submission | https://github.com/chatmcp/mcpso/issues/1#issuecomment-4920418945 | Submitted with npm, MCP Registry, proof repo, and shadcn registry links |
| `punkpeye/awesome-mcp-servers` refresh | https://github.com/punkpeye/awesome-mcp-servers/pull/9678 | Open update from old repository naming to `memi` |
| `toolsdk-ai/toolsdk-mcp-registry` refresh | https://github.com/toolsdk-ai/toolsdk-mcp-registry/pull/391 | Open update from legacy npm naming to `@memi-design/cli` |
| `birobirobiro/awesome-shadcn-ui` refresh | https://github.com/birobirobiro/awesome-shadcn-ui/pull/538 | Open update from `memoire` to `memi` with registry proof |
| `YuzeHao2023/Awesome-MCP-Servers` proof comment | https://github.com/YuzeHao2023/Awesome-MCP-Servers/pull/208#issuecomment-4920420199 | Refresh again after v2.5 publish |
| `MobinX/awesome-mcp-list` proof comment | https://github.com/MobinX/awesome-mcp-list/pull/241#issuecomment-4920420336 | Refresh again after v2.5 publish |
| `bytefer/awesome-shadcn-ui` proof comment | https://github.com/bytefer/awesome-shadcn-ui/pull/18#issuecomment-4920420432 | Refresh again after v2.5 publish |

## Submission Checklist

- [x] Publish npm `2.5.0`.
- [ ] Verify `npm run check:public-release`.
- [x] Republish `server.json` to the Official MCP Registry.
- [x] Create GitHub tag/release `v2.5.0`.
- [x] Push the updated `sarveshsea/design-sandbox` proof repo.
- [ ] Submit Product Hunt.
- [ ] Post X/Twitter launch thread.
- [x] Submit mcp.so with current registry, proof repo, and package links.
- [x] Refresh stale MCP and shadcn directory PRs where editable.
- [ ] Refresh Glama/Smithery/MCP directory copy where owner UI/API action is required after registry refresh.
- [ ] Post practical MCP setup to `r/mcp`.
- [ ] Publish Studio + CLI tutorial.
