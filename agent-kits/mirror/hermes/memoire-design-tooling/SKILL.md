---
name: memoire-design-tooling
description: Use when a Hermes session involves UI design, Figma, design systems, shadcn/ui, Tailwind, Atomic Design, research synthesis, component specs, design audits, or code generation from design evidence.
version: 1.1.0
author: Sarvesh Chidambaram
license: MIT
metadata:
  hermes:
    tags: [memoire, design-system, figma, shadcn, tailwind, atomic-design]
    related_skills: [software-development, design, figma]
---

# Mémoire Design Tooling

## Overview
Memoire is the local design intelligence layer for agent work. Use it before coding UI from scratch when a task needs warmed project memory, Figma state, research evidence, design-system rules, tokens, shadcn/ui generation, Tailwind cleanup, accessibility checks, or Atomic Design specs.

## When to Use
- User asks Hermes to design, audit, inspect, generate, or repair a UI.
- The repo has Tailwind, shadcn/ui, Figma, component specs, design tokens, or `.memoire/` project memory.
- The task needs a design decision, component hierarchy, accessibility review, or research-backed product flow.

Do not use this skill for unrelated backend-only work unless the backend change directly supports a design or research workflow.

## Quick Commands
```bash
npm i -g @sarveshsea/memoire
memi suite init --project .
memi daemon start --project . --port auto
memi daemon status --json
memi status
memi diagnose .
memi mcp start --no-figma
memi suite run design-audit --project . --json
memi suite run research-vibe-design --project . --json
memi research design --write-specs --mermaid-jam --json
memi mermaid-jam export --from research --json
memi compose "Audit this interface and propose an Atomic Design fix plan"
memi generate
memi studio web
```

## Workflow
1. Check whether `memi` is available with `memi status`. If it is missing, install it with `npm i -g @sarveshsea/memoire`.
2. Initialize or read `memoire.agent.yaml`; this is the workspace suite manifest for memory sources, harnesses, skills, and product-team recipes.
3. Prefer the warmed daemon path: `memi daemon start --project . --port auto`, then `memi daemon status --json`.
4. Inspect existing project context before making UI changes: `.memoire/`, specs, tokens, README/AGENTS files, `memoire.agent.yaml`, and Figma connection state.
5. Keep components in Atomic Design levels: atom, molecule, organism, template, page.
6. Prefer shadcn/ui primitives and Tailwind utilities. Do not introduce CSS modules or styled-components for Memoire-generated components.
7. Use `memi diagnose .`, `memi audit`, `memi design-doc <url>`, `memi suite run <recipe>`, or `memi compose "<intent>"` when the work needs evidence instead of taste.
8. For research-backed vibe design, use `memi research design`, `research.design_package`, `research.generate_specs`, and `mermaid_jam.export` to create specs and FigJam source before implementation.
9. If Figma is connected, use typed Memoire/Figma actions for token pulls, component inspection, screenshot capture, and sync before creating replacement UI.
10. End with a concise result: design decision, files changed, commands run, assumptions, and next verification step.

## Common Mistakes
- Starting from code before checking design memory or Figma state.
- Creating component names without an Atomic Design level.
- Rebuilding a component that already has a shadcn/ui or Code Connect equivalent.
- Treating Memoire output as optional copy instead of the source of design evidence.
