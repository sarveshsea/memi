#!/usr/bin/env node

import { spawn } from "node:child_process";
import { access, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = process.env.MEMOIRE_BENCH_CLI || join(root, "dist", "index.js");
const iterations = Number.parseInt(process.env.MEMOIRE_BENCH_RUNS || "3", 10);
const warmups = Number.parseInt(process.env.MEMOIRE_BENCH_WARMUPS || "1", 10);
const shouldFail = process.env.MEMOIRE_BENCH_NO_FAIL !== "1";

const cases = [
  // Thresholds tightened in 2.1 after lazy command loading — hot commands
  // load one module instead of ~48. Keep headroom for slower CI machines.
  {
    name: "help",
    args: ["--help"],
    thresholdMs: 150,
  },
  {
    name: "diagnose-no-write",
    args: ["diagnose", "--no-write"],
    thresholdMs: 700,
  },
  {
    name: "tokens-from-src-no-inferred",
    args: ["tokens", "--from", "src", "--no-inferred", "--json"],
    thresholdMs: 1200,
  },
  {
    name: "status-json",
    args: ["status", "--json"],
    thresholdMs: 600,
  },
];

await assertCliExists(cliPath);

const results = [];
for (const benchCase of cases) {
  for (let index = 0; index < warmups; index += 1) {
    await runCli(benchCase.args);
  }

  const samples = [];
  for (let index = 0; index < iterations; index += 1) {
    samples.push(await runCli(benchCase.args));
  }
  const medianMs = median(samples.map((sample) => sample.durationMs));
  const maxMs = Math.max(...samples.map((sample) => sample.durationMs));
  const failed = medianMs > benchCase.thresholdMs;
  results.push({
    name: benchCase.name,
    command: `memi ${benchCase.args.join(" ")}`,
    thresholdMs: benchCase.thresholdMs,
    medianMs: Math.round(medianMs),
    maxMs: Math.round(maxMs),
    stdoutBytes: Math.round(median(samples.map((sample) => sample.stdoutBytes))),
    stderrBytes: Math.round(median(samples.map((sample) => sample.stderrBytes))),
    failed,
  });
}

await rm(join(root, ".memoire", "bench-tokens"), { recursive: true, force: true }).catch(() => {});

for (const result of results) {
  const status = result.failed ? "FAIL" : "PASS";
  console.log(`${status} ${result.name.padEnd(28)} median=${result.medianMs}ms max=${result.maxMs}ms threshold=${result.thresholdMs}ms`);
}

console.log(JSON.stringify({ cliPath, iterations, warmups, results }, null, 2));

if (shouldFail && results.some((result) => result.failed)) {
  process.exitCode = 1;
}

async function assertCliExists(path) {
  try {
    await access(path);
  } catch {
    throw new Error(`Benchmark CLI not found at ${path}. Run npm run build first or set MEMOIRE_BENCH_CLI.`);
  }
}

async function runCli(args) {
  const started = performance.now();
  const child = spawn(process.execPath, [cliPath, ...args], {
    cwd: root,
    env: {
      ...process.env,
      CI: "1",
      NO_COLOR: "1",
      MEMOIRE_SILENCE_DEPRECATIONS: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const code = await new Promise((resolve) => {
    child.on("close", resolve);
  });
  const durationMs = performance.now() - started;

  if (code !== 0) {
    throw new Error(`memi ${args.join(" ")} exited ${code}\n${stderr || stdout}`);
  }

  return { durationMs, stdoutBytes: stdout.length, stderrBytes: stderr.length };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}
