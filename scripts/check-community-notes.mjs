#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const communityRoot = resolve(root, process.env.MEMOIRE_COMMUNITY_NOTES_ROOT ?? "../design-skills");
const notesRoot = resolve(root, process.argv.includes("--local") ? "notes" : join(communityRoot, "skills"));

if (!existsSync(notesRoot)) {
  console.log(`No community Notes root found at ${notesRoot}.`);
  process.exit(0);
}

const failures = [];
for (const entry of await readdir(notesRoot, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
  const validation = await validateCommunityNoteDir(join(notesRoot, entry.name), { strictCommunity: true });
  if (!validation.ok) failures.push(validation);
}

if (failures.length > 0) {
  console.error("Community Notes check failed:");
  for (const failure of failures) {
    for (const issue of failure.issues) console.error(`- ${failure.notePath}: ${issue.path ?? "note"}: ${issue.message}`);
  }
  process.exit(1);
}

console.log(`Community Notes check passed for ${notesRoot}.`);

async function validateCommunityNoteDir(path) {
  const issues = [];
  const manifestPath = join(path, "note.json");
  if (!existsSync(manifestPath)) {
    return { ok: false, notePath: path, issues: [{ path: "note.json", message: "note.json is required" }] };
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (!/^[a-z][a-z0-9-]*$/.test(manifest.name ?? "")) issues.push({ path: "note.json", message: "name must be kebab-case" });
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version ?? "")) issues.push({ path: "note.json", message: "version must be semver" });
  if (!Array.isArray(manifest.sourceUrls) || manifest.sourceUrls.length === 0) issues.push({ path: "note.json", message: "sourceUrls metadata is required for community review" });
  if (!manifest.lastResearchedAt) issues.push({ path: "note.json", message: "lastResearchedAt metadata is required for community review" });
  if (!manifest.freshnessDays) issues.push({ path: "note.json", message: "freshnessDays metadata is required for community review" });
  for (const skill of manifest.skills ?? []) {
    if (!isSafeRelativePath(skill.file ?? "")) issues.push({ path: skill.file, message: `unsafe skill file path: ${skill.file}` });
    else if (!existsSync(join(path, skill.file))) issues.push({ path: skill.file, message: `skill file is missing: ${skill.file}` });
  }
  return { ok: issues.length === 0, notePath: path, issues };
}

function isSafeRelativePath(path) {
  return Boolean(path)
    && !path.startsWith("/")
    && !path.includes("\\")
    && !path.split("/").includes("..");
}
