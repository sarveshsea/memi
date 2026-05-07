---
name: Agent Session Checkpoints
description: >
  Capture restartable agent sessions with checkpoints, rollback notes, and resume metadata.
activateOn: checkpoint agent run, rollback session, resume session, session cleanup
freedomLevel: high
category: connect
tags:
  - sessions
  - checkpoints
  - rollback
  - resume
  - history
---

# Agent Session Checkpoints

Capture restartable agent sessions with checkpoints, rollback notes, and resume metadata.

## When to Use

Use this Note when a Memoire or Studio run needs checkpoint agent run, rollback session, resume session, session cleanup.

## Workflow

1. Create a checkpoint before broad edits, dependency updates, generated files, or external mutations.
2. Record session id, prompt, harness, cwd, branch, dirty-state summary, and verification command.
3. Resume by explicit session id when possible rather than reconstructing context from terminal history.
4. On rollback, preserve the failure explanation and exact reverted scope.
5. Clean old sessions only after artifacts and useful lessons have been moved into durable memory.


## Sources

- https://hermes-agent.nousresearch.com/docs/user-guide/cli
- https://github.com/nousresearch/hermes-agent
- https://docs.openclaw.ai/cli
