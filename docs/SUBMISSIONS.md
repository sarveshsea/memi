# Distribution Submissions

Use this as the operating board for Product Hunt and real directory work. Every entry should improve memi discovery or trust.

## Canonical Positioning

```text
memi is the AI workbench for product designers: run Codex or Claude Code with project memory, design-system context, receipts, and Figma/FigJam handoff in one signed macOS app.
```

## Primary Paths

macOS app:

```bash
brew install --cask sarveshsea/memi/memi-studio
```

CLI / MCP engine:

```bash
npm i -g @memi-design/cli
memi diagnose
memi ux audit --json
memi mcp start --no-figma
```

Codex plugin:

```bash
codex plugin marketplace add sarveshsea/memi --ref main --sparse .agents/plugins --sparse plugins/memoire
```

## Directory Matrix

| Priority | Target | Lane | Status | Next action |
| --- | --- | --- | --- | --- |
| P0 | Product Hunt | Launch | Ready after `1.1.1` publish | Submit with Studio-first copy and homepage CTA |
| P0 | Official MCP Registry | MCP directory | Listed for `io.github.sarveshsea/memi` | Republish `server.json` after npm `1.1.1` |
| P0 | npm | CLI distribution | `@memi-design/cli@1.1.1` release target | Publish and run public release gate |
| P0 | GitHub Releases | Traceability | Missing `v1.1.1` tag until release | Create tag/release after publish |
| P0 | Codex plugin | Agent distribution | Sparse checkout smoke passes locally | Keep marketplace command in launch replies |
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
Design-memory MCP server and CLI behind the memi AI workbench for product designers.
```

### MCP Directory Description

```text
memi gives AI coding tools design-system memory before frontend work. The CLI and MCP server expose UI diagnosis, UX tenet audits, token extraction, shadcn registry context, Figma-aware workflows, and agent kits for Codex, Claude Code, Cursor, OpenCode, Hermes, and OpenClaw.
```

### Codex Plugin Description

```text
memi gives Codex design-system memory, MCP tools, Tailwind and shadcn diagnostics, Atomic Design guidance, and research-backed UX audit workflows before frontend edits.
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
  memi mcp start --no-figma

The wedge is supervised design-aware agent runs. I want product designers to see what context went in, what happened during the run, and what should be kept after the session ends.

https://www.memoire.cv
https://github.com/sarveshsea/memi
```

## Submission Checklist

- [ ] Publish npm `1.1.1`.
- [ ] Verify `npm run check:public-release`.
- [ ] Republish `server.json` to the Official MCP Registry.
- [ ] Create GitHub tag/release `v1.1.1`.
- [ ] Submit Product Hunt.
- [ ] Post X/Twitter launch thread.
- [ ] Refresh Glama/MCP directory copy where editable.
- [ ] Post practical MCP setup to `r/mcp`.
- [ ] Publish Studio + CLI tutorial.
