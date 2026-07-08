# GitHub Achievement Growth Plan

This tracker keeps achievement work tied to real memi distribution. The goal is to earn profile credibility without creating spam, fake stars, fake accounts, or low-quality pull requests.

## Rules

- Use external repositories only for useful submissions, fixes, docs, or directory listings.
- Use the sandbox repository only for harmless GitHub workflow achievement tests.
- Do not ask for fake stars or use alternate accounts to inflate stars.
- Do not submit low-effort PRs to farm Pull Shark.
- Keep every accepted PR linked to a real memi distribution or ecosystem improvement.

## Current Baseline

| Item | Status | Next action |
| --- | --- | --- |
| memi repo stars | 17 | Base Starstruck tier crossed; grow through useful launches and directory distribution |
| memi discussions | Enabled on GitHub | `Q&A` and `Show and tell` are active; add `Registry help` and `MCP setup` in repository settings |
| npm latest | 2.3.1 | Keep npm, site, GitHub release, and registry surfaces synchronized |
| GitHub release | `v2.3.1` created | Use release URL in directory follow-ups when traceability matters |
| MCP Registry | Listed but stale at `1.1.1` | Refresh `mcp-publisher` auth and publish the validated `2.3.1` `server.json` |
| SafeSkill PR | Open with blocked badge | Do not merge until the score improves or findings are addressed |
| Sandbox repo | `sarveshsea/memoire-achievements-lab` | Use only for harmless workflow checks |
| GitHub metadata | Updated to v2 interface-understanding copy | Keep npm, README, and directory copy aligned |

## Achievement Targets

| Achievement | Legit path | Target | Status | Links |
| --- | --- | --- | --- | --- |
| Public Sponsor | Sponsor one OSS maintainer whose work supports memi | Base badge | Pending | Add sponsor link after completion |
| Quickdraw | Open and close a sandbox issue or PR within 5 minutes | Base badge | Completed in sandbox | https://github.com/sarveshsea/memoire-achievements-lab/issues/1 |
| YOLO | Merge a tiny own PR in the sandbox repo without review | Base badge | Completed in sandbox | https://github.com/sarveshsea/memoire-achievements-lab/pull/2 |
| Pull Shark | Submit real PRs to MCP, shadcn, docs, and awesome-list directories | x2 first, then x3 | In progress | Merged: https://github.com/punkpeye/awesome-mcp-servers/pull/4373, https://github.com/toolsdk-ai/toolsdk-mcp-registry/pull/296, https://github.com/birobirobiro/awesome-shadcn-ui/pull/493; pending: https://github.com/TensorBlock/awesome-mcp-servers/pull/455, https://github.com/YuzeHao2023/Awesome-MCP-Servers/pull/208, https://github.com/MobinX/awesome-mcp-list/pull/241, https://github.com/bytefer/awesome-shadcn-ui/pull/18 |
| Pair Extraordinaire | Merge real coauthored PRs with valid `Co-authored-by:` trailers | Base, then x2 | Pending | Use actual collaborator commits only |
| Galaxy Brain | Answer real GitHub Discussions questions and have them accepted | Base, then x2 | Pending | Requires Discussions enabled |
| Starstruck | Earn real stars from distribution, demos, and useful listings | 16 stars, then 128 | Base crossed, next pending | Track weekly in `docs/METRICS.md` |

## Starstruck Sprint

Detailed operating board: [`docs/STARSTRUCK.md`](STARSTRUCK.md).

Immediate sequence:

1. Refresh `mcp-publisher` auth and publish `server.json` so the official MCP Registry reports `2.3.1`.
2. Submit MCP.Directory, refresh Glama, submit Smithery, confirm PulseMCP and mcp.so.
3. Refresh `sarveshsea/design-sandbox` proof and make `pnpm verify` the public demo anchor.
4. Follow up on open directory PRs only with the official registry link or maintainer-requested fixes.
5. Post the 60-second install/demo with a GitHub star CTA.

## Official MCP Registry Readiness

The official MCP Registry verifies npm package ownership through `package.json#mcpName`. npm `2.3.1` and `server.json` agree on the MCP name and package identifier.

- `package.json#mcpName`: `io.github.sarveshsea/memi`
- `server.json#name`: `io.github.sarveshsea/memi`
- `server.json#version`: `2.3.1`
- `server.json#packages[0].identifier`: `@memi-design/cli`
- `server.json#packages[0].packageArguments`: `mcp start --no-figma`

After `mcp-publisher login github` succeeds, run:

```bash
mcp-publisher validate server.json
mcp-publisher publish server.json
```

## Discussion Categories To Configure

GitHub category forms live in `.github/DISCUSSION_TEMPLATE/`, but categories themselves must exist in the repository settings before the forms are used. GitHub created `Q&A` and `Show and tell` when Discussions were enabled. Add the remaining categories in the GitHub UI:

| Category | Suggested slug | Format | Purpose |
| --- | --- | --- | --- |
| Q&A | `q-a` | Question and answer | Active |
| Show and tell | `show-and-tell` | Open-ended discussion | Active |
| Registry help | `registry-help` | Question and answer | Add in UI |
| MCP setup | `mcp-setup` | Question and answer | Add in UI |

## Weekly Review

Run this review every Friday during the v2 growth window:

1. Count accepted directory PRs and update Pull Shark progress.
2. Count accepted discussion answers and update Galaxy Brain progress.
3. Record GitHub stars, npm weekly downloads, and accepted directory links.
4. Identify the one directory or post that sent the most qualified traffic.
5. Choose the next 3 useful external PRs. Do not create filler PRs.

Quick status command:

```bash
npm run growth:status
```

## Copy Blocks

### One-line description

```text
memi gives AI coding agents interface understanding before frontend work: UX audits, Tailwind tokens, shadcn registries, MCP tools, Agent Skills, and design-system memory.
```

### Install block

```bash
npm i -g @memi-design/cli
memi diagnose
memi ux audit --json
memi shadcn export --out public/r
memi mcp start --no-figma
```

### Directory submission pitch

```text
memi gives AI coding tools a local interface-understanding workflow. It runs as a CLI and MCP server, audits existing Tailwind/shadcn apps, extracts tokens, exports shadcn-compatible registries, and installs Agent Skills so frontend agents start from real design-system evidence.
```
