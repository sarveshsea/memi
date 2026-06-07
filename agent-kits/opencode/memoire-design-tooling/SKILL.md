---
name: memoire-design-tooling
description: Use when an OpenCode task involves UI design, Figma, design systems, shadcn/ui, Tailwind, Atomic Design, research synthesis, component specs, design audits, or design-to-code generation.
---

# Mémoire Design Tooling

Use Memoire as the design-system and research layer for frontend work.

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
memi compose "Audit this UI and produce an Atomic Design fix plan"
memi generate
```

## Rules
- Read project memory, `memoire.agent.yaml`, suite recipes, and design instructions before coding.
- Prefer warmed daemon context and MCP tools before broad UI edits.
- For research-backed vibe design, use `research.design_package`, `research.generate_specs`, and `mermaid_jam.export` before coding a product surface.
- Keep Atomic Design levels explicit.
- Prefer shadcn/ui and Tailwind.
- Treat UX Tenets and Traps as the review layer for clarity, feedback, control, consistency, accessibility, error recovery, progressive disclosure, workflow fit, trust, and state continuity.
- Verify with Memoire diagnostics or project tests before completion.
