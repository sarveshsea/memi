#!/usr/bin/env node
/**
 * Build the Mémoire CLI as the Tauri Studio runtime sidecar and stage the
 * package assets the compiled binary needs when Finder launches the app.
 *
 * Usage:
 *   node scripts/build-studio-runtime.mjs --target=darwin-arm64
 *   node scripts/build-studio-runtime.mjs --target=darwin-x64
 */

import { spawnSync } from "node:child_process";
import { access, chmod, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TAURI_ROOT = join(ROOT, "apps", "studio", "src-tauri");
const BINARIES_DIR = join(TAURI_ROOT, "binaries");
const RUNTIME_RESOURCE_DIR = join(TAURI_ROOT, "resources", "memoire-runtime");

const TARGETS = {
  "darwin-arm64": {
    bunTarget: "bun-darwin-arm64",
    triple: "aarch64-apple-darwin",
    ext: "",
  },
  "darwin-x64": {
    bunTarget: "bun-darwin-x64",
    triple: "x86_64-apple-darwin",
    ext: "",
  },
};

const TRIPLE_TO_TARGET = Object.fromEntries(
  Object.entries(TARGETS).map(([key, value]) => [value.triple, key]),
);

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((arg) => arg.startsWith("--"))
    .map((arg) => {
      const [key, value = "true"] = arg.replace(/^--/, "").split("=");
      return [key, value];
    }),
);

const targetKey = args.target || process.env.MEMOIRE_STUDIO_TARGET || hostTargetKey();
if (!targetKey || !TARGETS[targetKey]) {
  console.error(`Usage: build-studio-runtime.mjs --target=<${Object.keys(TARGETS).join("|")}>`);
  process.exit(1);
}

const target = TARGETS[targetKey];
const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf-8"));
const stageDir = join(ROOT, "dist-bin", `studio-runtime-${targetKey}`);
const runtimeName = `memi-studio-runtime${target.ext}`;
const compiledRuntime = join(stageDir, runtimeName);
const tauriRuntimeName = `memi-studio-runtime-${target.triple}${target.ext}`;
const tauriRuntime = join(BINARIES_DIR, tauriRuntimeName);

console.log(`▸ Building Studio runtime ${pkg.version} for ${targetKey}`);

await rm(stageDir, { recursive: true, force: true });
await mkdir(stageDir, { recursive: true });
await mkdir(BINARIES_DIR, { recursive: true });

const bun = spawnSync("bun", [
  "build",
  "--compile",
  `--target=${target.bunTarget}`,
  "--minify",
  `--outfile=${compiledRuntime}`,
  "src/index.ts",
], {
  cwd: ROOT,
  stdio: "inherit",
});

if (bun.status !== 0) {
  console.error("bun build --compile failed for the Studio runtime sidecar");
  process.exit(bun.status ?? 1);
}

await cp(compiledRuntime, tauriRuntime);
await chmod(tauriRuntime, 0o755);
console.log(`  + apps/studio/src-tauri/binaries/${tauriRuntimeName}`);

await rm(RUNTIME_RESOURCE_DIR, { recursive: true, force: true });
await mkdir(RUNTIME_RESOURCE_DIR, { recursive: true });

const sidecars = [
  ["skills", "skills"],
  ["notes", "notes"],
  ["agent-kits", "agent-kits"],
  ["plugin", "plugin"],
  ["src/studio/harness-manifest.json", "studio/harness-manifest.json"],
  ["src/preview/templates", "preview/templates"],
  ["assets", "assets"],
  ["examples", "examples"],
  ["package.json", "package.json"],
  ["README.md", "README.md"],
  ["LICENSE", "LICENSE"],
  ["CHANGELOG.md", "CHANGELOG.md"],
];

for (const [sourceRel, destRel] of sidecars) {
  const src = join(ROOT, sourceRel);
  if (!(await exists(src))) {
    console.warn(`  (skip) ${sourceRel} - not present`);
    continue;
  }
  const dst = join(RUNTIME_RESOURCE_DIR, destRel);
  await mkdir(dirname(dst), { recursive: true });
  await cp(src, dst, { recursive: true });
  console.log(`  + resources/memoire-runtime/${destRel}`);
}

await writeFile(
  join(RUNTIME_RESOURCE_DIR, "studio-runtime-info.json"),
  JSON.stringify({
    name: "@sarveshsea/memoire Studio runtime",
    packageVersion: pkg.version,
    target: targetKey,
    targetTriple: target.triple,
    builtAt: new Date().toISOString(),
    binary: "memi-studio-runtime",
  }, null, 2) + "\n",
);

console.log("✓ Studio runtime staged for Tauri");

function hostTargetKey() {
  const tuple = spawnSync("rustc", ["--print", "host-tuple"], {
    cwd: ROOT,
    encoding: "utf-8",
  });
  const host = tuple.status === 0 ? tuple.stdout.trim() : rustcHostFromVersion();
  return TRIPLE_TO_TARGET[host] || "";
}

function rustcHostFromVersion() {
  const version = spawnSync("rustc", ["-Vv"], {
    cwd: ROOT,
    encoding: "utf-8",
  });
  if (version.status !== 0) return "";
  return version.stdout.match(/^host:\s+(.+)$/m)?.[1]?.trim() || "";
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
