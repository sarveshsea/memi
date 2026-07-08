# Site and GitHub Handoff

These are the external-surface updates for the Studio-first Product Hunt launch.

## GitHub Repo Metadata

- Description: `AI workbench for product designers: run Codex or Claude Code with project memory, design-system context, receipts, and Figma/FigJam handoff.`
- Topics: `ai-workbench`, `product-design`, `codex`, `claude-code`, `mcp-server`, `figma`, `figjam`, `design-system`, `design-memory`, `tailwind-audit`, `shadcn`, `ui-quality`

## Homepage Hero

- Heading: `memi is the AI workbench for product designers.`
- Subhead: `Run Codex or Claude Code with project memory, design-system context, receipts, and Figma/FigJam handoff in one signed macOS app.`
- Primary CTA: `https://github.com/sarveshsea/memi-studio/releases/latest`
- Secondary CTA: `https://www.npmjs.com/package/@memi-design/cli`
- Proof line: `Open source · Apple-signed by Humyn LLC · Studio 2.4.0 · npm latest 2.3.1`

## Product Hunt Surface

- Product: `memi`
- Tagline: `AI workbench for product designers`
- Description: `Run Codex or Claude Code with project memory, design-system context, receipts, and Figma/FigJam handoff in one signed macOS app.`
- CTA: `https://www.memoire.cv`

## Docs Landing

- Lead with Studio setup and download.
- Put CLI/MCP setup directly below as the engine path:

```bash
npm i -g @memi-design/cli
memi diagnose
memi ux audit --json
memi craft audit --json
memi mcp start --no-figma
```

- Keep shadcn registry, Notes, simulation, and advanced agents below the first product story.

## Release Checklist

- Publish `@memi-design/cli@2.3.1`.
- Verify `npm run check:public-release`.
- Publish `server.json` to the MCP Registry after auth refresh.
- Create GitHub tag/release `v2.3.1`.
- Confirm the homepage shows Studio `2.4.0`, Homebrew cask `2.4.0`, and npm `2.3.1`.
- Confirm no first-fold public install path points to deprecated `@sarveshsea/memoire`.
