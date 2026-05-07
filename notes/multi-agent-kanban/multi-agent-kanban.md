---
name: Multi-Agent Kanban
description: >
  Coordinate multiple local agents through a durable board with owner, state, and evidence fields.
activateOn: multi agent board, kanban swarm, agent coordination, durable task board
freedomLevel: high
category: connect
tags:
  - multi-agent
  - kanban
  - coordination
  - sessions
  - handoff
---

# Multi-Agent Kanban

Coordinate multiple local agents through a durable board with owner, state, and evidence fields.

## When to Use

Use this Note when a Memoire or Studio run needs multi agent board, kanban swarm, agent coordination, durable task board.

## Workflow

1. Create columns for Backlog, Ready, Running, Review, Blocked, and Done.
2. Give each card one owner agent, one workspace, one expected artifact, and one verification command.
3. Move cards by evidence, not by confidence. A card reaches Review only when the artifact exists.
4. Capture conflicts as Blocked with the exact file, command, or dependency that caused the stop.
5. Summarize completed cards into project memory so future runs can reuse the operating pattern.


## Sources

- https://github.com/nousresearch/hermes-agent
- https://hermes-agent.nousresearch.com/docs/user-guide/cli
- https://docs.openclaw.ai/cli
