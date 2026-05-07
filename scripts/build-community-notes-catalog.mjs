#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const communityRoot = resolve(
  root,
  process.env.MEMOIRE_COMMUNITY_NOTES_ROOT
    ?? "../memoire-community-notes",
);
const notesRoot = existsSync(join(communityRoot, "notes"))
  ? join(communityRoot, "notes")
  : join(root, "examples", "community-notes", "notes");

const result = spawnSync(process.execPath, [
  join(root, "scripts", "build-notes-catalog.mjs"),
  "--notes-root", notesRoot,
  "--out-root", join(root, "examples", "site-bundle", "notes", "community"),
  "--base-url", process.env.MEMOIRE_COMMUNITY_NOTES_BASE_URL ?? "https://www.memoire.cv/notes/community",
  "--source-kind", "community",
  "--source-repo", "https://github.com/sarveshsea/memoire-community-notes",
  "--contribution-base-url", "https://github.com/sarveshsea/memoire-community-notes/tree/main/notes",
  "--review-status", "approved",
  "--page-base-path", "/notes/community",
], {
  cwd: root,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
