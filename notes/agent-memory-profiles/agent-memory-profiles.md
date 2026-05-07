---
name: Agent Memory Profiles
description: >
  Design durable user, project, persona, and task memory profiles for local agents.
activateOn: agent memory profile, persona file, context file, persistent memory
freedomLevel: high
category: connect
tags:
  - memory
  - profiles
  - persona
  - context
  - project
---

# Agent Memory Profiles

Design durable user, project, persona, and task memory profiles for local agents.

## When to Use

Use this Note when a Memoire or Studio run needs agent memory profile, persona file, context file, persistent memory.

## Workflow

1. Separate durable identity, user preferences, project rules, and temporary task state.
2. Keep high-authority files small and specific. Long transcripts belong in searchable knowledge stores.
3. Prefer append-only memory updates with date, source, and confidence fields.
4. When migrating memory, preserve provenance and mark stale or unverifiable entries.
5. Review memory before a sensitive run so old preferences do not override current instructions.


## Sources

- https://github.com/nousresearch/hermes-agent
- https://hermes-agent.nousresearch.com/docs/reference/skills-catalog/
- https://docs.openclaw.ai/cli
