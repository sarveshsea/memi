# GitHub Action Marketplace release checklist

Publish **memi design CI** (`action.yml` at repo root) to the GitHub Marketplace.

## Prerequisites (all must pass)

| Check | Status |
| --- | --- |
| `action.yml` exists at repo root | Required |
| `description` in `action.yml` is **under 125 characters** | Required — was the blocker in release UI |
| README exists in the repo | Required |
| `name`, `description`, `branding.icon`, `branding.color` valid | Required |

Current compliant description (122 chars):

```yaml
description: >-
  Design CI gate: full-tree scan, PR scope, baseline filter, SARIF, and health
  report. Deterministic, no LLM in enforcement.
```

Verify locally:

```bash
node -e "const y=require('fs').readFileSync('action.yml','utf8');const m=y.match(/description:\\s*>-\\s*([\\s\\S]*?)(?=\\nauthor:)/);const d=m[1].replace(/\\n\\s*/g,' ').trim();console.log(d.length, d)"
```

## Release steps

### A. Ship the fix to main (CLI / PR)

1. Merge the v2.5 agent-design-CI branch (`action.yml` ≤125 chars, CLI pin, docs, scaffold command, MCP tool).
2. Tag **`v2.5.0`** on the merge commit. Do not reuse old 2.4 tags; the earlier tags represent the pre-scaffold release line.

```bash
git tag -a v2.5.0 -m "v2.5.0 — Agent design CI + scaffolded file creation"
git push origin v2.5.0
gh release create v2.5.0 --title "v2.5.0 — Agent design CI + scaffolded file creation" --generate-notes
```

`gh release create` cannot set Marketplace categories. Finish in the UI:

### B. Marketplace UI (required)

1. Open the release: https://github.com/sarveshsea/memi/releases/tag/v2.5.0
2. Click **Edit** (or draft from `action.yml` banner on the repo).
3. Check **Publish this Action to the GitHub Marketplace**.
4. Confirm validation is green:
   - Name: `memi design CI`
   - Description: under 125 chars
   - Icon: `layout`
   - Color: `purple`
   - README present
5. **Primary category:** Code quality
6. **Secondary category:** Continuous integration
7. Publish / update the release.

### C. Major version floating tag

```bash
git tag -f v2 v2.5.0
git push -f origin v2
```

(Only the floating `v2` tag is force-moved — never force-push commits.)

## After publish — consumer workflow

```yaml
name: design
on:
  pull_request:
    branches: [main]

jobs:
  design:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: sarveshsea/memi@v2.5.0
        with:
          version: "2.5.0"
          # fail-on: high
          # report: "true"
          # upload-sarif: "false"   # forks without security-events
```

## Verify locally before release

```bash
npm run check:release
npm test
```

## Fork PR note

Fork PRs often lack `security-events: write`. Document `upload-sarif: "false"` for fork workflows. See [CI_RECIPES.md](./CI_RECIPES.md).
