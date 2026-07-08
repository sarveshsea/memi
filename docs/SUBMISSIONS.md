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
| P0 | Product Hunt | Launch | Ready after current surfaces stay green | Submit with Studio-first copy and engine-underneath reply |
| P0 | Official MCP Registry | MCP directory | Listed for `io.github.sarveshsea/memi@2.3.1` | Use as trust proof in MCP directory refreshes |
| P0 | npm | CLI distribution | `@memi-design/cli@2.3.1` live | Keep public release gate green after web deploys |
| P0 | GitHub Releases | Traceability | `v2.3.1` tag/release exists | Link release in directory follow-ups |
| P0 | Codex plugin | Agent distribution | Sparse checkout smoke passes locally | Keep marketplace command in launch replies |
| P0 | design-sandbox | Public proof repo | Local clone updated for memi v2 | Link as the runnable example for design engineers |
| P1 | Glama / MCP directories | MCP discovery | Some listings still use Memoire-era copy | Refresh to memi workbench + design-memory engine copy |
| P1 | Awesome MCP lists | Ecosystem discovery | Several older PRs merged/open | Refresh only where maintainers accept updates |
| P1 | shadcn / v0 communities | Engine proof | Secondary to Product Hunt | Share CLI workflow after launch spike |
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
AI workbench for product designers
```

Description:

```text
Run Codex or Claude Code with project memory, design-system context, receipts, and Figma/FigJam handoff in one signed macOS app.
```

URL:

```text
https://www.memoire.cv
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

Title: `Show HN: memi, an AI workbench for product designers`

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

## Submission Checklist

- [x] Publish npm `2.3.1`.
- [x] Verify `npm run check:public-release`.
- [x] Republish `server.json` to the Official MCP Registry.
- [x] Create GitHub tag/release `v2.3.1`.
- [ ] Push the updated `sarveshsea/design-sandbox` proof repo.
- [ ] Submit Product Hunt.
- [ ] Post X/Twitter launch thread.
- [ ] Refresh Glama/MCP directory copy where editable.
- [ ] Post practical MCP setup to `r/mcp`.
- [ ] Publish Studio + CLI tutorial.
