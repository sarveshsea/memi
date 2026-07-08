# Starstruck And Distribution Plan

Goal: keep GitHub growth tied to useful memi distribution. The base Starstruck tier is now crossed: `sarveshsea/memi` had `17` stars on 2026-07-08. The next honest target is sustained npm activation, then the `128` star tier.

## Current Reality

| Surface | Status | Meaning |
| --- | --- | --- |
| GitHub stars | `17` | Starstruck base tier crossed; next visible tier is `128` |
| GitHub description | Updated | `Interface understanding and design-system memory for AI coding agents.` |
| npm latest | `2.3.1` | Live on npm with `mcpName: io.github.sarveshsea/memi` |
| npm downloads | `783` weekly, `1,306` monthly | Latest complete npm windows on 2026-07-08 |
| 10x npm checkpoint | `7,830` weekly, `13,060` monthly | First growth target from the 2026-07-08 baseline |
| Official MCP Registry | Listed but stale | Registry latest is still `1.1.1`; `server.json` validates at `2.3.1`, publish is blocked until registry auth is refreshed |
| `memoire.cv` | Synced | Public release gate passes against npm, site, changelog, Studio `2.4.0`, and five community Notes |
| Open shadcn PRs | `1` | `bytefer/awesome-shadcn-ui#18`; `birobirobiro/awesome-shadcn-ui#493` merged |
| Open MCP PRs | `3` | TensorBlock, YuzeHao2023, and MobinX remain open; toolsdk merged |

## Star CTA

Use one ask everywhere:

```text
If this saves you from rebuilding the same shadcn/Tailwind system again, star the repo so more frontend teams can find it:
https://github.com/sarveshsea/memi
```

Do not ask for fake stars, star swaps, or bot engagement. The ask must sit after a demo, install command, or useful directory submission.

## First Move: Refresh MCP Discovery

The official MCP Registry already lists `io.github.sarveshsea/memi`, but its latest package version is stale at `1.1.1`. The repo `server.json` is valid for `2.3.1`; publishing currently needs a fresh `mcp-publisher login github` device authorization.

Run after auth is refreshed:

```bash
mcp-publisher validate server.json
mcp-publisher publish server.json
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.sarveshsea/memi"
```

Why this matters: the official registry is a trust anchor for downstream MCP directories and aggregators. Once it shows `2.3.1`, submit or refresh every MCP directory with the same npm/GitHub links.

## Directory Targets

| Priority | Target | Why it matters | Route | Status |
| --- | --- | --- | --- | --- |
| P0 | Official MCP Registry | Trust anchor for downstream MCP aggregators | `mcp-publisher publish server.json` | Listed, stale at `1.1.1`; auth refresh needed |
| P0 | MCP.Directory | Direct MCP discovery surface | `https://mcp.directory/submit` | Refresh after registry shows `2.3.1` |
| P0 | Glama | Already indexes Memoire | Claim/update listing after registry refresh | Ready |
| P0 | Smithery | Distribution, analytics, and config UI for MCP servers | `smithery.ai/new` or `smithery mcp publish` | Requires URL/MCPB decision |
| P0 | PulseMCP | MCP discovery and server popularity tracking | Confirm auto-index after official registry | Ready |
| P0 | mcp.so | Large MCP marketplace surface | Submit/refresh after official registry | Ready |
| P1 | Agent Skills directories | Agent-native install discovery | `npx skills add sarveshsea/memi --skill memoire-design-tooling` | Ready |
| P1 | shadcn registry directories | Registry generator audience | PR with `memi shadcn export --out public/r` proof | Needs stable public registry URLs |
| P2 | Product Hunt | One-time launch spike | Launch after registry and proof repo are current | Draft only |
| P2 | Show HN | Developer credibility | Post practical demo, not hype | Draft only |
| P2 | Reddit `r/mcp` | Direct MCP audience | Practical setup/demo | Draft only |
| P2 | Reddit `r/shadcn` | Direct registry audience | Registry export demo | Draft only |

## GitHub PR Targets

| Priority | Repo | Stars at audit | Fit | Status |
| --- | --- | ---: | --- | --- |
| P0 | `punkpeye/awesome-mcp-servers` | `85k+` | Largest MCP list | Merged: https://github.com/punkpeye/awesome-mcp-servers/pull/4373 |
| P0 | `TensorBlock/awesome-mcp-servers` | `639` | MCP list with developer utility category | Open, requested docs mirror fixed: https://github.com/TensorBlock/awesome-mcp-servers/pull/455 |
| P0 | `YuzeHao2023/Awesome-MCP-Servers` | `1041` | MCP list with development tools category | Open: https://github.com/YuzeHao2023/Awesome-MCP-Servers/pull/208 |
| P0 | `MobinX/awesome-mcp-list` | `878` | Concise MCP list with developer tools category | Open: https://github.com/MobinX/awesome-mcp-list/pull/241 |
| P0 | `toolsdk-ai/toolsdk-mcp-registry` | `169` | Structured MCP registry JSON | Merged: https://github.com/toolsdk-ai/toolsdk-mcp-registry/pull/296 |
| P1 | `bytefer/awesome-shadcn-ui` | `683` | shadcn ecosystem list | Open: https://github.com/bytefer/awesome-shadcn-ui/pull/18 |
| P1 | `birobirobiro/awesome-shadcn-ui` | `19k+` | Largest shadcn ecosystem list | Merged: https://github.com/birobirobiro/awesome-shadcn-ui/pull/493 |
| P1 | `appcypher/awesome-mcp-servers` | `5492` | MCP list with development tools category | Branch pushed, PR creation blocked by base permissions: https://github.com/appcypher/awesome-mcp-servers/compare/main...sarveshsea:awesome-mcp-servers-2:add-memoire-design-ci |
| P1 | `wong2/awesome-mcp-servers` | `4005` | MCP list with community servers category | Branch pushed, PR creation blocked by base permissions: https://github.com/wong2/awesome-mcp-servers/compare/main...sarveshsea:awesome-mcp-servers-1:add-memoire-design-ci |
| P2 | `react-figma/awesome-figma` | `430` | Figma/dev integration list | Wait until Figma positioning is not competing with code-first wedge |
| P2 | `klaufel/awesome-design-systems` | `843` | Developer-focused design systems list | Wait until website proof page is healthy |
| P2 | `gztchan/awesome-design` | `17k+` | Broad design resources | Do not submit unless there is a polished public article/demo |
| P2 | `RGB-Team/shadcn-registries` | `49` | shadcn registry directory | Wait for stable public registry URL |

## Launch Sequence For 10x Downloads

1. Refresh the official MCP Registry so it reports `2.3.1`.
2. Submit or refresh MCP.Directory, Glama, Smithery, PulseMCP, and mcp.so with the same v2 copy.
3. Refresh `sarveshsea/design-sandbox` so `pnpm verify` proves memi agent install, diagnose, UX audit, token extraction, and shadcn registry output.
4. Follow up on open PRs only with new proof: official registry link, security hardening, demo video, or maintainer-requested fixes.
5. Ship one 60-second terminal demo: install, `memi diagnose`, `memi ux audit --json`, `memi shadcn export`, `memi mcp start --no-figma`.
6. Post the demo to X, Show HN, `r/mcp`, and `r/shadcn` with the GitHub star CTA.
7. Recheck npm downloads and stars weekly in `docs/METRICS.md`.

## Demo Script

```bash
npm i -g @memi-design/cli
memi diagnose --no-write
memi ux audit --json
memi tokens --from ./src --report
memi shadcn export --out public/r
memi mcp start --no-figma
```

Narrative:

```text
Most AI UI tools help create the first draft. memi is for the app after that: diagnose the messy shadcn/Tailwind codebase, extract the token system, export a shadcn-native registry, and give Claude Code/Cursor/Codex the same design-system context through MCP.
```

## Follow-Up Rules

- Follow up on a PR only when there is new proof: official registry URL, npm patch, demo video, or CI fix.
- Do not ping maintainers repeatedly for achievements.
- Do not submit to broad design lists until the public website and registry examples are healthy.
- If a directory rejects memi as too broad, narrow the listing to the MCP server or shadcn registry export workflow.

## Sources

- Official MCP Registry publish flow: https://modelcontextprotocol.io/registry/quickstart
- MCP npm package verification: https://modelcontextprotocol.io/registry/package-types
- MCP.Directory submit form: https://mcp.directory/submit
- Smithery publish flow: https://smithery.ai/docs/build/publish
- shadcn registry directory requirements: https://ui.shadcn.com/docs/registry/registry-index
- v0 design-system registry workflow: https://v0.app/docs/design-systems
