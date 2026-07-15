#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const baseDir = resolve(root, args.baseDir ?? "examples/site-bundle");
const failures = [];

await requireFile(join(baseDir, "notes", "catalog.v1.json"));
await requireFile(join(baseDir, "notes", "index.html"));
await requireFile(join(baseDir, "notes", "community", "catalog.v1.json"));
await requireFile(join(baseDir, "notes", "community", "index.html"));
await requireFile(join(baseDir, "assets", "marketplace-catalog.v1.json"));
await requireFile(join(baseDir, "install.sh"));
await requireFile(join(baseDir, "install.ps1"));

const catalog = JSON.parse(await readFile(join(baseDir, "notes", "catalog.v1.json"), "utf8"));
for (const note of catalog.notes ?? []) {
  await requireFile(join(baseDir, "notes", note.name, "index.html"));
  await requireFile(join(baseDir, "notes", note.name, `${note.name}-${note.version}.tgz`));
  if (!note.archive?.sha256) failures.push(`note ${note.name} is missing archive sha256`);
  if (!note.archive?.url?.includes(`/notes/${note.name}/`)) failures.push(`note ${note.name} archive url is not under /notes/${note.name}/`);
}

const communityCatalog = JSON.parse(await readFile(join(baseDir, "notes", "community", "catalog.v1.json"), "utf8"));
for (const note of communityCatalog.notes ?? []) {
  await requireFile(join(baseDir, "notes", "community", note.name, "index.html"));
  await requireFile(join(baseDir, "notes", "community", note.name, `${note.name}-${note.version}.tgz`));
  if (!note.archive?.sha256) failures.push(`community note ${note.name} is missing archive sha256`);
  if (!note.archive?.url?.includes(`/notes/community/${note.name}/`)) failures.push(`community note ${note.name} archive url is not under /notes/community/${note.name}/`);
  if (!note.contributionUrl?.includes("design-skills")) failures.push(`community note ${note.name} is missing community contribution url`);
}

if (args.baseUrl) {
  const baseUrl = args.baseUrl.replace(/\/+$/, "");
  await requireRemote(`${baseUrl}/notes/catalog.v1.json`);
  await requireRemote(`${baseUrl}/notes/`);
  await requireRemote(`${baseUrl}/notes/community/catalog.v1.json`);
  await requireRemote(`${baseUrl}/notes/community/`);
  await requireRemote(`${baseUrl}/assets/marketplace-catalog.v1.json`);
  await requireRemote(`${baseUrl}/install.sh`);
  await requireRemote(`${baseUrl}/install.ps1`);
  for (const note of (catalog.notes ?? []).slice(0, 5)) {
    await requireRemote(`${baseUrl}/notes/${encodeURIComponent(note.name)}/`);
    await requireRemote(`${baseUrl}/notes/${encodeURIComponent(note.name)}/${encodeURIComponent(`${note.name}-${note.version}.tgz`)}`);
  }
}

if (failures.length > 0) {
  console.error("Site bundle check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Site bundle check passed for ${baseDir}${args.baseUrl ? ` and ${args.baseUrl}` : ""}.`);

async function requireFile(path) {
  try {
    await access(path);
  } catch {
    failures.push(`missing ${path}`);
  }
}

async function requireRemote(url) {
  try {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) failures.push(`${url} returned HTTP ${response.status}`);
  } catch (error) {
    failures.push(`${url} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value.startsWith("--base-url=")) parsed.baseUrl = value.slice("--base-url=".length);
    else if (value === "--base-url") parsed.baseUrl = values[index += 1];
    else if (value.startsWith("--base-dir=")) parsed.baseDir = value.slice("--base-dir=".length);
    else if (value === "--base-dir") parsed.baseDir = values[index += 1];
  }
  return parsed;
}
