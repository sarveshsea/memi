# Growth To 1M Weekly NPM Downloads

Updated: 2026-05-13

## North Star

Get `@memi-design/cli` to 1,000,000 npm downloads per week by making the engine the thing people install, script, embed, and recommend. Studio should demonstrate the engine and make agent work calmer; it should not become the main product surface or the main source of complexity.

## Current Truth

- Public npm package: `@memi-design/cli@1.0.0`; local release branch: `1.0.1`.
- npm downloads: 128 in the last reported week, 2026-05-05 through 2026-05-11.
- Legacy alias: `@sarveshsea/memoire@0.18.0` still exists and receives more traffic than the new package.
- GitHub repo: `sarveshsea/memi`, 10 stars, 2 forks, 2 open issues.
- Studio repo: `sarveshsea/memi-studio`, public app repo with v1.0.0 release assets.
- Homebrew cask: `sarveshsea/homebrew-memi`, `memi-studio` cask at v1.0.0.
- Official MCP Registry: not listed for `io.github.sarveshsea/memi`.
- Active leak: old `m-moire` and `@sarveshsea/memoire` references confuse discovery, install paths, and trust.

Run the live check:

```bash
node scripts/growth-status.mjs --json
```

## Product Posture

The engine must be the default answer:

- `memi diagnose` for existing apps.
- `memi tokens --from ./src --report` for token extraction.
- `memi shadcn export --out public/r` for installable registries.
- `memi agent install ...` for agent-native design-system memory.
- `memi mcp start --no-figma` for MCP discovery.

The macOS app should be minimalist:

- One primary job: run and supervise agent harnesses clearly.
- Two primary harnesses: Codex and Claude Code.
- Everything else is advanced until users ask for it.
- Surfaces should collapse toward transcript, artifacts, status, and project memory.
- No feature earns first-screen space unless it helps the first successful engine-backed run.

## Growth Loops

1. Release correctness

Publish `1.0.1`, verify npm metadata, verify binary install URLs, and keep Homebrew formulas pointed at `sarveshsea/memi`.

2. Naming cleanup

Remove or quarantine stale `m-moire` and `@sarveshsea/memoire` references across docs, install scripts, package metadata, and the Studio repo. The old package should clearly redirect people to `@memi-design/cli`.

3. Registry distribution

Submit `server.json` to the Official MCP Registry once npm is current. Keep merged directory PRs accurate, close stale ones, and resubmit with the `memi` name where needed.

4. Agent-native adoption

Make Codex, Claude Code, Cursor, and shadcn/v0 workflows the shortest path in README examples. The README should sell the engine wedge before Studio.

5. Repeatable proof

Ship examples that users can run in under two minutes:

```bash
memi diagnose
memi tokens --from ./src --report
memi shadcn export --out public/r
```

## Milestone Ladder

- 1,000 weekly downloads: release/package/install paths are clean; README examples work from a fresh machine.
- 10,000 weekly downloads: MCP registry, shadcn/v0 examples, Codex plugin, and Homebrew paths all agree on naming.
- 100,000 weekly downloads: templates and starter registries are discoverable from npm, GitHub, and docs without Studio.
- 1,000,000 weekly downloads: downstream agents, templates, registries, and docs install `@memi-design/cli` as infrastructure.

## Keep The App Tidy

Do not let Studio compete with the engine. Treat it as a native workbench for the same runtime:

- Primary navigation: Workbench, Artifacts, Memory, Settings.
- Primary session path: choose harness, choose workspace, send prompt, watch events, review artifacts.
- Advanced drawers: marketplace, scenario lab, video, Figma, automations, local model setup.
- Default harness visibility: Codex and Claude Code only.
- Every advanced feature needs a CLI/runtime equivalent.

