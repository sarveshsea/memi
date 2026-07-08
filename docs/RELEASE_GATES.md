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
- Website homepage still links to the npm package and does not contain stale Studio 1.0.4 copy.
- Website docs mention the current CLI version and do not contain the old `Current npm target: 0.14.1` line.
- Website changelog includes the current release.
- Website community Notes catalog contains at least five approved community Notes and was generated no earlier than July 4, 2026.
- A clean temp install can run `memi --version`.

```bash
npm run check:public-release
SKIP_INSTALL_SMOKE=1 npm run check:public-release
SKIP_SITE_SMOKE=1 npm run check:public-release
EXPECTED_STUDIO_VERSION=2.4.0 EXPECTED_COMMUNITY_NOTES=5 npm run check:public-release
```

For the `2.3.x` line, npm must report the current `package.json` version and `memoire.cv` must show the same public story before MCP Registry, Codex marketplace announcements, Product Hunt, or directory follow-up. Use `SKIP_SITE_SMOKE=1` only while a web deploy is intentionally pending.

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
- Website `/notes/community/catalog.v1.json`: non-empty community Notes catalog with the public starter Notes

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
