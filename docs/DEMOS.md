# Demo Scripts

These are the demos to keep reusing in README, npm, and launch posts. Lead with the current v2 interface-understanding loop.

For the historical `0.14.1` shadcn/v0 launch archive, use [`docs/V0_WORKFLOWS.md`](./V0_WORKFLOWS.md). For current v2 distribution, lead with `npm i -g @memi-design/cli`, `memi diagnose`, `memi ux audit --json`, `memi shadcn export --out public/r`, and `memi mcp start --no-figma`.

## 60-second v2 code-first demo

Goal: show that Memoire starts from an existing shadcn/Tailwind app, no Figma required.

```bash
npm i -g @memi-design/cli

# 1. Diagnose real UI debt in the current app
memi diagnose --no-write

# 2. Audit UX risk and extract tokens with auditable output
memi ux audit --json
memi tokens --from ./src --report --no-inferred

# 3. Package the improved system as an installable shadcn registry
memi shadcn export --out public/r
```

Talk track:

- start from code instead of a blank canvas
- show the design debt score and highest-impact issues
- show UX risks, token coverage, mode coverage, duplicate values, and recommendations
- end on shadcn registry JSON developers can install or publish

Screen beats:

1. Open a real shadcn/Tailwind app with visible inconsistency.
2. Run `memi diagnose --no-write` and zoom into score, issues, and next moves.
3. Run `memi ux audit --json` and `memi tokens --from ./src --report --no-inferred`.
4. Run `memi shadcn export --out public/r` and end on the generated registry output.

## 60-second terminal demo

Goal: show the whole loop in one screen.

```bash
npm i -g @memi-design/cli
memi diagnose --no-write
memi ux audit --json
memi tokens --from ./src --report
memi shadcn export --out public/r
memi mcp start --no-figma
```

Talk track:

- diagnose a real app
- extract the system from code
- export the improved system as shadcn registry JSON
- expose the same evidence to agents through MCP

## 60-second tweakcn demo

Goal: show that tweakcn is a first-class workflow, not a one-off flag.

```bash
memi theme import ./tweakcn-export.css --name "Acme Theme"
memi theme validate "Acme Theme"
memi theme preview "Acme Theme"
memi theme publish "Acme Theme" --package @demo/theme
memi add Button --from @demo/theme
```

Talk track:

- import a tweakcn theme
- validate and preview it
- publish it as an installable package
- install a component from the published registry

## Recording notes

- Prefer the scoped npm package page over the website until the components index is healthy.
- Keep the terminal font large enough that `publish`, `theme publish`, and `add` are readable on mobile.
- End both demos on a real install command, not a dashboard or settings page.
