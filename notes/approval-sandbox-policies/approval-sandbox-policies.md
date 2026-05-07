---
name: Approval Sandbox Policies
description: >
  Define approval, sandbox, filesystem, and command policy for local autonomous agents.
activateOn: agent approvals, sandbox mode, command allowlist, secure agent run
freedomLevel: high
category: connect
tags:
  - approvals
  - sandbox
  - allowlist
  - security
  - filesystem
---

# Approval Sandbox Policies

Define approval, sandbox, filesystem, and command policy for local autonomous agents.

## When to Use

Use this Note when a Memoire or Studio run needs agent approvals, sandbox mode, command allowlist, secure agent run.

## Workflow

1. Classify every run as read-only, workspace-write, or full-access before launching an agent.
2. Bind filesystem writes to the project root unless the task explicitly requires external paths.
3. Allowlist narrow commands by absolute path or stable prefix, not broad shell access.
4. Require approval for network, package install, credential, desktop automation, and deletion steps.
5. Store the final policy next to the session transcript so future agents inherit the boundary.


## Sources

- https://docs.openclaw.ai/cli
- https://github.com/nousresearch/hermes-agent
- https://developers.openai.com/codex/cli
