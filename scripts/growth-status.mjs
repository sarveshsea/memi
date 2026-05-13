#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildGrowthStatus, printHuman } from "./lib/growth-status.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf-8"));
const json = process.argv.includes("--json");

const status = await buildGrowthStatus({ packageJson, root });

if (json) {
  console.log(JSON.stringify(status, null, 2));
} else {
  printHuman(status);
}
