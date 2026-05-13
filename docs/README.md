# Memoire Quickstart

Memoire is design memory and UI quality tooling for coding agents working on shadcn/Tailwind apps. Lead with one loop:

1. Diagnose the app you already have.
2. Improve the visual system behind it.
3. Publish the improved system as an installable registry.

## Fastest paths

### Coding agent setup

```bash
npm i -g @memi-design/cli
memi agent install claude-code --project .
memi agent install cursor --project .
memi agent install codex
memi agent install codex-plugin
memi agent install opencode --project .
```

Use this before Codex, Claude Code, Cursor, OpenCode, Hermes, or OpenClaw edits UI code. More copy-paste agent workflows live in [`docs/AGENT_RECIPES.md`](./AGENT_RECIPES.md).

Public Codex plugin marketplace:

```bash
codex plugin marketplace add sarveshsea/memi --ref main --sparse .agents/plugins --sparse plugins/memoire
```

### Existing app to diagnosis

```bash
npm i -g @memi-design/cli
memi diagnose
memi diagnose http://localhost:3000
```

### Existing app to tokens

```bash
npm i -g @memi-design/cli
memi tokens --from ./src --save
memi tokens --from http://localhost:3000 --output generated/tokens --report
```

Use this when the team is code-first and not starting in Figma. Memoire extracts CSS variables, Tailwind `@theme` tokens, `:root`/`.dark` modes, aliases, repeated literal candidates, mode coverage, duplicate values, alias graph issues, and token quality recommendations.

## No Figma required

The highest-conversion path is code-first:

```bash
npm i -g @memi-design/cli
memi diagnose
memi tokens --from ./src --report
memi publish --name @you/ds
```

Use a single CTA until the website is fully synced: [`@memi-design/cli` on npm](https://www.npmjs.com/package/@memi-design/cli).

### Figma to npm

```bash
npm i -g @memi-design/cli
memi publish --name @you/ds --figma https://figma.com/design/xxx --push
memi add Button --from @you/ds
```

### tweakcn to npm

```bash
npm i -g @memi-design/cli
memi theme import ./tweakcn-export.css --name "Acme Theme"
memi theme publish "Acme Theme" --package @you/theme
memi add Button --from @you/theme
```

## Proof

- Featured installable registries: [`examples/README.md`](../examples/README.md)
- No-Figma proof examples: [`docs/PROOF.md`](./PROOF.md)
- Recording scripts: [`docs/DEMOS.md`](./DEMOS.md)
- Launch copy: [`docs/LAUNCH.md`](./LAUNCH.md)
- Social launch posts: [`docs/SOCIAL.md`](./SOCIAL.md)
- Weekly growth scorecard: [`docs/METRICS.md`](./METRICS.md)
- 1M/week npm operating brief: [`docs/GROWTH_TO_1M_NPM.md`](./GROWTH_TO_1M_NPM.md)
- Full package overview: [`README.md`](../README.md)

## Advanced

Memoire still supports Figma, MCP, research, notes, and agents. Keep those as follow-on surfaces after the app-quality workflow is already clear.
