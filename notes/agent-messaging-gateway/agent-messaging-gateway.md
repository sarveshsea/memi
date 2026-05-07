---
name: Agent Messaging Gateway
description: >
  Design gateway-backed agent delivery through chat, email, and team messaging channels.
activateOn: agent messaging, gateway setup, platform channel, delivery routing
freedomLevel: high
category: connect
tags:
  - gateway
  - messaging
  - telegram
  - discord
  - slack
---

# Agent Messaging Gateway

Design gateway-backed agent delivery through chat, email, and team messaging channels.

## When to Use

Use this Note when a Memoire or Studio run needs agent messaging, gateway setup, platform channel, delivery routing.

## Workflow

1. Name the channel, audience, allowed users, and delivery direction before connecting an agent.
2. Keep setup, health, start, stop, and restart commands separate from message sending commands.
3. Route every inbound message to a named agent profile and a known workspace.
4. Log delivery target, session id, channel, and reply destination in the run output.
5. Treat channel auth as secret material and store only references in Notes.


## Sources

- https://github.com/nousresearch/hermes-agent
- https://hermes-agent.nousresearch.com/docs/user-guide/cli
- https://docs.openclaw.ai/cli
