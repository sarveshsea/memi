# Weekly Growth Scorecard

Use this every Friday during the v2 package-growth window. Record the value, source URL, and one action for the next week.

## Baseline

- Release target: `@memi-design/cli@2.0.0`
- Public npm latest before v2 publish: `1.1.1`
- Primary CTA: `https://www.npmjs.com/package/@memi-design/cli`
- Primary phrase: `Interface understanding for AI coding agents`
- Secondary phrase: `Design-system memory for coding agents`
- Core proof: `memi diagnose`, `memi ux audit --json`, `memi craft audit --json`, `memi tokens --from ./src --report`, `memi shadcn export --out public/r`
- Agent proof: `npx skills add sarveshsea/memi --skill memoire-design-tooling`
- MCP proof: `memi mcp start --no-figma`

## Targets

- Week 1: npm latest is `2.0.0`, public release gate passes, Agent Skills discovery passes, and MCP Registry metadata is refreshed.
- Week 2: weekly downloads are `500+`, GitHub metadata matches the v2 phrase, and at least one external agent-stack guide links to memi.
- Week 4: weekly downloads are `1500+`, monthly downloads are `4000+`, and example registries or tutorials account for measurable npm traffic.
- Week 8: weekly downloads are `10000+`, Codex/MCP/Agent Skills discovery routes all point to the same v2 story, and stale 0.14.x docs are quarantined as historical.

## Scorecard

| Week | npm latest | Weekly downloads | Monthly downloads | GitHub stars | README phrase | Agent Skills install | MCP Registry | Main action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Baseline | `1.1.1` | TBD | TBD | TBD | v2 draft | local pass | pending v2 | Publish `2.0.0` and run public gates |
| Week 1 | | | | | | | | |
| Week 2 | | | | | | | | |
| Week 3 | | | | | | | | |
| Week 4 | | | | | | | | |
| Week 8 | | | | | | | | |

Quick checks:

```bash
npm run growth:status
npm view @memi-design/cli version dist-tags.latest mcpName --json
npm run check:public-release
```

## Source URLs

- npm latest: `https://registry.npmjs.org/%40memi-design%2Fcli`
- npm weekly downloads: `https://api.npmjs.org/downloads/point/last-week/%40memi-design%2Fcli`
- npm monthly downloads: `https://api.npmjs.org/downloads/point/last-month/%40memi-design%2Fcli`
- GitHub metadata: `https://api.github.com/repos/sarveshsea/memi`
- npm package page: `https://www.npmjs.com/package/@memi-design/cli`
- Components page: `https://www.memoire.cv/components`
- Codex plugin page: `https://www.memoire.cv/codex-plugin`

## Weekly review questions

- Did npm latest match the repo release?
- Did the first README screen still say `Interface understanding for AI coding agents`?
- Did the first code block still prove value without Figma?
- Did Agent Skills install and MCP startup still work?
- Which post, directory, agent stack, example, or tutorial created the most clicks?
- Which command was the fastest path to activation: `diagnose`, `ux audit`, `craft audit`, `tokens`, `shadcn export`, `agent install`, or `mcp start`?
- What one friction point should be removed before the next post?
