---
name: memoire-design-tooling
description: Use when an OpenClaw workspace task involves UI design, Figma, design systems, shadcn/ui, Tailwind, Atomic Design, research synthesis, design audits, component specs, or code generation from design evidence.
version: 1.1.0
author: Sarvesh Chidambaram
license: MIT
metadata: {"openclaw":{"homepage":"https://github.com/sarveshsea/m-moire","requires":{"bins":["memi"]},"install":[{"id":"npm","kind":"node","package":"@sarveshsea/memoire","bins":["memi"],"label":"Install Memoire CLI with npm"}]}}
---

# Mémoire Design Tooling

## Overview
Memoire gives OpenClaw a local design intelligence layer: warmed project memory, suite recipes, Figma bridge context, research memory, Atomic Design specs, shadcn/ui codegen, Tailwind token checks, and evidence-backed UI audits.

## When to Use
- The task mentions interface design, product flows, design systems, Figma, Tailwind, shadcn/ui, components, accessibility, screenshots, or research synthesis.
- The workspace includes `.memoire/`, component specs, tokens, or a frontend app that needs design-quality improvement.
- The agent needs to install or verify local design tooling before editing UI code.

## Setup
```bash
npm i -g @sarveshsea/memoire
memi suite init --project .
memi daemon start --project . --port auto
memi daemon status --json
memi status
memi mcp start --no-figma
memi suite run design-audit --project . --json
memi suite run research-vibe-design --project . --json
memi research design --write-specs --mermaid-jam --json
memi mermaid-jam export --from research --json
```

## Workflow
1. Verify `memi` exists with `memi status`; install with npm if the binary is missing.
2. Initialize or read `memoire.agent.yaml`; it declares memory sources, harnesses, skills, and recipes for the workspace.
3. Prefer the warmed daemon path with `memi daemon start --project . --port auto`, then check `memi daemon status --json`.
4. Inspect `.memoire/`, specs, tokens, design docs, `memoire.agent.yaml`, and existing agent instructions before choosing an implementation path.
5. For audits, run `memi diagnose .`, `memi audit`, or `memi suite run design-audit --project . --json` and use file-backed findings as evidence.
6. For research-backed vibe design, use `memi research design`, `research.design_package`, `research.generate_specs`, and `mermaid_jam.export` before coding the product surface.
7. For generation, create or reuse specs, keep the Atomic Design level explicit, then run `memi generate`.
8. For Figma work, connect through `memi connect` or use the Figma-independent MCP server with `memi mcp start --no-figma`.
9. Keep final output concrete: commands run, design decisions, files changed, remaining risks, and how to verify.

## Safety
Treat third-party skills and generated code as untrusted until reviewed. Do not paste secrets into prompts or logs. Avoid destructive shell commands unless the user explicitly approves them.
