# Release Gates

Use these checks before announcing, tagging, or publishing a public release.

## Local Publish-Ready Gate

`npm run publish:ready` verifies the local package is safe to publish before npm mutates anything:

- npm auth is active for `https://registry.npmjs.org/`.
- `package.json`, `package-lock.json`, `server.json`, Codex plugin metadata, examples, and package docs use the same version.
- Local version is newer than npm `latest`.
- `server.json`, `dist/index.js`, `README.md`, `NOTICE`, Agent Skills, agent kits, and selected docs are present in the package tarball.
- The git worktree is clean.

```bash
npm run build
npm run check:release
npm run smoke:mcp
npm run smoke:codex-plugin
npm run pack:dry-run
npm run publish:ready
```

For a local release-prep pass where npm auth or git cleanliness is intentionally blocked:

```bash
MEMOIRE_PUBLISH_READY_SKIP_AUTH=1 MEMOIRE_PUBLISH_READY_SKIP_GIT=1 npm run publish:ready
npm publish --dry-run --access public --ignore-scripts --json
```

## Public npm Gate

`npm run check:public-release` verifies the live npm surface after publish:

- npm `dist-tags.latest` matches `package.json`.
- npm README includes `Design-system memory for coding agents`.
- npm README includes `npm i -g @memi-design/cli`.
- A clean temp install can run `memi --version`.

```bash
npm run check:public-release
SKIP_INSTALL_SMOKE=1 npm run check:public-release
```

For the `2.0.0` line, npm must report `2.0.0` before MCP Registry, Codex marketplace announcements, Product Hunt, or directory follow-up.

## External Trust Gate

Before the public `2.0.0` announcement, verify every external surface points to the same v2 story:

- npm latest: `2.0.0`
- npm README phrase: `Interface understanding for AI coding agents`
- npm install command: `npm i -g @memi-design/cli`
- MCP name: `io.github.sarveshsea/memi`
- Agent Skills command: `npx skills add sarveshsea/memi --skill memoire-design-tooling`
- Codex marketplace command: `codex plugin marketplace add sarveshsea/memi --ref main --sparse .agents/plugins --sparse plugins/memoire`
- GitHub description: `Interface understanding and design-system memory for AI coding agents.`
- GitHub topics: `interface-understanding`, `design-system`, `shadcn-registry`, `tailwind-audit`, `ux-audit`, `mcp-server`, `agent-skills`, `codex-plugin`, `design-tokens`, `figma-to-code`
- Website hero: `Interface understanding for AI coding agents.`
- Website `/components`: non-empty registry catalog with npm install commands and shadcn item URLs

## Publish Sequence

```bash
npm logout --registry=https://registry.npmjs.org/
npm login --auth-type=web --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
npm run publish:ready
npm publish --access public --auth-type=web
npm view @memi-design/cli version dist-tags.latest mcpName --json
mcp-publisher login github
mcp-publisher publish server.json
npm run check:public-release
```

Seven days after publish, compare metrics against [METRICS.md](./METRICS.md) and log the next distribution action before changing positioning again.
