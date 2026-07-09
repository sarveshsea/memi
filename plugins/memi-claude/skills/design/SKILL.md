---
description: Use memi before frontend, design-system, shadcn/ui, Tailwind, Figma, UX audit, or component-registry work.
---

# memi Design Tooling

Use memi as Claude Code's local interface-understanding layer before broad UI changes. The goal is to gather product-system evidence before editing code.

## First Run

```bash
npm i -g @memi-design/cli
memi --version
memi mcp start --no-figma
```

If a repository has not been prepared for memi yet:

```bash
memi suite init --project .
memi agent install claude-code --project .
```

## UI Preflight

Run the smallest useful evidence loop before changing UI code:

```bash
memi agent brief . --agent claude-code --intent "$ARGUMENTS" --json
memi diagnose . --json
memi ux audit . --json
memi craft audit . --json
memi tokens --from ./src --report
memi shadcn doctor
```

If the work depends on a live route, replace `.` with the local URL for `diagnose`, `ux audit`, and `craft audit`.

## How To Use The Evidence

1. Read local instructions first: `CLAUDE.md`, `AGENTS.md`, README files, `.memoire/`, specs, tokens, and `memoire.agent.yaml`.
2. Treat `memi agent brief` as the preflight contract: it should shape the plan, risk list, and final verification.
3. Use `diagnose`, `ux audit`, `craft audit`, and `tokens` outputs to avoid inventing design-system facts.
4. Prefer existing components, shadcn/ui primitives, Tailwind tokens, and Atomic Design boundaries already present in the app.
5. End with the memi commands run, artifacts produced, files changed, and the next verification command.

## Registry Work

For installable UI or examples:

```bash
memi shadcn export --out public/r
memi shadcn doctor
memi publish --name @you/design-system
```

Keep registry output valid, source-controlled, and linked from the app or proof repo.
