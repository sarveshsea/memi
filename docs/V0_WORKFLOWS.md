# Shadcn and v0 Workflows

Historical archive for the `0.14.1` launch. The current v2 distribution path is tracked in `docs/GROWTH_TO_1M_NPM.md`, `docs/METRICS.md`, and `docs/STARSTRUCK.md`.

Use these archived demos to understand the original shadcn/v0 wedge. The point was simple: Memoire turns a real app into shadcn-native registry context that `shadcn`, v0, AI editors, and npm can consume.

## 60-second terminal demo

```bash
npm i -g @memi-design/cli

# 1. Diagnose the current app.
memi diagnose --no-write

# 2. Export shadcn-compatible registry files.
memi shadcn export --out public/r --name acme --homepage https://acme.com

# 3. Validate the output.
memi shadcn doctor --out public/r

# 4. Serve locally for shadcn, v0, and AI editors.
memi shadcn serve --out public/r --port 4014
```

## Install with shadcn

```bash
npx shadcn@latest add https://acme.com/r/button.json
```

Memoire writes the same `/r/{item}.json` shape shadcn expects: registry item name, type, dependencies, file paths, target paths, optional CSS variables, and installable file content.

## Install with Memoire

```bash
memi registry install Button --from @you/design-system
memi add Button --from ai-chat
memi add Button --from https://acme.com/r/button.json
```

`memi add` and `memi registry install` resolve local paths, URLs, GitHub refs, npm packages, and catalog aliases. Published npm packages no longer need to exist in local `node_modules` first.

## Open in v0

Use the generated `openInV0Url` field from `examples/site-bundle/catalog.json` or a registry item:

```text
https://v0.dev/chat/api/open?url=https%3A%2F%2Facme.com%2Fr%2Fbutton.json
```

v0 can use a registry item as design-system context for AI generation. Keep the registry item public and prefer direct item URLs over broad homepage links.

## AI editor MCP

Expose the generated registry through shadcn MCP or Memoire MCP:

```json
{
  "mcpServers": {
    "memoire": {
      "command": "memi",
      "args": ["mcp"]
    },
    "shadcn": {
      "command": "npx",
      "args": ["-y", "shadcn@latest", "registry:mcp"],
      "env": {
        "REGISTRY_URL": "https://acme.com/r/registry.json"
      }
    }
  }
}
```

Memoire MCP tools for this flow:

- `get_shadcn_registry`
- `get_registry_item`
- `diagnose_app_quality`
- `plan_ui_fixes`
