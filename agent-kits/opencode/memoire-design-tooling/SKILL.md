---
name: memoire-design-tooling
description: Use when an OpenCode task involves UI design, interface craft, Figma, design systems, shadcn/ui, Tailwind, Atomic Design, research synthesis, component specs, design audits, or design-to-code generation.
---

# memi Design Tooling

Use memi as the interface-understanding, design-system, and user research layer for frontend work.

## Commands
```bash
npm i -g @memi-design/cli
memi suite init --project .
memi daemon start --project . --port auto
memi daemon status --json
memi agent install --dry-run --json
memi agent brief . --agent opencode --intent "Audit this interface" --json
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
memi compose "Audit this UI and produce an Atomic Design fix plan"
memi generate
```

## Rules
- Read project memory, `memoire.agent.yaml`, suite recipes, runtime routes, screenshots, research evidence, and design instructions before coding.
- Start with `memi agent brief . --agent opencode --intent "<task>" --json` to get evidence commands, cost controls, compatibility installs, and handoff requirements.
- Prefer warmed daemon context and MCP tools before broad UI edits.
- For research-backed vibe design, use `memi research synthesize`, `memi simulate plan`, `research.design_package`, `research.generate_specs`, and `mermaid_jam.export` before coding a product surface.
- Keep Atomic Design levels explicit.
- Prefer shadcn/ui and Tailwind.
- Treat UX Tenets and Traps as the review layer for clarity, feedback, control, consistency, accessibility, error recovery, progressive disclosure, workflow fit, trust, and state continuity.
- Treat Interface Craft as the polish layer for focusing mechanism, visual hierarchy, spacing rhythm, color intentionality, component cohesion, responsive resilience, and user context.
- Verify with memi diagnostics or project tests before completion.
