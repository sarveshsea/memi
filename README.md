<p align="center">
  <img src="https://raw.githubusercontent.com/sarveshsea/m-moire/main/assets/authentic-logo.svg" alt="Memoire" width="80" height="80" />
</p>

<h1 align="center">memoire</h1>

<p align="center">
  <strong>Design memory and UI quality tools for coding agents.</strong><br/>
  Shadcn-native Design CI for Tailwind apps. Give Codex, Claude Code, Cursor, OpenCode, Hermes, OpenClaw, shadcn, v0, and Figma the same design-system memory before they edit your app.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@sarveshsea/memoire"><img src="https://img.shields.io/npm/v/@sarveshsea/memoire?color=black" alt="npm"></a>
  <a href="https://github.com/sarveshsea/m-moire/actions/workflows/ci.yml"><img src="https://github.com/sarveshsea/m-moire/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/sarveshsea/m-moire/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-black.svg" alt="MIT"></a>
</p>

---

## 60-second quickstart for agents

Memoire starts from the app you already have. Install the npm package, let your coding agent audit the codebase, extract tokens, export a shadcn-native registry, then install the same components with `shadcn`, v0, or `memi`.

```bash
npm i -g @sarveshsea/memoire

memi diagnose
memi tokens --from ./src --report
memi shadcn export --out public/r
memi registry install Button --from @you/ds
memi publish --name @you/ds
```

Use Memoire before broad UI changes, Tailwind cleanup, accessibility fixes, shadcn/ui generation, Figma-to-code work, or component registry publishing. Agent-oriented guidance is available in [`llms.txt`](./llms.txt) and [`docs/AGENT_RECIPES.md`](./docs/AGENT_RECIPES.md).

Primary CTA: [`@sarveshsea/memoire` on npm](https://www.npmjs.com/package/@sarveshsea/memoire).

Compatibility targets: [shadcn registry](https://ui.shadcn.com/docs/registry/getting-started), [registry item schema](https://ui.shadcn.com/docs/registry/registry-item-json), [components.json](https://ui.shadcn.com/docs/components-json), and [v0 design systems](https://v0.app/docs/design-systems).

### Install Mémoire into your AI agent

`0.16.1` ships native agent kits inside the npm package. Install Memoire once, then give Hermes agents, OpenClaw bots, Claude Code, Cursor, Codex, and OpenCode the same design-system memory, Figma bridge context, Atomic Design rules, shadcn/ui codegen, Tailwind diagnostics, and research-backed UI audit flow.

```bash
npm i -g @sarveshsea/memoire

memi agent install hermes
memi agent install openclaw --project .
memi agent install claude-code --project .
memi agent install cursor --project .
memi agent install codex
memi agent install opencode --project .

# install every supported kit, or inspect first
memi agent install --project .
memi agent install --dry-run --json
```

Hermes and OpenClaw receive `memoire-design-tooling` `SKILL.md` packages. Claude Code and Cursor receive MCP config for `memi mcp start`. Codex and OpenCode receive skill-style context packs. Mirror-ready community skill files live in `agent-kits/mirror` for `sarveshsea/memoire-agent-skills`. MCP registries and crawlers can inspect the Figma-independent server with `memi mcp start --no-figma`.

| Agent | Native install target | What it unlocks |
|-------|-----------------------|-----------------|
| Hermes | `~/.hermes/skills/memoire/memoire-design-tooling/SKILL.md` | Hermes loads Memoire as a design-system skill for UI, Figma, specs, and research runs. |
| OpenClaw | `<workspace>/skills/memoire/memoire-design-tooling/SKILL.md` | OpenClaw picks up a workspace skill with `memi` install metadata for ClawHub-style agent use. |
| Claude Code | `.mcp.json` | Project MCP config for `memi mcp start`; Claude Code asks to approve project MCP servers from `.mcp.json`. |
| Cursor | `.cursor/mcp.json` | Cursor MCP config for Memoire design-system tools. |
| Codex / OpenCode | user or workspace skill pack | Agent-native instructions for design audits, Figma context, specs, and Tailwind/shadcn workflows. |

### Mémoire Studio for macOS

`0.16.1` includes Mémoire Studio: a macOS agent workbench and local web shell for Claude Code, Codex, Hermes, OpenCode, Ollama, Gemini, Mémoire Native, project memory, the Figma bridge, and an in-app Marketplace for Mémoire Notes. The desktop app includes a native Agent Kits panel so you can dry-run, install, and force-refresh Hermes/OpenClaw/Claude/Cursor/Codex/OpenCode kits without leaving Studio.

```bash
# web/TUI workflows from npm
memi studio web --port 1422
memi studio tui
memi studio logs --follow
memi studio run --harness codex --action design-doc --prompt "Audit this UI and generate a design spec"

# local macOS app build
npm run studio:build
open "apps/studio/src-tauri/target/release/bundle/dmg/Mémoire Studio_0.16.1_aarch64.dmg"

memi video create "Launch story" --adapter remotion --prompt "Product motion system"
```

Tagged GitHub Releases attach the downloadable Apple Silicon DMG, for example `Mémoire Studio_0.16.1_aarch64.dmg`.

### Install the output anywhere

```bash
# shadcn-compatible registry item
npx shadcn@latest add https://your-site.com/r/button.json

# v0 / AI-editor context
memi shadcn serve --port 4014

# Mémoire install path with aliases, npm packages, URLs, GitHub, or local paths
memi registry install Button --from @you/ds
memi add Button --from ./public/r
```

## No Figma required

Most developer teams do not start in Figma. Memoire reads the codebase directly: Tailwind classes, shadcn usage, CSS variables, routes, markup, repeated literals, dark-mode coverage, token aliases, component targets, and registry shape.

```bash
# Diagnose an existing app from code
memi diagnose

# Diagnose a running local route / public URL
memi diagnose http://localhost:3000

# Extract the token system from the app and write audit reports
memi tokens --from ./src --output generated/tokens --report

# Export shadcn-compatible registry.json and /r/*.json items
memi shadcn export --out public/r

# Save extracted tokens into .memoire/design-system.json for publish/codegen flows
memi tokens --from ./src --save
```

Reports are written to `.memoire/app-quality/diagnosis.{json,md}` and token extraction emits CSS, Tailwind, JSON, Style Dictionary, semantic coverage, scale-health notes, alias graph validation, duplicate-value groups, recommendations, and inferred token candidates. Shadcn export emits `registry.json` plus installable item JSON files under `/r`.

## Registry workflow

After diagnosis, the registry loop is simple: publish the improved design system, mirror shadcn-native registry files, install real components anywhere, then keep the registry updated as the source changes.

### Existing app/CSS -> tokens -> shadcn registry

```bash
npm i -g @sarveshsea/memoire

memi tokens --from ./src --report
memi shadcn doctor
memi shadcn export --out public/r
memi publish --name @you/ds
memi add Button --from @you/ds
```

Point Memoire at `src/`, `app/globals.css`, a built CSS file, `http://localhost:3000`, or a public URL.

### Published registry -> shadcn/v0/AI editors

```bash
# Install through shadcn directly
npx shadcn@latest add https://cdn.example.com/r/button.json

# Use the same registry as AI design-system context
memi shadcn serve --from @you/ds

# Install through Memoire when you want alias/package/URL/GitHub resolution
memi registry install Button --from @you/ds
```

### Figma -> npm -> shadcn app

```bash
npm i -g @sarveshsea/memoire

# Publish your Figma file to npm
npx @sarveshsea/memoire publish --name @you/ds --figma https://figma.com/design/xxx --push

# From any project, drop working code in
npx @sarveshsea/memoire add Button --from @you/ds
# → src/components/memoire/Button.tsx (real working code, not a spec)
```

### tweakcn -> npm -> shadcn app

```bash
npm i -g @sarveshsea/memoire

memi theme import ./tweakcn-export.css --name "Acme Theme"
memi theme publish "Acme Theme" --package @you/theme
memi add Button --from @you/theme
```

A registry bundles tokens (W3C DTCG JSON + Tailwind v4 `@theme` CSS), component specs, and **real generated code** for React / Vue / Svelte. Publishable to npm, GitHub, or any static host.

## Featured registries

<p align="center">
  <img src="https://raw.githubusercontent.com/sarveshsea/m-moire/main/assets/showcases/starter-saas.svg" alt="Starter SaaS registry" width="240" />
  <img src="https://raw.githubusercontent.com/sarveshsea/m-moire/main/assets/showcases/docs-blog.svg" alt="Docs Blog registry" width="240" />
  <img src="https://raw.githubusercontent.com/sarveshsea/m-moire/main/assets/showcases/dashboard.svg" alt="Dashboard registry" width="240" />
</p>

- `@memoire-examples/starter-saas` — neutral SaaS starter. Install with `memi add Button --from @memoire-examples/starter-saas`. Source: [`examples/presets/starter-saas`](./examples/presets/starter-saas)
- `@memoire-examples/docs-blog` — editorial docs/blog kit. Install with `memi add Button --from @memoire-examples/docs-blog`. Source: [`examples/presets/docs-blog`](./examples/presets/docs-blog)
- `@memoire-examples/dashboard` — high-contrast analytics dashboard. Install with `memi add Button --from @memoire-examples/dashboard`. Source: [`examples/presets/dashboard`](./examples/presets/dashboard)

More examples and the featured fallback catalog live in [`examples/`](./examples/README.md).

### Designed in tweakcn? Publish with Memoire.

[tweakcn](https://tweakcn.com) is the visual theme editor for shadcn/ui. Memoire now treats tweakcn as a full workflow, not just a publish flag:

```bash
# Import from a tweakcn CSS export or share URL
memi theme import ./tweakcn-export.css --name "Acme Theme"
memi theme import https://tweakcn.com/r/themes/xxx --name "Acme Theme"

# Validate, preview, diff, and generate packaged variants
memi theme validate "Acme Theme"
memi theme preview "Acme Theme"
memi theme variants "Acme Theme"

# Apply it into the current workspace or publish it to npm
memi theme apply "Acme Theme"
memi theme publish "Acme Theme" --package @you/theme
```

Theme import handles both Tailwind v3 (`:root { --primary: ... }`) and v4 (`@theme { --color-primary: ... }`) exports, including `:root` + `.dark` multi-mode themes. If you want the one-shot path, `memi publish --theme <path-or-url>` still works.

<p align="center">
  <img src="https://raw.githubusercontent.com/sarveshsea/m-moire/main/assets/demo.gif" alt="Memoire terminal publish and install flow" width="720" />
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/sarveshsea/m-moire/main/assets/theme-workflow-demo.svg" alt="Memoire tweakcn theme workflow" width="720" />
</p>

Demo scripts for recording and reuse live in [`docs/DEMOS.md`](./docs/DEMOS.md).
No-Figma proof examples live in [`docs/PROOF.md`](./docs/PROOF.md).

---

## Why teams keep Memoire in the stack

Claude Design, Figma Make, Lovable, Bolt, Replit Agent, and v0 are useful for fast first passes. Memoire is for the part after that first pass, when the output has to survive beyond a single prompt or canvas session.

- App builders: strong for creating the first version. Memoire diagnoses the design debt that shows up once the app is real.
- Claude Design and Figma Make: strong for visual exploration. Memoire keeps the reusable system portable across code, registries, and AI tools.
- v0: strong for generating screens and using registries. Memoire helps infer, improve, and publish the registry from the app you already have.

If your team needs better visual quality, versioned tokens, installable components, tweakcn theme packaging, and cross-tool design system context, that is the Memoire wedge.

---

## Studio interface references and adapted components

Memoire Studio is a desktop-first agent workbench for design runs. Its interface uses Hermes WebUI and Hermes Agent as MIT-licensed references for the transcript-first console, three-pane workbench, event normalization, and supervised local sessions.

Studio runs Claude Code, Codex, Hermes, Ollama, OpenCode, Gemini, and Memoire Native through a shared harness manifest. External coding agents receive a Memoire design/research envelope before execution, so their runs start from project memory, specs, references, Figma state, accessibility, and Atomic Design rather than a generic coding prompt. The macOS app also has an Agent Kits panel for dry-run planning, installation, and force-refresh of Hermes, OpenClaw, Claude Code, Cursor, Codex, and OpenCode kit targets. `memi studio tui` and `memi studio logs` expose the same persisted JSONL events for terminal-first visibility into package logs, Claude/Codex output, harness status, approvals, artifacts, and final results.

Studio also includes a Notes Marketplace that lists built-in Notes, installed workspace Notes, and installable packages from the repo-owned `notes/*/note.json` manifests. The Marketplace uses the same Notes installer logic as `memi notes`, so installed packs become normal `.memoire/notes` project memory and agent context.

The desktop app source lives in `apps/studio`. Build output stays out of git under `apps/studio/src-tauri/target`; tagged GitHub Releases attach the downloadable macOS DMGs, for example `Mémoire Studio_0.16.1_aarch64.dmg`. For a local build, run:

```bash
npm run studio:build
```

Motion/video work is native in 0.15 through optional Remotion and HyperFrames adapters. `memi video create|preview|render` stores projects under `.memoire/videos` without making either video tool a hard dependency.

Warp is used as a product reference for terminal blocks and grouped command output. Only MIT-licensed Warp UI framework pieces such as `warpui_core` and `warpui` are considered for adaptation; Warp AGPL application/client code is not copied into Memoire.

See [`NOTICE`](./NOTICE) for source links and attribution details.

---

## What you get

| Input | Output |
|-------|--------|
| Existing shadcn/Tailwind app | Design debt diagnosis with scores, issues, reports, and visual direction options |
| Existing CSS/code/URL | Extracted design tokens with modes, aliases, semantic coverage, scale health, and Style Dictionary export |
| Figma file | npm-ready design system registry with tokens, specs, and real components |
| tweakcn theme | A first-class workflow: import, preview, diff, validate, apply, variants, publish |
| Any public URL | `DESIGN.md` plus an optional starter registry scaffold |
| JSON specs | React + TypeScript + Tailwind components (shadcn/ui) |
| Generated registries | Installable components for React / Vue / Svelte |

```bash
npm i -g @sarveshsea/memoire

memi diagnose                         # audit the current app from code
memi diagnose http://localhost:3000   # audit a running route or public URL
memi design-doc https://linear.app     # extract any site's design system
memi tokens --from ./src --save         # extract app tokens into the registry
memi tokens --from ./src --report       # write token-extraction.report.{md,json}
memi go                                 # figma -> tokens -> specs -> components -> preview
memi go --rest                          # same thing, no figma desktop needed
memi go --penpot                        # same thing, from penpot
memi tokens                             # export as CSS / Tailwind / JSON / Style Dictionary
```

---

## Install without npm (work laptops, locked-down environments)

No Node, no npm, no admin rights.

```bash
# macOS / Linux — auto-patches your shell profile, verifies SHA256
curl -fsSL https://memoire.cv/install.sh | sh

# Windows (PowerShell) — auto-adds to user PATH
irm https://memoire.cv/install.ps1 | iex

# Homebrew (macOS / Linux)
brew install sarveshsea/memoire/memoire

# Docker (air-gapped envs where only ghcr.io is reachable)
docker run --rm -it -v "$PWD:/work" -w /work ghcr.io/sarveshsea/memoire --help

# Self-update once installed
memi upgrade
```

**Manual download** if `curl`, `brew`, and `docker` are all blocked — grab the archive from [GitHub Releases](https://github.com/sarveshsea/m-moire/releases/latest):

| Platform                | Archive                          |
|-------------------------|----------------------------------|
| macOS (Apple Silicon)   | `memi-darwin-arm64.tar.gz`       |
| macOS (Intel)           | `memi-darwin-x64.tar.gz`         |
| Linux (x86_64)          | `memi-linux-x64.tar.gz`          |
| Windows (x64)           | `memi-win-x64.zip`               |

Verify with `SHA256SUMS.txt` (attached to every release). Extract, add `memi` to PATH, run `memi connect`. The `skills/`, `notes/`, `plugin/`, `preview/` directories must stay next to the binary — Mémoire loads them at runtime.

---

## Advanced: Use with AI agents

Memoire can install native agent kits and also run as an MCP server, so your AI assistant can work directly with your design system after the registry workflow is in place. Use `memi agent install --dry-run --json` to inspect every write before installing. For copy-paste prompts and client-specific setup, see [`docs/AGENT_RECIPES.md`](./docs/AGENT_RECIPES.md).

```bash
memi agent install hermes                # ~/.hermes/skills/memoire/memoire-design-tooling
memi agent install openclaw --project .  # ./skills/memoire/memoire-design-tooling
memi agent install claude-code --project . # writes .mcp.json
memi agent install cursor --project .    # writes .cursor/mcp.json
memi agent install codex                 # ~/.codex/skills/memoire/memoire-design-tooling
memi agent install opencode --project .  # ./.opencode/skills/memoire/memoire-design-tooling
memi mcp config --install                # direct MCP config path
```

Or add manually to `.mcp.json`:

```json
{
  "mcpServers": {
    "memoire": {
      "command": "memi",
      "args": ["mcp", "start"]
    }
  }
}
```

**Tools include:** `pull_design_system`, `generate_code`, `create_spec`, `get_tokens`, `compose`, `design_doc`, `run_audit`, `capture_screenshot`, `analyze_design`, and more in the [docs](./docs/README.md).

For MCP registry crawlers, smoke tests, and Glama freshness checks, use the Figma-independent startup command:

```bash
memi mcp start --no-figma
```

Release/publish recovery flow:

```bash
npm logout --registry=https://registry.npmjs.org/
npm login --auth-type=web --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/   # must print sarveshsea
npm publish --access public --auth-type=web
npm view @sarveshsea/memoire version dist-tags.latest mcpName --json
mcp-publisher login github
mcp-publisher publish server.json
npm run check:public-release
```

---

## Full command reference

<details>
<summary><strong>Core workflow</strong></summary>

| Command | What it does |
|---------|-------------|
| `memi setup` | Full onboarding: token, file, plugin, bridge, MCP config, test pull |
| `memi init` | Initialize workspace with starter specs |
| `memi diagnose [target]` | Diagnose design debt in an existing web app from code or URL |
| `memi connect` | Start Figma bridge (auto-discovers plugin on ports 9223-9232) |
| `memi mermaid-jam status` | Inspect the Mermaid Jam FigJam plugin link, repo, and local manifest path |
| `memi pull` | Extract tokens, components, styles from Figma |
| `memi pull --rest` | Pull via REST API -- no plugin, no Figma Desktop |
| `memi pull --penpot` | Pull from Penpot (needs `PENPOT_TOKEN` + `PENPOT_FILE_ID`) |
| `memi spec <type> <name>` | Create a component, page, or dataviz spec |
| `memi generate [name]` | Generate shadcn/ui code + Storybook stories from specs |
| `memi generate --no-stories` | Generate without Storybook stories |
| `memi preview` | Start preview gallery + shadcn registry server |
| `memi theme <subcommand>` | tweakcn workflow: import, preview, validate, diff, apply, variants, publish |
| `memi go` | Full pipeline in one command |
| `memi export` | Export generated code into your project |
| `memi tokens` | Export registry tokens as CSS / Tailwind / JSON / Style Dictionary (W3C DTCG) |
| `memi tokens --from <file|dir|url>` | Extract tokens from CSS/code/URL with modes, alias graph checks, semantic coverage, inferred literals, and optional `--report` |
| `memi validate` | Validate all specs against schemas |

</details>

<details>
<summary><strong>Design extraction</strong></summary>

| Command | What it does |
|---------|-------------|
| `memi design-doc <url>` | Extract design system from any URL into DESIGN.md |
| `memi design-doc <url> --spec` | Also write a DesignSpec JSON for codegen |
| `memi extract <url>` | Alias for design-doc |

</details>

<details>
<summary><strong>Advanced: sync, agents, research</strong></summary>

| Command | What it does |
|---------|-------------|
| `memi sync` | Full sync: Figma + specs + code |
| `memi sync --live` | Watch and sync continuously |
| `memi compose "<intent>"` | Agent orchestrator: classify, plan, execute |
| `memi agent install [target]` | Install Memoire agent kits for Hermes, OpenClaw, Claude Code, Cursor, Codex, or OpenCode |
| `memi agent spawn <role>` | Spawn a persistent agent worker |
| `memi research from-file <path>` | Process Excel/CSV into research |
| `memi research synthesize` | Synthesize themes and personas |
| `memi daemon start` | Start daemon with reactive pipeline |

</details>

<details>
<summary><strong>Diagnostics</strong></summary>

| Command | What it does |
|---------|-------------|
| `memi status` | Project status overview |
| `memi doctor` | Health check: project, plugin, bridge |
| `memi dashboard` | Launch monitoring dashboard |
| `memi audit` | Design system audit (WCAG, unused specs) |

All commands support `--json` for structured output.

</details>

---

## Spec-first workflow

Every component starts as a JSON spec before code is generated:

```json
{
  "name": "MetricCard",
  "type": "component",
  "level": "molecule",
  "shadcnBase": ["Card", "Badge"],
  "props": { "title": "string", "value": "string", "trend": "string?" },
  "variants": ["default", "compact"]
}
```

Specs are validated with Zod schemas. Components follow Atomic Design (atom, molecule, organism, template, page).

---

## Architecture

```
src/
  engine/     Core orchestrator, registry, sync, pipeline
  figma/      WebSocket bridge + REST client + Penpot client
  agents/     Intent classifier, plan builder, task queue
  mcp/        MCP server (tools, resources, stdio)
  codegen/    shadcn/ui mapper, Storybook, dataviz, pages
  research/   Research engine (Excel, stickies, web)
  specs/      Spec types, Zod schemas, 62-component catalog
  preview/    Preview gallery, API server, shadcn registry
  notes/      Downloadable skill packs
  commands/   CLI command surface
  plugin/     Figma plugin (Widget V2)
```

---

## Links

[Quickstart](./docs/README.md) -- [Examples](./examples/README.md) -- [Launch Pack](./docs/LAUNCH.md) -- [Changelog](CHANGELOG.md)

## License

MIT
