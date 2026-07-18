#!/usr/bin/env node
/**
 * Fill Homebrew formula placeholders with the current version + per-arch SHA256
 * hashes, printing the result to stdout (or writing to --out).
 *
 * Reads hashes from dist-bin/SHA256SUMS.txt (produced by build-binary.mjs).
 *
 * Usage:
 *   node scripts/homebrew/update-formula.mjs > memoire.rb
 *   node scripts/homebrew/update-formula.mjs --out memoire.rb
 *   node scripts/homebrew/update-formula.mjs --version 1.2.3 --out memoire.rb
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) continue;

    const option = argument.slice(2);
    const separator = option.indexOf("=");
    if (separator >= 0) {
      parsed[option.slice(0, separator)] = option.slice(separator + 1);
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[option] = next;
      index += 1;
    } else {
      parsed[option] = true;
    }
  }

  return parsed;
}

const args = parseArgs(process.argv.slice(2));

const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf-8"));
const sums = await readFile(join(ROOT, "dist-bin", "SHA256SUMS.txt"), "utf-8");
const version = args.version ?? pkg.version;

if (typeof version !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Invalid release version: ${String(version)}`);
}

function findHash(name) {
  const line = sums.split("\n").map(l => l.trim()).find(l => l.endsWith(name));
  if (!line) throw new Error(`SHA256SUMS.txt missing entry for ${name}`);
  return line.split(/\s+/)[0];
}

const template = await readFile(join(ROOT, "scripts", "homebrew", "memoire.rb.template"), "utf-8");

const filled = template
  .replaceAll("@VERSION@", version)
  .replaceAll("@SHA_DARWIN_ARM64@", findHash("memi-darwin-arm64.tar.gz"))
  .replaceAll("@SHA_DARWIN_X64@",   findHash("memi-darwin-x64.tar.gz"))
  .replaceAll("@SHA_LINUX_X64@",    findHash("memi-linux-x64.tar.gz"));

if (args.out === true) {
  throw new Error("--out requires a file path");
}

if (args.out) {
  await writeFile(args.out, filled);
  console.error(`✓ wrote ${args.out}`);
} else {
  process.stdout.write(filled);
}
