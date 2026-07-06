# Private registry distribution

How a company ships its design system to product teams using memi's shadcn-native registry output — on infrastructure it controls. Nothing here requires a public host.

## Export the registry

```bash
memi shadcn export --out public/r      # shadcn registry.json + per-item /r/*.json
memi init @acme/design-system          # or: scaffold a publishable registry package
```

The output is plain shadcn registry format: works with `npx shadcn add`, v0 design systems, and any tool that reads `registry.json`. memi adds Atomic Design metadata and CSS-variable theme items on top; consumers that don't understand the extras ignore them.

## Hosting options

| Option | How | Auth |
| --- | --- | --- |
| Static host / CDN | Serve `public/r/` from S3+CloudFront, Vercel, Netlify, nginx | Signed URLs / VPN / IP allowlist |
| Private npm package | `memi init @acme/ds && npm publish --access restricted` | npm token (`.npmrc`) |
| GitHub raw + token | Commit `public/r/` to a private repo | `shadcn add` with a `GITHUB_TOKEN`-bearing URL |
| Internal registry proxy | Artifactory/Verdaccio in front of the npm package | Registry credentials teams already have |

shadcn's CLI fetches items over plain HTTPS — any URL your developers can `curl` with their existing credentials works as a private registry.

## Tokens: DTCG for everything that isn't shadcn

The registry serves components; tokens travel further (iOS, Android, docs sites, Figma plugins). memi reads and writes the W3C Design Tokens format (DTCG):

```bash
# Export the registry's tokens as a DTCG document (MCP: get_tokens with format "dtcg")
memi mcp start --no-figma   # then: get_tokens { format: "dtcg" }

# Import a DTCG file someone else produced (Style Dictionary, Tokens Studio, …)
# MCP: sync_design_tokens { dtcgFile: "./acme.tokens.json" }
```

Round-trips are lossless: memi stores its full token shape (type, collection, CSS variable, per-mode values) under `$extensions["cv.memoire"]` while keeping spec-compliant `$type`/`$value` for every other DTCG consumer. Aliases (`{colors.primary}`) resolve on import; unresolvable ones are kept as literals **and reported as warnings** — never silently dropped.

## Keeping consumers honest

A private registry is a contract; memi's gate verifies the consuming side holds up its end:

```bash
memi ci                        # token discipline gate on the consuming app
memi diagnose --json | jq .policy.hash    # same policy hash across teams = comparable scores
```

Commit the same `memoire.policy.json` in every consuming repo (or vendor it from a shared repo) and each team's design-health score is measured under identical rules — that's what makes cross-team numbers meaningful instead of decorative.

## Versioning discipline

- Pin the registry package/URL version in consuming apps, exactly like the CI action pins the CLI: upgrades should be reviewed diffs, not silent drift.
- `memi diff` shows what changed between design-system snapshots before you publish.
- Registry releases and baseline updates travel in the same PR when a new component intentionally changes gate results — reviewers see cause and effect together.
