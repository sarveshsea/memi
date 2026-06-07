#!/usr/bin/env node

import { access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const entry = join(root, "dist", "index.js");
const requiredTools = [
  "pull_design_system",
  "diagnose_app_quality",
  "audit_ux_tenets_traps",
  "design_doc",
  "get_shadcn_registry",
];
const minToolCount = 20;
const timeoutMs = Number.parseInt(process.env.MEMOIRE_MCP_SMOKE_TIMEOUT_MS ?? "8000", 10);

try {
  await access(entry);
} catch {
  fail("dist/index.js is missing; run `npm run build` before the MCP stdio smoke check.");
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [entry, "mcp", "start", "--no-figma"],
  cwd: root,
  env: {
    ...stringEnv(process.env),
    MEMOIRE_LOG_LEVEL: process.env.MEMOIRE_LOG_LEVEL ?? "fatal",
    NODE_ENV: process.env.NODE_ENV ?? "production",
  },
  stderr: "pipe",
});

const client = new Client({ name: "memoire-release-smoke", version: "0.0.0" });
const timer = setTimeout(() => {
  void client.close().catch(() => undefined);
  fail(`MCP stdio smoke timed out after ${timeoutMs}ms.`);
}, timeoutMs);

try {
  await client.connect(transport);
  const listed = await client.listTools();
  const names = listed.tools.map((tool) => tool.name).sort();
  const missing = requiredTools.filter((tool) => !names.includes(tool));
  if (listed.tools.length < minToolCount) {
    fail(`MCP stdio listed ${listed.tools.length} tools, expected at least ${minToolCount}.`);
  }
  if (missing.length > 0) {
    fail(`MCP stdio missing required tools: ${missing.join(", ")}.`);
  }
  console.log(`mcp stdio smoke: ${listed.tools.length} tools (${requiredTools.join(", ")})`);
} catch (error) {
  fail(`MCP stdio smoke failed: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  clearTimeout(timer);
  await client.close().catch(() => undefined);
}

function stringEnv(env) {
  const result = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") result[key] = value;
  }
  return result;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
