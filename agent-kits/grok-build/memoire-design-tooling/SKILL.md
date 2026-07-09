---
name: memoire-design-tooling
description: Use when a task involves UI design, interface understanding, interface craft, Figma, design systems, shadcn/ui, Tailwind, UX audits, user research, Atomic Design, component specs, MCP, or design-to-code generation — especially inside Grok Build (Grok 4.5).
---

# memi Design Tooling for Grok Build

Use memi as the local interface-understanding layer before broad frontend changes in Grok Build (Grok 4.5). Gather evidence about the product UI before editing code.

Agents do not have great taste by default. memi supplies **product-system evidence** (tokens, components, UX traps, craft scores, CI gates) so Grok stops guessing. Pair this with strong craft skills when polish matters — see [REFERENCES.md](REFERENCES.md).

## Grok Build fast path

```bash
npm i -g @memi-design/cli
curl -fsSL https://x.ai/cli/install.sh | bash
memi agent install grok-build --project .
grok inspect
grok mcp doctor memoire
memi agent brief . --intent "Improve this interface" --agent grok-build --json
memi diagnose . --json
memi ux audit . --json
memi craft audit . --json
memi tokens --from ./src --report
```

Headless Grok Build with memi evidence:

```bash
grok -p "Run memi agent brief . --json, then diagnose and ux audit. Propose a UI patch plan grounded in the evidence."
```

## What install writes

| Path | Why |
| --- | --- |
| `.grok/config.toml` | Native Grok MCP (`[mcp_servers.memoire]`) |
| `.grok/skills/memoire-design-tooling/` | Native Grok skill discovery |
| `.agents/skills/memoire-design-tooling/` | Universal / AGENTS.md skill discovery |
| `memoire.agent.yaml` | Suite recipes (design-audit, handoff, research) |

## MCP wiring

Project install writes `.grok/config.toml` with the memi stdio server. Manual alternative:

```bash
grok mcp add memoire --scope project -- memi mcp start --no-figma
grok mcp list
grok mcp doctor memoire
```

Grok also loads project `.mcp.json` and `.cursor/mcp.json` via compat (lower priority than `config.toml`). `memi agent install claude-code --project .` is a JSON fallback.

## Interface understanding protocol

1. Read local instructions: `AGENTS.md`, README, `.memoire/`, specs, tokens, and `memoire.agent.yaml`.
2. Run `memi agent brief . --intent "<task>" --agent grok-build --json` as the preflight contract.
3. Collect evidence with `memi diagnose`, `memi ux audit --json`, `memi craft audit --json`, and `memi tokens --from ./src --report`.
4. Use MCP tools (`diagnose_app_quality`, `audit_ux_tenets_traps`, `audit_interface_craft`, `prepare_design_agent_brief`, `get_tokens`, `get_shadcn_registry`) when the memi MCP server is connected.
5. Prefer shadcn/ui primitives and Tailwind tokens over one-off colors.
6. Map changes to Atomic Design levels and cite verification commands in the handoff.

## Review format (required for UI diffs)

When reviewing UI against memi evidence, use a markdown table:

| Finding | Evidence | Fix |
| --- | --- | --- |
| Raw hex in Button | `memi tokens` / diagnose | Map to `--primary` token |
| Missing focus ring | `memi ux audit` | Restore shadcn focus styles |
| Hierarchy collapse | `memi craft audit` | One clear focal element |

## Design CI gate

```bash
memi init --team
memi ci
```

In GitHub Actions: `uses: sarveshsea/memi@v2` (Action tag `v2.4.1`; CLI pin defaults to published `@memi-design/cli@2.4.0`).

## Dependencies and references

See [REFERENCES.md](REFERENCES.md) for the memi ↔ MCP ↔ Action ↔ design-sandbox ↔ craft-skills graph.
