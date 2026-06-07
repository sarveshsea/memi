---
name: memoire-design-tooling
description: Use when a Codex task involves UI design, Figma, design systems, shadcn/ui, Tailwind, Atomic Design, research synthesis, component specs, design audits, or design-to-code generation.
---

# Mémoire Design Tooling

Use Memoire as the local design evidence layer before making frontend changes.

## Commands
```bash
npm i -g @memi-design/cli
memi suite init --project .
memi daemon start --project . --port auto
memi daemon status --json
memi status
memi diagnose .
memi ux audit . --json
memi mcp start --no-figma
memi suite run design-audit --project . --json
memi suite run research-vibe-design --project . --json
memi research design --write-specs --mermaid-jam --json
memi mermaid-jam export --from research --json
memi compose "Create an Atomic Design implementation plan"
```

## Rules
- Inspect `.memoire/`, `memoire.agent.yaml`, specs, tokens, README/AGENTS instructions, and Figma state before changing UI.
- Prefer warmed daemon context and suite recipes when they exist; `memoire.agent.yaml` is the local contract for product memory, harnesses, skills, and recipes.
- For research-backed vibe design, preview with `research.design_package`, write only approved specs with `research.generate_specs`, and export FigJam source through `mermaid_jam.export`.
- Keep every component at an Atomic Design level.
- Prefer shadcn/ui and Tailwind.
- Treat UX Tenets and Traps as the review layer: protect clarity, feedback, control, consistency, accessibility, error recovery, progressive disclosure, workflow fit, trust, and state continuity.
- Use Memoire audits and specs as evidence in final responses.
