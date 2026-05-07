#!/usr/bin/env node
/**
 * Local-first macOS production release gate for Mémoire Studio.
 *
 * Requires a Developer ID Application certificate installed in Keychain and
 * Apple notarization credentials in the environment.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TAURI_ROOT = join(ROOT, "apps", "studio", "src-tauri");
const BUNDLE_ROOT = join(TAURI_ROOT, "target", "release", "bundle");

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((arg) => arg.startsWith("--"))
    .map((arg) => {
      const [key, value = "true"] = arg.replace(/^--/, "").split("=");
      return [key, value];
    }),
);

const target = args.target || process.env.MEMOIRE_STUDIO_TARGET || hostTargetKey();
const skipNotarize = args.skipNotarize === "true" || args["skip-notarize"] === "true";

if (process.platform !== "darwin") {
  fail("Mémoire Studio macOS release must run on macOS.");
}

const developerIdIdentities = listDeveloperIdIdentities();
const signingIdentity = resolveSigningIdentity(process.env.APPLE_SIGNING_IDENTITY, developerIdIdentities);
if (!signingIdentity) {
  fail([
    "No Developer ID Application signing identity was found.",
    "Install your Apple Developer certificate, then confirm it appears in:",
    "  security find-identity -v -p codesigning",
  ].join("\n"));
}
if (!developerIdIdentities.some((identity) => identity.hash === signingIdentity || identity.name === signingIdentity)) {
  fail([
    `APPLE_SIGNING_IDENTITY does not match an installed Developer ID Application certificate: ${signingIdentity}`,
    "Installed Developer ID Application identities:",
    ...developerIdIdentities.map((identity) => `  - ${identity.hash} ${identity.name}`),
    developerIdIdentities.length === 0 ? "  - none found" : "",
  ].filter(Boolean).join("\n"));
}

if (!skipNotarize) {
  for (const name of ["APPLE_ID", "APPLE_PASSWORD", "APPLE_TEAM_ID"]) {
    if (!process.env[name]) {
      fail(`Missing ${name}. Use an Apple app-specific password for APPLE_PASSWORD, or pass --skip-notarize for a local unsigned smoke build.`);
    }
  }
}

const signingIdentityLabel = developerIdIdentities.find((identity) => identity.hash === signingIdentity || identity.name === signingIdentity)?.name ?? signingIdentity;
console.log(`▸ Using signing identity: ${signingIdentityLabel} (${signingIdentity})`);
console.log(`▸ Building Studio runtime for ${target}`);
run(process.execPath, ["scripts/build-studio-runtime.mjs", `--target=${target}`], { cwd: ROOT });

console.log("▸ Building signed Tauri app and DMG");
const tauriSigningConfig = JSON.stringify({
  build: { beforeBuildCommand: "npm run build" },
  bundle: { macOS: { signingIdentity } },
});
run("npm", ["--prefix", "apps/studio", "run", "tauri:build", "--", "--config", tauriSigningConfig], {
  cwd: ROOT,
  env: {
    ...process.env,
    APPLE_SIGNING_IDENTITY: signingIdentity,
  },
});

const appPath = await findAppBundle();
const dmgPath = await findDmg();
console.log(`▸ App: ${appPath}`);
console.log(`▸ DMG: ${dmgPath}`);

console.log("▸ Verifying DMG container");
run("hdiutil", ["verify", dmgPath], { cwd: ROOT });

const sha = createHash("sha256").update(await readFile(dmgPath)).digest("hex");
await writeFile(`${dmgPath}.sha256`, `${sha}  ${dmgPath.split("/").pop()}\n`);
console.log(`▸ sha256: ${sha}`);

console.log("▸ Verifying code signature");
run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath], { cwd: ROOT });

if (!skipNotarize) {
  console.log("▸ Validating notarization staples");
  run("xcrun", ["stapler", "validate", appPath], { cwd: ROOT });
  run("xcrun", ["stapler", "validate", dmgPath], { cwd: ROOT });

  console.log("▸ Assessing Gatekeeper policy");
  run("spctl", ["-a", "-vv", "--type", "execute", appPath], { cwd: ROOT });
} else {
  console.log("▸ Skipping notarization staple and Gatekeeper checks for local smoke build");
}

console.log("✓ Mémoire Studio macOS release gate passed");

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd || ROOT,
    env: options.env || process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function findDeveloperIdIdentity() {
  return listDeveloperIdIdentities()[0]?.hash || "";
}

function listDeveloperIdIdentities() {
  const result = spawnSync("security", ["find-identity", "-v", "-p", "codesigning"], {
    cwd: ROOT,
    encoding: "utf-8",
  });
  if (result.status !== 0) return [];
  return Array.from(
    result.stdout.matchAll(/^\s*\d+\)\s+([A-F0-9]{40})\s+"([^"]*Developer ID Application:[^"]+)"$/gm),
    (match) => ({ hash: match[1], name: match[2] }),
  );
}

function resolveSigningIdentity(requested, identities) {
  if (!requested) return identities[0]?.hash || "";
  if (/^[A-Fa-f0-9]{40}$/.test(requested)) return requested.toUpperCase();
  const matches = identities.filter((identity) => identity.name === requested);
  if (matches.length === 1) return matches[0].hash;
  if (matches.length > 1) {
    fail([
      `APPLE_SIGNING_IDENTITY is ambiguous because ${matches.length} certificates share this name: ${requested}`,
      "Use one of these SHA-1 identity hashes instead:",
      ...matches.map((identity) => `  - ${identity.hash} ${identity.name}`),
    ].join("\n"));
  }
  return requested || "";
}

async function findAppBundle() {
  const macosDir = join(BUNDLE_ROOT, "macos");
  const entries = await readdir(macosDir, { withFileTypes: true });
  const app = entries.find((entry) => entry.isDirectory() && entry.name.endsWith(".app"));
  if (!app) fail(`No .app bundle found in ${macosDir}`);
  return join(macosDir, app.name);
}

async function findDmg() {
  const dmgDir = join(BUNDLE_ROOT, "dmg");
  const entries = await readdir(dmgDir, { withFileTypes: true });
  const dmgs = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".dmg"))
    .map((entry) => join(dmgDir, entry.name));
  if (dmgs.length === 0) fail(`No DMG found in ${dmgDir}`);
  const withStats = await Promise.all(dmgs.map(async (path) => ({ path, mtimeMs: (await stat(path)).mtimeMs })));
  withStats.sort((left, right) => right.mtimeMs - left.mtimeMs || left.path.localeCompare(right.path));
  return withStats[0].path;
}

function hostTargetKey() {
  const version = spawnSync("rustc", ["-Vv"], {
    cwd: ROOT,
    encoding: "utf-8",
  });
  const host = version.stdout.match(/^host:\s+(.+)$/m)?.[1]?.trim();
  if (host === "aarch64-apple-darwin") return "darwin-arm64";
  if (host === "x86_64-apple-darwin") return "darwin-x64";
  return "";
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
