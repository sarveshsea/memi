# Mémoire Studio macOS Release

Use this flow for direct DMG distribution from `memoire.cv`. The production app bundles the Mémoire runtime as a Tauri sidecar, stores the selected workspace in the macOS app config directory for `cv.memoire.studio`, and talks to the runtime at `http://127.0.0.1:8765`.

## Apple Setup

You need a paid Apple Developer Program account and a local `Developer ID Application` certificate.

1. Create or download the `Developer ID Application` certificate from Apple Developer.
2. Install the certificate in Keychain Access.
3. Confirm macOS can see it:

```bash
security find-identity -v -p codesigning
```

Set notarization credentials before running the production release gate:

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAMID"
```

`APPLE_PASSWORD` should be an Apple app-specific password, not the account password.

## Local Release Gate

```bash
npm run studio:release:macos
```

The script:

- builds the `memi-studio-runtime` sidecar with `bun build --compile`
- stages runtime assets under `apps/studio/src-tauri/resources/memoire-runtime`
- runs the Tauri production build
- preserves Scenario Lab simulation tools, research-backed vibe design tools, Mermaid Jam source export, and the release-gated MiroFish clean-room boundary in the packaged runtime
- verifies the DMG with `hdiutil verify`
- writes a `.sha256` checksum next to the DMG
- verifies the app signature with `codesign --verify --deep --strict`
- validates notarization staples for the app and DMG
- checks Gatekeeper assessment with `spctl -a -vv --type execute`

For a local packaging smoke test without notarization, use:

```bash
npm run studio:release:macos -- --skip-notarize
```

That still requires a valid Developer ID signing identity. It is not a public release gate.

## CI Publication

GitHub Releases skip Studio DMG publication unless all CI signing secrets are configured:

- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `KEYCHAIN_PASSWORD`
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`

CLI archives can still publish without those secrets. Studio DMGs are treated as production artifacts and are only uploaded after signing and notarization checks pass.

## References

- [Tauri macOS signing](https://v2.tauri.app/distribute/sign/macos/)
- [Tauri distribution](https://v2.tauri.app/distribute/)
- [Tauri CSP](https://v2.tauri.app/security/csp/)
- [Tauri sidecars](https://v2.tauri.app/learn/sidecar-nodejs/)
- [Apple notarization](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
