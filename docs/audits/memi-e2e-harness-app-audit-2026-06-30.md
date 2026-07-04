# memi Harness + macOS App E2E Audit - 2026-06-30

## Verdict

**Recommendation: beta-only for a Codex-backed design workbench. Blocked as a Claude Design replacement.**

Overall score: **63/100**.

memi is credible as an engine-backed repository workbench: the npm release gates pass, the MCP and Codex plugin smokes pass, Studio can create/cancel/replay fake Codex and Claude sessions, workspace rejection works, and the Codex command shape matches the local Codex CLI. It still does not clear the higher bar set in this audit: a lean macOS app that replaces Claude Design as a first-pass visual generator.

The blunt read: **memi currently wins more after the first pass than on the first visual pass**. Its durable memory, harness receipts, artifacts, and design-system grounding are the product. That is valuable, but it is not yet visual-generator parity unless the default flow produces a polished editable dashboard artifact quickly, with a real preview and continuation path, without exposing the full machinery first.

## Scope And Method

Audited surfaces:

- Repo: `@memi-design/cli@1.1.1` in `/Users/sarveshchidambaram/Desktop/Projects/Other/ark`.
- Studio runtime: built `dist/index.js studio serve` with fake Codex and Claude binaries in a temp workspace.
- Codex harness contract: `src/studio/harness-manifest.json`, `src/studio/harnesses.ts`, `src/studio/config.ts`, local `codex exec --help`, local `codex login status`.
- Agent install surfaces: `agent install --dry-run --json`, Codex plugin manifest, MCP `server.json`.
- macOS app source/release: public `sarveshsea/memi-studio`, release `v1.0.4`, updater `latest.json`, local cloned source under `/tmp/memi-studio-audit`.
- Remote installer trust surface: `https://www.interfacecraft.dev/api/install-skills`, inspected but not executed.

No-install line respected:

- No `curl | bash` was executed.
- No Homebrew, app installer, global npm install, or app installation was run.
- No real writes were made into `~/.codex`, `~/.claude`, `~/plugins`, or `/Applications`.
- Dry-run and fake CLI probes used temp homes/workspaces where applicable.

## Baseline Truth

| Item | Evidence |
| --- | --- |
| Current branch | `codex/launch-readiness-hardening...origin/codex/launch-readiness-hardening` |
| Dirty state | Only pre-existing untracked `product-hunt-assets/` before this audit file |
| Package | `@memi-design/cli@1.1.1` |
| npm latest | `@memi-design/cli@1.1.1` from `npm view` |
| Release workflows present | `.github/workflows/ci.yml`, `runtime-release.yml`, `publish.yml`, `publish-mcp-registry.yml`, `release-binaries.yml` |
| MCP registry manifest | `server.json` is `io.github.sarveshsea/memi@1.1.1`, npm transport `mcp start --no-figma` |
| Codex plugin manifest | `plugins/memoire/.codex-plugin/plugin.json` is `memoire@1.1.1`, declares skills, MCP servers, privacy and terms URLs |
| App release | `sarveshsea/memi-studio` latest release `v1.0.4`, published `2026-06-07T16:59:34Z` |
| App runtime pin | `memi-studio@1.0.4` pins memi runtime `0.18.4`, tag `runtime-v0.18.4` |
| App updater | `latest.json` exists for `darwin-aarch64` and `darwin-x86_64` with signatures and app tarball URLs |
| Local installed app | No `/Applications` app found by name; only user Library cache/WebKit folders found |

Drift risk: the public app is still on runtime `0.18.4`, while this CLI repo is at `1.1.1` with newer harness hardening. That needs an explicit compatibility matrix, not an implied "latest app equals latest engine" assumption.

## No-Install Verification Results

| Check | Result | Notes |
| --- | --- | --- |
| `npm run check:release` | Pass | `Release consistency check passed for v1.1.1.` |
| `npm run lint` | Pass | TypeScript checks passed for app and plugin config |
| `npm test` | Pass | 204 files, 1560 tests passed |
| `npm run build` | Pass | CLI and plugin bundle built |
| `npm run smoke:mcp` | Pass | 41 MCP tools exposed, including `pull_design_system`, `diagnose_app_quality`, `audit_ux_tenets_traps`, `design_doc`, `get_shadcn_registry` |
| `npm run smoke:codex-plugin` | Pass | Marketplace command resolves to `codex plugin marketplace add sarveshsea/memi --ref main --sparse .agents/plugins --sparse plugins/memoire` |
| `node dist/index.js diagnose . --json` | Pass | Score 95, but scan is noisy by default: 500 files, bundled resources, `.superpowers`, and generated site assets included |
| `node dist/index.js ux audit . --json` | Pass | Score 74; flags raw colors, type drift, arbitrary Tailwind usage |
| `node dist/index.js studio status --json` | Pass | Reports default harness Codex, Claude ready, Codex installed but auth/config blocked |
| `node dist/index.js studio logs --json` | Pass | Existing persisted sessions replay; logs need privacy-aware UI handling because prompts and cwd values are exposed |
| `HOME=$(mktemp -d) node dist/index.js agent install --dry-run --json` | Pass | No writes; showed planned Codex/Hermes home installs and workspace `.mcp.json`, `.cursor`, `.opencode` destinations |

The release gates are strong. The product audit commands are useful but too broad for first-run trust because they include bundled examples and old work artifacts unless scoped. That contributes directly to the "bloatware" feeling: users get receipts, but not necessarily receipts for the thing they intended to inspect.

## Studio Runtime Probe

Temp workspace: `/tmp/memi-audit-runtime.VLXVej`.

Runtime command:

```sh
PATH=/tmp/memi-audit-runtime.VLXVej/bin:$PATH node dist/index.js studio serve --port 18765 --json
```

Fake binaries were used for Codex and Claude. They emitted deterministic JSON/events and did not call providers.

| Scenario | Result | Evidence |
| --- | --- | --- |
| `/api/status` | Pass | HTTP 200, runtime `running`, project root `/private/tmp/memi-audit-runtime.VLXVej`, default harness `codex` |
| `/api/harnesses` | Pass | `claude-code` and `codex` installed via temp fake binaries and reported signed in |
| Codex session create | Pass | HTTP 201, session completed, 5 normalized events |
| Claude session create | Pass | HTTP 201, session completed, 5 normalized events |
| RPC replay | Pass | Replay emitted event frames and end frame |
| Event normalization | Pass | Codex events included `chat_message`, `session_started`, `reference_trace`, `session_result`, `session_done` |
| Workspace boundary | Pass | Request with `/tmp` outside configured workspace returned HTTP 403, `Workspace path is not allowed: /tmp` |
| Cancellation | Pass | Long-running fake Codex session cancelled with HTTP 200 and final status `cancelled` |
| Agent-kit dry-run through runtime | Pass | HTTP 200 planned Codex plugin target, no suite write |

Runtime E2E is the strongest part of the audit. Fake-provider coverage proves the harness plumbing, streaming/events, RPC replay, artifact/log surfaces, cancellation, and workspace boundary behavior. It does not prove live provider quality or first-pass design output.

## Codex Harness Audit

Local Codex:

- `codex --version`: `codex-cli 0.128.0`.
- `codex exec --help` supports the expected shape: `exec`, `--json`, `--search`, `--sandbox read-only|workspace-write|danger-full-access`, `--cd`, `--skip-git-repo-check`, `--model`, `--config`, `--output-schema`.
- `codex login status` currently fails before auth status because local config is invalid:

```text
Error loading configuration: /Users/sarveshchidambaram/.codex/config.toml:38:16: unknown variant `default`, expected `fast` or `flex`
```

The failing local value is:

```toml
service_tier = "default"
```

Studio command construction:

- Manifest templates start from `exec --json --model gpt-5.5 --sandbox workspace-write --skip-git-repo-check`.
- `src/studio/harnesses.ts` strips stale managed args and rebuilds Codex args with:
  - `--search` for research/audit/build actions when web search is enabled.
  - `--model <model>`.
  - `-c model_reasoning_effort="<effort>"`.
  - `-c approval_policy="<approvalPolicy>"`.
  - `--cd <cwd>`.
  - `--skip-git-repo-check`.
  - `--sandbox read-only` for plan mode, `--sandbox workspace-write` for guarded mode.
  - `--dangerously-bypass-approvals-and-sandbox` for `full_access`.

Compatibility result: **the generated arg shape matches the current CLI help**. The live Codex E2E remains externally blocked until the local `service_tier` config is changed to a valid current value such as `fast` or `flex`. This audit does not mark live Codex as passed.

Risk: default config and app copy lean too hard into maximum autonomy. `src/studio/config.ts` enables all tools by default (`shell`, `browser`, `figma`, `mcp`) and sets `workspaceWrite`, `shell`, `computer`, and `figma` permissions to `allow`. Codex defaults to `approvalPolicy: "never"`. That is efficient for a trusted local workbench, but too aggressive for first-run trust.

## macOS App Distribution Audit

Public app source:

- `memi-studio@1.0.4`, HEAD `e477ba6 feat(studio): modernized design-system token scale + button variants (Phase 5 foundation) (#9)`.
- README positions it as a "Native macOS workbench for Codex-first repository runs, Claude Code handoff, live traces, project context, and artifact review."
- README says default product surface is a single workbench: workspace picker, Codex/Claude readiness, composer, run trace, artifacts, context, settings.
- README says Scenario Lab, Mermaid Board, Figma driver, Automations, Marketplace Notes, and secondary harnesses are advanced.

Release metadata:

- Latest release: `https://github.com/sarveshsea/memi-studio/releases/tag/v1.0.4`.
- Assets include `latest.json`, app tarballs, signatures, DMGs for arm64/x64, and `SHA256SUMS`.
- Updater endpoint in Tauri config: `https://github.com/sarveshsea/memi-studio/releases/latest/download/latest.json`.

Positive:

- Release assets include signatures and checksums.
- App updater manifest is present and versioned.
- Runtime pin is explicit.
- CSP restricts script execution to self and connect-src to IPC plus local runtime.

Concerns:

- No app launch, Gatekeeper, notarization, or `spctl` check was performed under the no-install constraint.
- Tauri entitlements are broad: Apple Events automation, JIT, unsigned executable memory, disabled library validation, and read-write access to user-selected files plus Desktop, Documents, Downloads, removable volumes, and network volumes.
- App runtime pin `0.18.4` lags current CLI `1.1.1`; users can easily confuse Studio app capability with current engine capability.
- The app source has the right stated hierarchy, but the implementation still exposes many concepts: right pane tabs for Inspector, Packet, Changes, System, IA, Research, Board, Changelog, Figma, Memory; slash commands for `simulate`, `codex`, `claude`, `ollama`, `opencode`, `figma`, `board`, `memory`; marketplace/automation/board/Figma CSS and command surfaces.

Distribution verdict: acceptable for a power-user beta, not polished enough for a broad "replace Claude Design" launch without a tighter first-run and clearer entitlements story.

## Visual-Generator Parity Audit

Challenge prompt:

> Create a polished, editable product dashboard screen from a blank brief, with visual hierarchy, components, design-system tokens, and handoff artifacts.

Result: **not passed / not proven**.

Reason:

- The no-install audit could not launch the public macOS app or invoke a live Codex visual generation because live Codex is blocked by local config.
- Fake harness runs prove event flow, not visual quality.
- CLI `diagnose` and `ux audit` prove post-hoc analysis, not first visual generation.
- Source inspection shows a sophisticated workbench and artifact system, but no verified first-run flow that produces a polished inspectable dashboard preview from a blank brief with screenshot evidence.

Scoring against Claude Design-style expectations:

| Criterion | Score | Notes |
| --- | ---: | --- |
| First visual result | 2/10 | No actual visual artifact generated in this audit |
| Editability | 5/10 | Code/spec/artifact model exists, but no verified editable visual canvas path |
| Speed to inspectable preview | 4/10 | Runtime can stream quickly; preview path not proven for blank visual prompt |
| Visual quality | 4/10 | Cannot grade without generated screenshot; source has design-system machinery |
| Design-system grounding | 8/10 | Strongest visual-parity dimension: tokens, shadcn, Atomic Design, memi audits |
| Handoff artifacts | 7/10 | Sessions, logs, artifacts, MCP tools, and plugin skills are credible |
| Continue-the-design loop | 6/10 | Conversation/session continuity exists; visual edit loop not proven end-to-end |

Visual parity score: **45/100**.

If the product claim is "Codex-first design-system memory and repo workbench", the visual story is much stronger. If the claim is "replacement for Claude Design visual generation", it is blocked until the default flow can show a real generated screen, edit it, and preserve design-system memory across iterations.

## Bloatware Diagnosis

The app and CLI currently feel like several products sharing one entrypoint:

- Design memory and audits.
- Studio harness workbench.
- Figma bridge.
- MCP server.
- Codex plugin.
- Claude/Cursor/OpenCode/Gemini/Ollama/Hermes adapters.
- Marketplace Notes.
- Automations.
- Board/IA/research/video/simulate flows.
- Agent install manager.

Some of that is legitimate engine depth. The problem is first-run visibility and trust defaults.

Counts and signals:

- Primary harnesses: 2 (`codex`, `claude-code`).
- Advanced harnesses: 6 (`memoire`, `opencode`, `gemini`, `ollama`, `hermes`, `shell`).
- Studio actions in the manifest/status surface: 13 (`app-build`, `audit`, `browser-audit`, `compose`, `design-doc`, `fix`, `handoff`, `raw`, `references`, `research`, `self-design`, `simulate`, `video`).
- Default-enabled tools: 4/4 (`shell`, `browser`, `figma`, `mcp`).
- Default permission policy: workspace write, shell, computer, and Figma all `allow`.
- App navigation/tabs from source: Workbench plus Inspector, Packet, Changes, System, IA, Research, Board, Changelog, Figma, Memory, and related panels.
- Docs/install paths: npm, MCP registry, Codex plugin marketplace, app DMG/updater, agent dry-run installer, and adjacent `curl | bash` skill installer ecosystem.

The intended simple workbench should be:

1. Workbench
2. Artifacts
3. Memory
4. Settings

Codex should be primary. Claude should be alternate. Everything else should be behind Advanced.

## Ranked Prune Plan

1. **Make the default Studio first screen one thing: Codex Workbench.**
   Hide Board, IA, Research Lab, Figma, Video, Marketplace, Automations, Ollama, OpenCode, Gemini, Hermes, and Shell behind Advanced. Keep only composer, run trace, artifacts, memory, and settings.

2. **Replace "all tools enabled" with staged capability prompts.**
   First-run defaults should be browser off, Figma off, shell guarded, computer approval-required, MCP on only for local read tools. Let a user explicitly unlock write/shell/computer/Figma capability.

3. **Change Codex defaults for trust.**
   Keep Codex primary, but use guarded workspace writes by default. Avoid surfacing `approvalPolicy: "never"` as the default trust posture. Full-access should be a deliberate mode with a short explanation and visible current workspace root.

4. **Ship one canonical visual-generator workflow.**
   Button label: "Generate dashboard". It should run the fixed challenge, produce a preview/screenshot, spec, tokens, component map, and handoff artifact. This is the parity proof.

5. **Rename product surfaces around user outcomes, not engine internals.**
   `simulate`, `self-design`, `references`, `video`, `IA`, `Packet`, and `Board` are advanced internal vocabulary. First-run labels should map to work: Build screen, Audit UI, Continue run, Review artifacts, Save memory.

6. **Split install docs by trust level.**
   Top fold should show npm, MCP registry, Codex plugin marketplace, and macOS app. Move `curl | bash` style skill installation out of the primary path or add dry-run, checksums, manifest preview, and uninstall instructions.

7. **Scope audits by default.**
   `diagnose .` should avoid generated app resources, vendored runtime examples, `.superpowers`, and prior artifacts unless explicitly requested. The current broad scan makes good tooling feel noisy.

8. **Add an app/runtime compatibility table.**
   Example: Studio app `1.0.4` -> runtime `0.18.4` -> compatible CLI feature set. This prevents users from expecting `1.1.1` harness behavior in the released app.

9. **Make logs privacy-aware.**
   Persisted session logs are useful, but app UI should label that prompts, cwd values, model/effort, and artifacts may be sensitive. Add redaction/export controls.

10. **Move secondary harness setup out of top-level readiness.**
    Codex and Claude readiness are enough. Other harnesses should not compete for setup attention unless a user enables Advanced.

## Install And Trust Audit

Package/install positives:

- `npm view @memi-design/cli` reports latest `1.1.1`.
- No npm `install`, `preinstall`, or `postinstall` lifecycle scripts are published. `prepublishOnly` exists for publisher release gates.
- Agent install has dry-run JSON and showed exact destinations without writing.
- Codex plugin manifest includes privacy and terms links.
- MCP registry manifest pins package version and stdio arguments.

Remote installer concern:

- `https://interfacecraft.dev/api/install-skills` redirects to `https://www.interfacecraft.dev/api/install-skills`.
- The script writes canonical files under `$HOME/.agents/skills/interface-craft`.
- It base64-decodes skill/reference files.
- It detects Claude, Cursor, OpenCode, Gemini, Codex, and Windsurf paths.
- It removes existing target symlinks or directories and replaces them with symlinks to the canonical skill dir.
- It appends Windsurf global rules if absent.

No malicious behavior was established from inspection, but the trust model is too broad for a first-run install path: remote shell execution, no dry-run, no manifest preview, no checksum verification, and destructive replacement of existing agent skill directories. This should not be adjacent to the recommended memi install path unless it gets a safer installer UX.

## Security And Privacy

| Area | Status | Notes |
| --- | --- | --- |
| Workspace confinement | Pass in runtime probe | Out-of-root request returned HTTP 403 |
| Env handling | Partial | Harness env policies exist, but deeper redaction review was not completed |
| Raw Figma JS | Not executed | Plugin/app Figma bridge was inspected at a high level only |
| App entitlements | Risk | Broad macOS entitlements need first-run explanation and least-privilege review |
| Remote installers | Risk | `curl | bash` skill installer replaces home agent dirs without dry-run/checksums |
| Logs | Risk | `studio logs --json` exposes prompts and cwd values; app should make retention/export/redaction obvious |
| Plugin privacy/terms | Present | Codex plugin manifest includes privacy and terms URLs |
| Live provider auth | Blocked for Codex | Local Codex config prevents auth status from resolving |

## Blockers

1. **Visual-generator parity is unproven.** There is no audited first-pass flow from blank brief to polished editable visual output with screenshot/preview evidence.
2. **Live Codex E2E is blocked by local config.** `service_tier = "default"` is invalid for current local Codex CLI, which expects `fast` or `flex`.
3. **First-run trust defaults are too permissive.** Shell/browser/Figma/MCP are all enabled, and workspace write/shell/computer/Figma permissions default to allow.
4. **The app release lags the CLI/runtime work.** Public app `1.0.4` pins runtime `0.18.4` while this repo is `1.1.1`.
5. **Install story is fragmented.** npm, MCP, Codex plugin, app updater, agent install, and adjacent remote shell installers all coexist without one simple trust ladder.

## What Would Move This To Ship

Minimum fixes:

1. Add a canonical visual E2E that runs the dashboard challenge against a real harness and saves screenshot, preview URL, generated spec/code, and continuation proof.
2. Fix/surface Codex config failures with a targeted message for invalid `service_tier`; never call this "not logged in" when config parsing failed first.
3. Switch first-run defaults to a lean Codex/Claude workbench with Advanced collapsed.
4. Turn default tool permissions into staged grants.
5. Publish an app/runtime compatibility matrix and update app runtime or explicitly mark older runtime limitations.
6. Replace top-fold `curl | bash` style instructions with dry-run/checksum/rollback install flows.
7. Scope audit commands away from generated resources and old work artifacts by default.

After those, the product can credibly claim:

> A Codex-first macOS design-agent workbench with durable design-system memory and auditable handoff artifacts.

It should not claim:

> Claude Design replacement.

until the visual-generation challenge is green in the released app.

## Residual Gaps

Not performed under this audit:

- Installed macOS app launch.
- Gatekeeper/notarization validation with `spctl`.
- Real live Codex generation.
- Real Claude Design comparator run.
- Figma plugin canvas write/read/self-heal loop.
- Browser screenshot of generated dashboard artifact.
- Full env redaction and log-retention source review.

These gaps cap the score. Passing fake harness and release gates is not the same as proving the shipped app feels lean and visually useful.
