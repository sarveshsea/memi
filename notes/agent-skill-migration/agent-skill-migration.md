---
name: Agent Skill Migration
description: >
  Move skills, memories, context files, and agent rules between Memoire and peer agent ecosystems.
activateOn: migrate skills, convert agent memory, import OpenClaw, export Hermes skill
freedomLevel: high
category: connect
tags:
  - skills
  - migration
  - memory
  - codex
  - claude
---

# Agent Skill Migration

Move skills, memories, context files, and agent rules between Memoire and peer agent ecosystems.

## When to Use

Use this Note when a Memoire or Studio run needs migrate skills, convert agent memory, import OpenClaw, export Hermes skill.

## Workflow

1. Inventory source skills, memories, context files, tool allowlists, and secrets separately.
2. Convert instructions first, then map activation metadata, then map install location.
3. Never migrate raw secrets. Replace them with environment variable or keychain references.
4. Run a dry-run import or install command before copying into the destination agent profile.
5. Write a migration report with skipped files, renamed skills, and manual follow-up.


## Sources

- https://github.com/nousresearch/hermes-agent
- https://hermes-agent.nousresearch.com/docs/reference/skills-catalog/
- https://docs.openclaw.ai/cli
