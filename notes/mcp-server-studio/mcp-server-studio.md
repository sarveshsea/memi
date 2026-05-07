---
name: MCP Server Studio
description: >
  Expose Memoire Studio context, tools, and artifacts to other agents through MCP.
activateOn: MCP server, expose Studio tools, connect external agent to Memoire
freedomLevel: high
category: connect
tags:
  - mcp
  - studio
  - tools
  - resources
  - agent
---

# MCP Server Studio

Expose Memoire Studio context, tools, and artifacts to other agents through MCP.

## When to Use

Use this Note when a Memoire or Studio run needs MCP server, expose Studio tools, connect external agent to Memoire.

## Workflow

1. Choose read-only resources first: status, harnesses, notes, project memory, knowledge, and traces.
2. Expose mutating tools only when the caller can identify workspace, action, approval mode, and session id.
3. Return structured JSON from MCP tools instead of terminal prose.
4. Keep browser, shell, file write, and Figma tools behind explicit capability gates.
5. Document the exact MCP command, environment variables, and resource names in the Note install report.


## Sources

- https://docs.openclaw.ai/cli
- https://github.com/nousresearch/hermes-agent
- https://modelcontextprotocol.io/docs
