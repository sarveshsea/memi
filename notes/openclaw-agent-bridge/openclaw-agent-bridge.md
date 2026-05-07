---
name: OpenClaw Agent Bridge
description: >
  Connect Memoire to OpenClaw onboarding, agents, gateway health, MCP, and approval flows.
activateOn: OpenClaw setup, gateway agent route, openclaw health, openclaw mcp
freedomLevel: high
category: connect
tags:
  - openclaw
  - gateway
  - agents
  - mcp
  - approvals
---

# OpenClaw Agent Bridge

Connect Memoire to OpenClaw onboarding, agents, gateway health, MCP, and approval flows.

## When to Use

Use this Note when a Memoire or Studio run needs OpenClaw setup, gateway agent route, openclaw health, openclaw mcp.

## Workflow

1. Start with `openclaw onboard` or `openclaw configure` so workspace, provider, and channel settings are explicit.
2. Use `openclaw agents list` and `openclaw agents add <name>` for separate agent profiles.
3. Check `openclaw health --json` before routing work through the Gateway.
4. Inspect `openclaw mcp list` and `openclaw approvals get` before enabling tool calls.
5. Prefer `--json` and `--non-interactive` for scripted Memoire handoffs.


## Sources

- https://docs.openclaw.ai/cli
- https://docs.openclaw.ai/start/wizard
- https://docs.openclaw.ai/cli/models
