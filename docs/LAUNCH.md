# memi Product Hunt Launch Pack

Use one message everywhere for the current `2.3.x` launch:

> memi is the AI workbench for product designers. Run Codex or Claude Code with project memory, design-system context, receipts, and Figma/FigJam handoff in one signed macOS app.

Primary CTA: <https://www.memoire.cv>

## Launch Baseline

- Product Hunt story: Studio-first, with the npm CLI/MCP engine underneath.
- Release target: `@memi-design/cli@2.3.1`.
- Studio download: `memi-studio v2.4.0` signed macOS app from GitHub Releases.
- Homebrew: `brew install --cask sarveshsea/memi/memi-studio`.
- MCP Registry: `io.github.sarveshsea/memi`.
- Codex plugin: `codex plugin marketplace add sarveshsea/memi --ref main --sparse .agents/plugins --sparse plugins/memoire`.
- Public proof repo: `https://github.com/sarveshsea/design-sandbox`.

## Product Hunt Copy

Name:

```text
memi
```

Tagline:

```text
AI workbench for product designers
```

Description:

```text
Run Codex or Claude Code with project memory, design-system context, receipts, and Figma/FigJam handoff in one signed macOS app.
```

Maker comment:

```text
I built memi because product-design agent runs kept losing the thread: the code agent had one context, Figma had another, project decisions lived in markdown, and useful output disappeared into chat history.

memi Studio is a signed macOS workbench for running Codex or Claude Code with the product system already attached: project memory, design tokens, specs, research, Figma/FigJam handoff, run receipts, logs, and artifacts.

The npm package is still the engine underneath:
npm i -g @memi-design/cli
memi diagnose
memi ux audit --json
memi craft audit --json
memi mcp start --no-figma

Try the proof repo:
git clone https://github.com/sarveshsea/design-sandbox.git
cd design-sandbox
pnpm install
pnpm memi:diagnose
pnpm memi:ux
pnpm verify

Today’s launch is the workbench story: a calmer place for product designers to supervise AI work, keep evidence, and turn useful output into durable design memory.
```

## Social Posts

### Main Launch

```text
Launching memi today.

It is an AI workbench for product designers: run Codex or Claude Code with project memory, design-system context, receipts, and Figma/FigJam handoff in one signed macOS app.

Download:
https://www.memoire.cv
```

### Engine Underneath

```text
memi Studio is the workbench.
@memi-design/cli is the engine underneath.

npm i -g @memi-design/cli
memi diagnose
memi ux audit --json
memi craft audit --json
memi mcp start --no-figma

The goal: agents start from the product system, not a blank prompt.

Proof repo:
https://github.com/sarveshsea/design-sandbox
```

### Codex / Claude

```text
Codex and Claude Code are powerful, but product-design work needs receipts:

- what context was loaded
- what files changed
- what design memory was used
- what artifacts came out
- what should be preserved

That is the surface memi Studio gives you.
```

### Figma / FigJam

```text
Figma stays contextual in memi.

Connect it when the run needs design source, pull tokens/components/screenshots, and export local Mermaid or FigJam-ready planning source before external sync.

The handoff remains inspectable.
```

## Competitive Positioning

- Prompt-to-UI tools help create the first pass.
- Coding agents help modify the product.
- memi is for supervised product-design agent work: memory, receipts, artifacts, Figma context, and reusable design-system evidence.

## Launch Checklist

- [x] Publish `@memi-design/cli@2.3.1`.
- [x] Verify npm install smoke with `npm run check:public-release`.
- [ ] Republish `server.json` to the MCP Registry after auth refresh.
- [x] Create GitHub tag/release `v2.3.1`.
- [ ] Push and verify `sarveshsea/design-sandbox`.
- [x] Confirm homepage still shows Studio `2.4.0`, npm latest, and the macOS download.
- [ ] Submit Product Hunt with the exact name, tagline, description, and CTA above.
- [ ] Post the main launch thread and one engine-underneath reply.
