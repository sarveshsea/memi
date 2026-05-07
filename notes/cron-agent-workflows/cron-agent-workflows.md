---
name: Cron Agent Workflows
description: >
  Turn repeatable agent work into scheduled jobs with explicit outputs and safe permissions.
activateOn: scheduled agent, cron workflow, recurring report, automated run
freedomLevel: high
category: connect
tags:
  - cron
  - automation
  - scheduler
  - reports
  - monitoring
---

# Cron Agent Workflows

Turn repeatable agent work into scheduled jobs with explicit outputs and safe permissions.

## When to Use

Use this Note when a Memoire or Studio run needs scheduled agent, cron workflow, recurring report, automated run.

## Workflow

1. Define schedule, workspace, model, permission mode, output channel, and stop condition up front.
2. Make every recurring job idempotent and safe to rerun after a crash.
3. Prefer read-only monitors unless the task explicitly needs writes.
4. Emit a concise run summary with changed files, external calls, failures, and next action.
5. Keep mutation jobs paused until one manual run proves the prompt, permissions, and artifact path.


## Sources

- https://github.com/nousresearch/hermes-agent
- https://docs.openclaw.ai/cli
- https://developers.openai.com/codex/use-cases
