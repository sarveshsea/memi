# memi 95/100 Remediation Progress - 2026-06-30

This note tracks concrete movement from the `63/100` audit toward the active `95/100+` goal. It is not a completion claim.

## Completed In This Slice

1. **Safer first-run Studio defaults**
   - Codex remains the default harness.
   - Shell, browser, and Figma tools now default off; MCP remains on.
   - Workspace write, computer, and Figma permissions now default to approval; shell defaults to block.
   - Computer integration now defaults disabled and approval-gated.
   - Codex defaults now use `approvalPolicy: "on-request"`, `webSearch: false`, and `planModeDefault: true`.

2. **Legacy config hardening**
   - Added `setup.securityDefaultsVersion`.
   - Legacy Studio config files without this marker have old Codex `approvalPolicy: "never"` and `webSearch: true` hardened on load.
   - Versioned configs can still preserve explicit user settings after the migration.

3. **Codex config-error readiness**
   - Codex CLI config parse failures now surface as `authStatus: "config_error"` instead of a login failure.
   - Compatibility snapshots mark config errors as blocked CLI setup with no login command.
   - Built CLI now reports the local blocker directly: invalid `service_tier = "default"` in `/Users/sarveshchidambaram/.codex/config.toml`.

4. **Visual parity benchmark contract**
   - Added a canonical `VISUAL_PARITY_CHALLENGE` prompt and Codex-first run request helper.
   - Added a grader that only passes at `95+` with screenshot, preview URL, editable spec, editable code, token evidence, handoff artifact, continuation proof, and visual quality score.
   - Added `memi studio visual-parity --out <dir> --json` to generate a no-install deterministic proof artifact set and grade it.
   - Generated proof artifacts at `docs/audits/artifacts/visual-parity-2026-06-30/`:
     `dashboard-preview.html`, `dashboard-screenshot.svg`, `dashboard.page-spec.json`, `DashboardPage.tsx`, `dashboard.tokens.css`, `dashboard-handoff.md`, and `dashboard-continuation.md`.
   - The generated proof grades `100/100`, but reports `liveHarness: false`; this is benchmark and artifact proof, not proof that live Codex passes visual-generator parity yet.

5. **Noise-free default app-quality scans**
   - Default root scans now skip generated and packaged surfaces unless explicitly targeted:
     `.astro`, `.superpowers`, `agent-kits`, `dist`, `dist-runtime-resources`, `docs/audits/artifacts`, `examples`, `generated`, `notes`, `plugin`, `plugins`, `target`, and existing build/cache dirs.
   - Regression coverage includes generated bundles, runtime resources, extension packs, plugin assets, audit proof artifacts, and scratch artifacts.
   - App-quality scoring now aggregates rendered UI surfaces instead of prompt/test/config fixture strings when UI files are present.
   - Stylesheet `:focus-visible` rules now count as focus-state evidence.
   - Built CLI root scan confirms generated audit artifacts are excluded and default `diagnose` now scores `96/100`; remaining findings are preview raw-color debt and responsive coverage.

6. **Live Codex blocker classification**
   - `codex login status` is still blocked by invalid local config: `service_tier = "default"` is not accepted; Codex expects `fast` or `flex`.
   - A read-only `codex exec --ignore-user-config --ephemeral --json --sandbox read-only --cd <tmp> --skip-git-repo-check ...` smoke bypassed that config parse failure but stopped on the account usage limit.
   - Live Codex E2E remains externally blocked by account usage, while Studio now surfaces the config parse failure as `config_error`.

## Verification

- `npx vitest run src/studio/__tests__/config.test.ts src/studio/__tests__/harnesses.test.ts src/studio/__tests__/compatibility.test.ts`
- `npx vitest run src/app-quality/__tests__/engine.test.ts`
- `npm run lint`
- `npm run build`
- `npm test` - 205 files, 1570 tests passed
- `npm run check:release`
- `npm run smoke:mcp`
- `npm run smoke:codex-plugin`
- `git diff --check`
- `node dist/index.js studio status --json` confirms safe loaded defaults and `config_error` Codex readiness.
- `node dist/index.js diagnose . --json --no-write --max-files 700` confirms filtered generated/packaged/audit-artifact surfaces are absent from default scans; current score is `96/100`.
- `node dist/index.js studio visual-parity --out docs/audits/artifacts/visual-parity-2026-06-30 --json` produced all required visual parity artifacts and graded the deterministic proof at `100/100`.

## Still Required For 95/100

1. **Real visual-generator E2E**
   - Run the canonical dashboard challenge through a live harness.
   - Save or verify live-created screenshot, preview URL, editable spec/code, tokens, handoff, continuation proof.
   - Compare live harness artifacts against the deterministic proof contract.
   - Grade with the new visual parity contract.

2. **Live Codex smoke**
   - Fix the local Codex config blocker for `login status`, or add an in-app repair path that identifies the invalid `service_tier`.
   - Re-run a read-only live Codex smoke in a temp workspace after the account usage limit resets or more credits are available.

3. **macOS app release alignment**
   - Apply or port these runtime defaults into `memi-studio`.
   - Verify app launch, updater, signing/notarization evidence, runtime pin, and compatibility matrix.

4. **Install trust path**
   - Replace top-fold remote shell installer guidance with dry-run, checksum, manifest preview, uninstall, and rollback paths.

5. **Privacy and entitlements**
   - Add privacy-aware log controls and retention/export/redaction UX.
   - Review broad Tauri entitlements and make first-run capability prompts explain each one.

The active goal remains open until those remaining items are implemented and verified.
