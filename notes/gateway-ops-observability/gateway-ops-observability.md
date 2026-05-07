---
name: Gateway Ops Observability
description: >
  Observe and debug local agent gateways, daemons, health probes, logs, and usage costs.
activateOn: gateway logs, agent health, daemon status, usage cost, ops troubleshooting
freedomLevel: high
category: connect
tags:
  - gateway
  - logs
  - health
  - observability
  - daemon
---

# Gateway Ops Observability

Observe and debug local agent gateways, daemons, health probes, logs, and usage costs.

## When to Use

Use this Note when a Memoire or Studio run needs gateway logs, agent health, daemon status, usage cost, ops troubleshooting.

## Workflow

1. Check daemon status, gateway health, model auth, and channel connectivity before debugging prompts.
2. Collect logs with timestamps and session ids so failures can be tied to a specific agent turn.
3. Record usage cost and quota state when provider limits or slowdowns are plausible.
4. Distinguish cached health snapshots from live probes in reports.
5. When a gateway is unhealthy, stop new tasks before restarting or changing config.


## Sources

- https://docs.openclaw.ai/cli
- https://github.com/nousresearch/hermes-agent
- https://docs.openclaw.ai/cli/models
