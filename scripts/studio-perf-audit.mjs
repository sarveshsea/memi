#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TAURI_ROOT = join(ROOT, "apps", "studio", "src-tauri");
const RUNTIME_ROOT = join(TAURI_ROOT, "resources", "memoire-runtime");
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((arg) => arg.startsWith("--"))
    .map((arg) => {
      const [key, value = "true"] = arg.replace(/^--/, "").split("=");
      return [key, value];
    }),
);

const port = Number.parseInt(args.port ?? "8766", 10);
const target = args.target || process.env.MEMOIRE_STUDIO_TARGET || hostTargetKey();
if (!Number.isInteger(port) || port < 1024 || port > 65535) fail(`Invalid --port: ${args.port}`);
if (!target) fail("Unable to resolve Studio runtime target; pass --target=darwin-arm64 or --target=darwin-x64.");

const timings = [];

await timed("frontend build", "npm", ["--prefix", "apps/studio", "run", "build"], { cwd: ROOT });
await timed("runtime build", process.execPath, ["scripts/build-studio-runtime.mjs", `--target=${target}`], { cwd: ROOT });
await timed("rust release freshness", "cargo", ["build", "--release"], { cwd: TAURI_ROOT });

const sizes = await collectSizes(target);
console.log("\n▸ Bundle sizes");
for (const [label, bytes] of Object.entries(sizes)) {
  console.log(`  ${label}: ${formatBytes(bytes)}`);
}

const endpointResults = await auditRuntimeEndpoints(target, port);
console.log("\n▸ Endpoint timings");
for (const result of endpointResults) {
  console.log(`  ${result.label}: ${result.ms.toFixed(1)}ms / ${formatBytes(result.bytes)} / HTTP ${result.status}`);
}

const compactKnowledge = endpointResults.find((result) => result.label === "GET /api/knowledge?detail=compact");
const warmHarnesses = endpointResults.find((result) => result.label === "GET /api/harnesses warm");
const warmCompatibility = endpointResults.find((result) => result.label === "GET /api/compatibility warm");
const failures = [
  compactKnowledge && compactKnowledge.bytes > 250_000 ? `compact knowledge payload is ${formatBytes(compactKnowledge.bytes)}, expected <= 250 KB` : null,
  warmHarnesses && warmHarnesses.ms > 75 ? `warm harness endpoint is ${warmHarnesses.ms.toFixed(1)}ms, expected <= 75ms` : null,
  warmCompatibility && warmCompatibility.ms > 75 ? `warm compatibility endpoint is ${warmCompatibility.ms.toFixed(1)}ms, expected <= 75ms` : null,
].filter(Boolean);

console.log("\n▸ Build timings");
for (const timing of timings) {
  console.log(`  ${timing.label}: ${timing.ms.toFixed(1)}ms`);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`✗ ${failure}`);
  process.exit(1);
}

console.log("\n✓ Studio perf audit passed");

async function timed(label, command, commandArgs, options) {
  const startedAt = performance.now();
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    stdio: "inherit",
  });
  const ms = performance.now() - startedAt;
  timings.push({ label, ms });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function collectSizes(targetKey) {
  const targetInfo = targetInfoFor(targetKey);
  return {
    "renderer dist": await pathSize(join(ROOT, "apps", "studio", "dist")),
    "runtime binary": await pathSize(join(TAURI_ROOT, "binaries", `memi-studio-runtime-${targetInfo.triple}`)),
    "runtime resources": await pathSize(RUNTIME_ROOT),
    "release app bundle": await pathSize(join(TAURI_ROOT, "target", "release", "bundle", "macos", "Mémoire Studio.app")),
    "release dmg dir": await pathSize(join(TAURI_ROOT, "target", "release", "bundle", "dmg")),
  };
}

async function auditRuntimeEndpoints(targetKey, runtimePort) {
  const targetInfo = targetInfoFor(targetKey);
  const runtimeBin = join(ROOT, "dist-bin", `studio-runtime-${targetKey}`, `memi-studio-runtime${targetInfo.ext}`);
  if (!existsSync(runtimeBin)) fail(`Missing compiled runtime: ${runtimeBin}`);
  const workspace = join(tmpdir(), `memoire-studio-perf-${process.pid}`);
  await rm(workspace, { recursive: true, force: true });
  await mkdir(workspace, { recursive: true });
  const child = spawn(runtimeBin, ["studio", "serve", "--port", String(runtimePort), "--json"], {
    cwd: workspace,
    env: {
      ...process.env,
      MEMOIRE_PACKAGE_ROOT: RUNTIME_ROOT,
      MEMOIRE_STUDIO_MANAGED_BY: "tauri",
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  try {
    await waitForRuntime(runtimePort, child);
    const fixtureCatalogUrl = await createFixtureNotesCatalog(workspace);
    return [
      await fetchTimed("GET /api/status", runtimePort, "/api/status"),
      await fetchTimed("GET /api/harnesses cold", runtimePort, "/api/harnesses?refresh=1"),
      await fetchTimed("GET /api/harnesses warm", runtimePort, "/api/harnesses"),
      await fetchTimed("GET /api/compatibility cold", runtimePort, "/api/compatibility?refresh=1"),
      await fetchTimed("GET /api/compatibility warm", runtimePort, "/api/compatibility"),
      await fetchTimed("GET /api/knowledge?detail=compact", runtimePort, "/api/knowledge?detail=compact"),
      await fetchTimed("GET /api/marketplace/notes cold", runtimePort, `/api/marketplace/notes?refresh=1&catalogUrl=${encodeURIComponent(fixtureCatalogUrl)}`),
      await fetchTimed("GET /api/marketplace/notes warm", runtimePort, "/api/marketplace/notes"),
      await fetchTimed("POST /api/marketplace/notes/install fixture", runtimePort, "/api/marketplace/notes/install", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ noteId: "perf-video-note", catalogUrl: fixtureCatalogUrl }),
      }),
      await fetchTimed("GET /api/video/status", runtimePort, "/api/video/status"),
    ];
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolveStop) => {
      const timeout = setTimeout(resolveStop, 1000);
      child.once("exit", () => {
        clearTimeout(timeout);
        resolveStop();
      });
    });
    await rm(workspace, { recursive: true, force: true });
    if (child.exitCode && child.exitCode !== 0 && stderr.trim()) console.error(stderr.trim());
  }
}

async function waitForRuntime(runtimePort, child) {
  const deadline = Date.now() + 6_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break;
    try {
      const response = await fetch(`http://127.0.0.1:${runtimePort}/api/status`);
      if (response.ok) {
        await response.arrayBuffer();
        return;
      }
    } catch {
      await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    }
  }
  fail(`Studio runtime did not become ready on 127.0.0.1:${runtimePort}.`);
}

async function fetchTimed(label, runtimePort, path, init) {
  const startedAt = performance.now();
  const response = await fetch(`http://127.0.0.1:${runtimePort}${path}`, init);
  const text = await response.text();
  return {
    label,
    status: response.status,
    ms: performance.now() - startedAt,
    bytes: Buffer.byteLength(text),
  };
}

async function createFixtureNotesCatalog(workspace) {
  const sourceRoot = join(workspace, "fixture-notes-source");
  const noteRoot = join(sourceRoot, "perf-video-note");
  await mkdir(noteRoot, { recursive: true });
  await writeFile(join(noteRoot, "note.json"), `${JSON.stringify({
    name: "perf-video-note",
    version: "0.1.0",
    description: "Perf audit fixture note.",
    category: "generate",
    tags: ["perf", "video"],
    sourceUrls: ["https://www.memoire.cv/notes/catalog.v1.json"],
    lastResearchedAt: new Date().toISOString(),
    freshnessDays: 60,
    skills: [{
      file: "perf-video-note.md",
      name: "Perf Video Note",
      activateOn: "motion-video",
      freedomLevel: "reference",
    }],
    dependencies: [],
  }, null, 2)}\n`);
  await writeFile(join(noteRoot, "perf-video-note.md"), "# Perf Video Note\n\nFixture for Studio perf audit.\n");
  const archivePath = join(workspace, "perf-video-note-0.1.0.tgz");
  const tarResult = spawnSync("tar", ["-czf", archivePath, "-C", sourceRoot, "perf-video-note"], {
    cwd: workspace,
    encoding: "utf-8",
  });
  if (tarResult.status !== 0) fail(tarResult.stderr || "Failed to create perf note archive");
  const archiveBytes = await readFile(archivePath);
  const catalogPath = join(workspace, "notes-catalog.v1.json");
  await writeFile(catalogPath, `${JSON.stringify({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    baseUrl: `file://${workspace}`,
    notes: [{
      id: "perf-video-note",
      name: "perf-video-note",
      title: "Perf Video Note",
      version: "0.1.0",
      description: "Perf audit fixture note.",
      category: "generate",
      tags: ["perf", "video"],
      sourceUrls: ["https://www.memoire.cv/notes/catalog.v1.json"],
      lastResearchedAt: new Date().toISOString(),
      freshnessDays: 60,
      archive: {
        url: `file://${archivePath}`,
        sha256: createHash("sha256").update(archiveBytes).digest("hex"),
        size: archiveBytes.byteLength,
      },
    }],
  }, null, 2)}\n`);
  return `file://${catalogPath}`;
}

async function pathSize(path) {
  try {
    const info = await stat(path);
    if (info.isFile()) return info.size;
    if (!info.isDirectory()) return 0;
  } catch {
    return 0;
  }
  let total = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    total += await pathSize(join(path, entry.name));
  }
  return total;
}

function targetInfoFor(targetKey) {
  if (targetKey === "darwin-arm64") return { triple: "aarch64-apple-darwin", ext: "" };
  if (targetKey === "darwin-x64") return { triple: "x86_64-apple-darwin", ext: "" };
  fail(`Unsupported target: ${targetKey}`);
}

function hostTargetKey() {
  const result = spawnSync("rustc", ["-Vv"], { cwd: ROOT, encoding: "utf-8" });
  const host = result.stdout.match(/^host:\s+(.+)$/m)?.[1]?.trim();
  if (host === "aarch64-apple-darwin") return "darwin-arm64";
  if (host === "x86_64-apple-darwin") return "darwin-x64";
  return "";
}

function formatBytes(bytes) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
