---
name: Mermaid Jam
description: >
  Route Mermaid and markdown diagram source into the Mermaid Jam FigJam plugin
  so output stays editable as native FigJam cards, sections, and connectors.
activateOn: figma-canvas-operation
freedomLevel: high
category: connect
tags:
  - figjam
  - mermaid
  - markdown
  - diagram
  - user-flow
author: Memoire
---

# Mermaid Jam

Use this Note when a user asks to turn Mermaid markdown, fenced Mermaid blocks,
or markdown user-flow notes into a FigJam diagram.

Use the research-vibe-design path when the source should come from Memoire
research or Scenario Lab instead of hand-authored Mermaid. It generates Atomic
Design specs, evidence maps, journey maps, IA flows, and optional simulation
timelines before handing source to Mermaid Jam.

## Native Route

1. Run `memi mermaid-jam status --json`.
2. If `integration.local.ready` is true, use the reported
   `integration.local.manifestPath` for local development import.
3. If no local checkout is ready, use `integration.communityUrl` and open the
   Figma Community install page.
4. Open the plugin from a FigJam board, not a Figma design file, then paste the
   Mermaid or markdown source into Mermaid Jam.

For Mémoire Studio on macOS, prefer the native corpus path before falling back
to manual plugin paste:

```bash
memi mermaid-jam corpus sync --setup --json
memi mermaid-jam analyze ./docs/flow.md --json
```

Studio stores the reviewed markdown-only corpus in `.memoire/markdown-corpus`
and can sync analyzed candidates through the connected FigJam bridge as editable
FigJam nodes. The corpus downloader only stores `.md`, `.mdx`, `.markdown`, and
`.mdoc` files from the allowlisted repos.

The manifest may be importable from Figma and FigJam, but generation is
FigJam-native because the renderer creates FigJam sections, shape cards, and
dynamic connectors.

## Supported Inputs

- Mermaid `flowchart` / `graph`
- Mermaid `journey`
- Mermaid `sequenceDiagram`
- Mermaid `stateDiagram` / `stateDiagram-v2`
- Mermaid `mindmap`
- Mermaid `timeline`
- Markdown headings and bullets describing a user flow
- Markdown tables, frontmatter titles, links, and section hierarchy as scoring
  context for process, journey, timeline, API, architecture, and checklist flows

## Local Development

When developing the plugin alongside Memoire, set:

```bash
export MEMOIRE_MERMAID_JAM_ROOT=/path/to/unicornjam
```

Then run:

```bash
memi mermaid-jam status --json
```

If the status is `needs-build`, run `npm install && npm run build` inside the
Mermaid Jam checkout before importing `plugin/manifest.json`.

## Research Vibe Design

```bash
memi research synthesize
memi research design --intent "Design a research-backed product decision workspace" --write-specs --mermaid-jam --json
memi mermaid-jam export --from research --json
```

If Scenario Lab has a completed simulation, use the run id:

```bash
memi research design --run-id <simulation-run-id> --mermaid-jam --open --json
memi mermaid-jam export --from <simulation-run-id> --open --json
```

Stay on the source + open path: write nonempty `.mmd` or `.md` files under
`.memoire/mermaid-jam/`, open Mermaid Jam through the local manifest or
Community URL, then let the user paste source into the FigJam plugin.
