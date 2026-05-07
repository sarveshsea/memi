---
name: Secure Secrets for Agents
description: >
  Handle agent credentials with env refs, redaction, least privilege, and non-leaking prompts.
activateOn: agent secret, env key, credential setup, redaction, api key handling
freedomLevel: high
category: connect
tags:
  - secrets
  - redaction
  - env
  - security
  - credentials
---

# Secure Secrets for Agents

Handle agent credentials with env refs, redaction, least privilege, and non-leaking prompts.

## When to Use

Use this Note when a Memoire or Studio run needs agent secret, env key, credential setup, redaction, api key handling.

## Workflow

1. Store secret references, not secret values, in Notes, prompts, configs, logs, and screenshots.
2. Separate setup commands from verification commands so auth checks can run without exposing keys.
3. Scope keys by provider, workspace, and purpose when the platform supports it.
4. Redact command output before handing it to another agent or saving it in memory.
5. Rotate or revoke credentials immediately if a secret appears in terminal, browser, screenshot, or artifact output.


## Sources

- https://docs.openclaw.ai/cli
- https://github.com/nousresearch/hermes-agent
- https://developers.openai.com/codex/cli
