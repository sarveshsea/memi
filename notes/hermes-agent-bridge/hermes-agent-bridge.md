---
name: Hermes Agent Bridge
description: >
  Run Hermes Agent from Memoire with CLI, skills, toolsets, worktree, and session recipes.
activateOn: hermes agent setup, Hermes CLI delegation, skills preload, worktree agent run
freedomLevel: high
category: connect
tags:
  - hermes
  - cli
  - skills
  - toolsets
  - worktrees
---

# Hermes Agent Bridge

Run Hermes Agent from Memoire with CLI, skills, toolsets, worktree, and session recipes.

## When to Use

Use this Note when a Memoire or Studio run needs hermes agent setup, Hermes CLI delegation, skills preload, worktree agent run.

## Workflow

1. Check `hermes --version` and `hermes doctor` before wiring a session.
2. Use `hermes chat -q` for non-interactive delegation and `hermes --tui` for interactive terminal work.
3. Preload focused skills with `hermes -s skill-name` or `hermes chat -s skill-name -q ...`.
4. Use `hermes -w` for isolated git worktree execution when multiple agent lanes should not collide.
5. Record the provider, model, skills, workspace, and resume id in the Memoire run note.


## Sources

- https://hermes-agent.nousresearch.com/docs/user-guide/cli
- https://github.com/nousresearch/hermes-agent
- https://hermes-agent.nousresearch.com/docs/reference/skills-catalog/
