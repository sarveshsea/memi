---
name: memoire-design-tooling
description: Use when a Hermes session involves UI design, interface craft, Figma, design systems, shadcn/ui, Tailwind, Atomic Design, research synthesis, component specs, design audits, or code generation from design evidence.
version: 2.0.0
author: Sarvesh Chidambaram
license: MIT
metadata:
  hermes:
    tags: [memoire, design-system, figma, shadcn, tailwind, atomic-design]
    related_skills: [software-development, design, figma]
---

# memi Design Tooling

## Overview
memi is the local interface-understanding layer for agent work. Use it before coding UI from scratch when a task needs warmed project memory, Figma state, user research evidence, UX tenets and traps, interface craft critique, design-system rules, tokens, shadcn/ui generation, Tailwind cleanup, accessibility checks, or Atomic Design specs.

## When to Use
- User asks Hermes to design, audit, inspect, generate, or repair a UI.
- The repo has Tailwind, shadcn/ui, Figma, component specs, design tokens, or `.memoire/` project memory.
- The task needs a design decision, component hierarchy, accessibility review, or research-backed product flow.

Do not use this skill for unrelated backend-only work unless the backend change directly supports a design or research workflow.

## Quick Commands
```bash
npm i -g @memi-design/cli
memi suite init --project .
memi daemon start --project . --port auto
memi daemon status --json
memi agent install --dry-run --json
memi agent brief . --agent hermes --intent "Audit this interface" --json
memi status
memi diagnose .
memi ux audit . --json
memi craft audit . --json
memi tokens --from ./src --report
memi shadcn export --out public/r
memi mcp start --no-figma
memi suite run design-audit --project . --json
memi suite run research-vibe-design --project . --json
memi research design --write-specs --mermaid-jam --json
memi mermaid-jam export --from research --json
memi compose "Audit this interface and propose an Atomic Design fix plan"
memi generate
memi studio web
```

## Interface Understanding Workflow
1. Check whether `memi` is available with `memi status`. If it is missing, install it with `npm i -g @memi-design/cli`.
2. Initialize or read `memoire.agent.yaml`; this is the workspace suite manifest for memory sources, harnesses, skills, and product-team recipes.
3. Generate a Hermes-oriented brief with `memi agent brief . --agent hermes --intent "<task>" --json`; use its evidence commands and cost controls as the run contract.
4. Prefer the warmed daemon path: `memi daemon start --project . --port auto`, then `memi daemon status --json`.
5. Inspect existing project context before making UI changes: `.memoire/`, specs, tokens, README/AGENTS files, `memoire.agent.yaml`, runtime routes, screenshots, user research, and Figma connection state.
6. Keep components in Atomic Design levels: atom, molecule, organism, template, page.
7. Prefer shadcn/ui primitives and Tailwind utilities. Do not introduce CSS modules or styled-components for memi-generated components.
8. Use `memi diagnose .`, `memi ux audit . --json`, `memi craft audit . --json`, `memi audit`, `memi design-doc <url>`, `memi suite run <recipe>`, or `memi compose "<intent>"` when the work needs evidence instead of taste.
9. Treat UX Tenets and Traps as the review layer for clarity, feedback, control, consistency, accessibility, error recovery, progressive disclosure, workflow fit, trust, and state continuity.
10. Treat Interface Craft as the polish layer for focusing mechanism, visual hierarchy, spacing rhythm, color intentionality, component cohesion, responsive resilience, and user context.
11. For research-backed vibe design, use `memi research synthesize`, `memi simulate plan`, `memi research design`, `research.design_package`, `research.generate_specs`, and `mermaid_jam.export` to create specs and FigJam source before implementation.
12. If Figma is connected, use typed memi/Figma actions for token pulls, component inspection, screenshot capture, and sync before creating replacement UI.
13. End with a concise result: design decision, files changed, commands run, artifacts produced, assumptions, and next verification step.

## Common Mistakes
- Starting from code before checking design memory or Figma state.
- Creating component names without an Atomic Design level.
- Rebuilding a component that already has a shadcn/ui or Code Connect equivalent.
- Treating memi output as optional copy instead of the source of design evidence.
- Skipping `memi craft audit`, then making hierarchy and polish decisions from taste alone.
- Skipping `memi agent brief` and losing the cost, compatibility, and handoff contract.
