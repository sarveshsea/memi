---
name: Model Router Diagnostics
description: >
  Diagnose provider auth, model routing, quota windows, and fallback behavior before agent runs.
activateOn: model router, provider auth, quota check, fallback model, reasoning setting
freedomLevel: high
category: connect
tags:
  - models
  - providers
  - auth
  - routing
  - diagnostics
---

# Model Router Diagnostics

Diagnose provider auth, model routing, quota windows, and fallback behavior before agent runs.

## When to Use

Use this Note when a Memoire or Studio run needs model router, provider auth, quota check, fallback model, reasoning setting.

## Workflow

1. List configured providers and default models before starting a long-running session.
2. Check OAuth, API-key, environment, and config-backed credentials separately.
3. Run live probes only when the user accepts token and rate-limit cost.
4. Record fallback order, reasoning effort, sandbox mode, and provider-specific model id.
5. If routing fails, report whether the problem is missing auth, expired auth, unsupported model, or quota.


## Sources

- https://docs.openclaw.ai/cli/models
- https://hermes-agent.nousresearch.com/docs/user-guide/cli
- https://developers.openai.com/codex/cli
