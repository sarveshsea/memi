# Weekly Growth Scorecard

Use this every Friday during the v2 package-growth window. Record the value, source URL, and one action for the next week.

## Baseline

- Current release candidate: `@memi-design/cli@2.5.0`
- Public npm latest before v2 publish: `1.1.1`
- Public npm latest before the 2.5 publish command: `2.4.1`
- Latest complete npm download windows: 46 last-day downloads for 2026-07-05, 783 last-week downloads for 2026-06-29 through 2026-07-05, 1,306 last-month downloads for 2026-06-06 through 2026-07-05.
- 10x target from the 2026-07-08 baseline: 7,830 weekly downloads and 13,060 monthly downloads.
- Primary CTA: `https://www.npmjs.com/package/@memi-design/cli`
- Primary phrase: `Interface understanding for AI coding agents`
- Secondary phrase: `Design-system memory for coding agents`
- Core proof: `memi diagnose`, `memi ux audit --json`, `memi craft audit --json`, `memi tokens --from ./src --report`, `memi shadcn export --out public/r`
- Agent proof: `npx skills add sarveshsea/memi --skill memoire-design-tooling`
- MCP proof: `memi mcp start --no-figma`

## Targets

- Week 1: npm latest is `2.5.0`, public release gate passes, Agent Skills discovery passes, MCP Registry metadata is refreshed, and active `memoire.cv` docs have no stale 0.14.x targets.
- Week 2: weekly downloads are `1500+`, GitHub metadata matches the v2 phrase, and at least three external agent-stack or template guides link to runnable memi proof.
- Week 4: weekly downloads are `4000+`, monthly downloads are `8000+`, and example registries or tutorials account for measurable npm traffic.
- Week 8: weekly downloads are `7830+`, Codex/MCP/Agent Skills discovery routes all point to the same v2 story, and at least ten external repos or directories include runnable memi proof.

## Scorecard

| Week | npm latest | Weekly downloads | Monthly downloads | GitHub stars | README phrase | Agent Skills install | MCP Registry | Main action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Baseline | `1.1.1` | TBD | TBD | TBD | v2 draft | local pass | pending v2 | Publish v2 and run public gates |
| 2026-07-08 | `2.4.1` | `783` | `1306` | `17` | live v2 | local pass | current at `2.4.1` | Seed proof repos and MCP directories |
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
