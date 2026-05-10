#!/usr/bin/env node

import { readdir, readFile, access, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyChangelogData, parseChangelogMarkdown } from "./build-changelog-preview.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf-8"));
}

const failures = [];

function fail(message) {
  failures.push(message);
}

function normalizeNewlines(value) {
  return value.replace(/\r\n/g, "\n");
}

function isPng(buffer) {
  return buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a;
}

const packageJson = await readJson(join(root, "package.json"));
const version = packageJson.version;
const expectedMcpName = "io.github.sarveshsea/memi";
if (packageJson.mcpName !== expectedMcpName) {
  fail(`package.json mcpName ${packageJson.mcpName} does not match ${expectedMcpName}`);
}

for (const lifecycle of ["preinstall", "install", "postinstall", "prepare"]) {
  if (packageJson.scripts?.[lifecycle]) {
    fail(`package.json must not define npm lifecycle script "${lifecycle}" for the public package`);
  }
}

for (const unsafeFile of ["scripts/postinstall.mjs", "scripts/prepare.mjs"]) {
  if (packageJson.files?.includes(unsafeFile)) {
    fail(`package.json files must not ship lifecycle helper ${unsafeFile}`);
  }
}

const copiedMiroFishMarkers = [
  ["camel", "-oasis"].join(""),
  ["camel", "_oasis"].join(""),
  ["generate", "_twitter", "_agent", "_graph"].join(""),
  ["generate", "_reddit", "_agent", "_graph"].join(""),
  ["MiroFish", " Team"].join(""),
  ["ZepGraph", "Memory", "Updater"].join(""),
  ["Oasis", "Profile", "Generator"].join(""),
  ["run", "_parallel", "_simulation", ".py"].join(""),
];
for (const file of await collectPackagedFiles(packageJson.files ?? [])) {
  if (isMiroFishBoundaryScanner(file)) continue;
  if (/\.(md|mdx|txt)$/i.test(file) || !/\.(cjs|css|html|js|json|mjs|toml|ts|tsx|ya?ml)$/i.test(file)) continue;
  let content = "";
  try {
    content = await readFile(join(root, file), "utf-8");
  } catch {
    continue;
  }
  for (const marker of copiedMiroFishMarkers) {
    if (content.includes(marker)) {
      fail(`packaged file ${file} contains copied MiroFish source marker: ${marker}`);
    }
  }
}

const readme = await readFile(join(root, "README.md"), "utf-8");
const readmeTopFold = readme.slice(0, 3000);
const requiredReadmeTerms = [
  "Design-system memory for coding agents",
  "npm i -g @memi-design/cli",
  "memi diagnose",
  "memi shadcn export",
  "memoire.cv",
  "https://ui.shadcn.com/docs/registry/getting-started",
  "https://v0.app/docs/design-systems",
];
for (const term of requiredReadmeTerms) {
  if (!readmeTopFold.includes(term)) {
    fail(`README top fold is missing required conversion term: ${term}`);
  }
}

const codexInstallCommand = "codex plugin marketplace add sarveshsea/memi --ref main --sparse .agents/plugins --sparse plugins/memoire";
const codexPluginDocs = await readFile(join(root, "docs", "CODEX_PLUGIN.md"), "utf-8");
if (!codexPluginDocs.includes(codexInstallCommand)) {
  fail("docs/CODEX_PLUGIN.md is missing the public Codex marketplace install command");
}
if (!packageJson.scripts?.["smoke:codex-plugin"]) {
  fail("package.json scripts must include smoke:codex-plugin");
}

const codexPluginManifest = await readJson(join(root, "plugins", "memoire", ".codex-plugin", "plugin.json"));
const codexInterface = codexPluginManifest.interface ?? {};
if (codexPluginManifest.homepage !== "https://www.memoire.cv/codex-plugin") {
  fail("Codex plugin manifest homepage must point to https://www.memoire.cv/codex-plugin");
}
for (const field of ["privacyPolicyURL", "termsOfServiceURL"]) {
  if (typeof codexPluginManifest[field] !== "string" || !codexPluginManifest[field].startsWith("https://www.memoire.cv/")) {
    fail(`Codex plugin manifest is missing ${field}`);
  }
  if (typeof codexInterface[field] !== "string" || !codexInterface[field].startsWith("https://www.memoire.cv/")) {
    fail(`Codex plugin interface is missing ${field}`);
  }
}
for (const assetPath of [
  codexInterface.logo,
  codexInterface.composerIcon,
  ...(codexInterface.screenshots ?? []),
]) {
  if (typeof assetPath !== "string" || !assetPath.endsWith(".png")) {
    fail(`Codex plugin asset must be a PNG path: ${assetPath}`);
    continue;
  }
  const buffer = await readFile(join(root, "plugins", "memoire", assetPath.replace(/^\.\//, "")));
  if (!isPng(buffer)) fail(`Codex plugin asset is not a PNG: ${assetPath}`);
}

const codexPagePath = join(root, "examples", "site-bundle", "codex-plugin", "index.html");
const codexPage = await readFile(codexPagePath, "utf-8");
if (!codexPage.includes(codexInstallCommand) || !codexPage.includes("memi agent install codex-plugin")) {
  fail("examples/site-bundle/codex-plugin/index.html is missing Codex plugin install paths");
}
const codexPrivacyPage = await readFile(join(root, "examples", "site-bundle", "privacy", "index.html"), "utf-8");
const codexTermsPage = await readFile(join(root, "examples", "site-bundle", "terms", "index.html"), "utf-8");
if (!codexPrivacyPage.includes("Memoire privacy policy")) {
  fail("examples/site-bundle/privacy/index.html is missing the Memoire privacy policy");
}
if (!codexTermsPage.includes("Memoire terms of service")) {
  fail("examples/site-bundle/terms/index.html is missing the Memoire terms of service");
}

const cliEntry = await readFile(join(root, "src", "index.ts"), "utf-8");
for (const command of ["diagnose [target]", "tokens", "publish", "shadcn <subcommand>", "fix <subcommand>", "add <component>", "registry <subcommand>"]) {
  if (!cliEntry.includes(command)) {
    fail(`fast CLI help is missing command: ${command}`);
  }
}

const lockfile = await readJson(join(root, "package-lock.json"));
if (lockfile.version !== version) {
  fail(`package-lock.json version ${lockfile.version} does not match package.json ${version}`);
}
if (lockfile.packages?.[""]?.version !== version) {
  fail(`package-lock.json root package version ${lockfile.packages?.[""]?.version} does not match package.json ${version}`);
}

const mcpServerJson = await readJson(join(root, "server.json"));
if (mcpServerJson.name !== packageJson.mcpName) {
  fail(`server.json name ${mcpServerJson.name} does not match package.json mcpName ${packageJson.mcpName}`);
}
if (mcpServerJson.version !== version) {
  fail(`server.json version ${mcpServerJson.version} does not match package.json ${version}`);
}
if (mcpServerJson.description?.length > 100) {
  fail("server.json description must be 100 characters or fewer for the MCP Registry");
}
const npmPackageEntry = mcpServerJson.packages?.find((entry) => entry.registryType === "npm");
if (!npmPackageEntry) {
  fail("server.json must include an npm package entry");
} else {
  if (npmPackageEntry.identifier !== packageJson.name) {
    fail(`server.json npm identifier ${npmPackageEntry.identifier} does not match package.json name ${packageJson.name}`);
  }
  if (npmPackageEntry.version !== version) {
    fail(`server.json npm version ${npmPackageEntry.version} does not match package.json ${version}`);
  }
  if (npmPackageEntry.registryBaseUrl !== "https://registry.npmjs.org") {
    fail("server.json npm package must use https://registry.npmjs.org");
  }
  if (npmPackageEntry.transport?.type !== "stdio") {
    fail("server.json npm package transport must be stdio");
  }
  const packageArgs = npmPackageEntry.packageArguments ?? [];
  const positionalArgs = packageArgs
    .filter((arg) => arg.type === "positional")
    .map((arg) => arg.value);
  const expectedArgs = ["mcp", "start", "--no-figma"];
  if (JSON.stringify(positionalArgs) !== JSON.stringify(expectedArgs)) {
    fail(`server.json npm package must use registry-safe MCP args ${expectedArgs.join(" ")}; got ${positionalArgs.join(" ")}`);
  }
}

const changelog = normalizeNewlines(await readFile(join(root, "CHANGELOG.md"), "utf-8"));
const changelogMatch = changelog.match(/^## v([0-9]+\.[0-9]+\.[0-9]+)\b/m);
if (!changelogMatch) {
  fail("CHANGELOG.md does not contain a version heading");
} else if (changelogMatch[1] !== version) {
  fail(`CHANGELOG.md starts at v${changelogMatch[1]} but package.json is ${version}`);
}

const previewPath = join(root, "preview", "changelog.html");
const currentPreview = normalizeNewlines(await readFile(previewPath, "utf-8"));
const releases = parseChangelogMarkdown(changelog);
const generatedPreview = applyChangelogData(currentPreview, releases);
if (generatedPreview !== currentPreview) {
  fail("preview/changelog.html is not synced with CHANGELOG.md");
}

const widgetMetaPath = join(root, "plugin", "widget-meta.json");
const widgetMeta = await readJson(widgetMetaPath);
if (widgetMeta.packageVersion !== version) {
  fail(`plugin/widget-meta.json packageVersion ${widgetMeta.packageVersion} does not match package.json ${version}`);
}

for (const registryPath of await findRegistryFiles(join(root, "examples"))) {
  const registry = await readJson(registryPath);
  const registryVersion = registry.meta?.memoireVersion;
  if (registryVersion !== version) {
    fail(`${registryPath} meta.memoireVersion is ${registryVersion} but package.json is ${version}`);
  }
}

const starterReadmePath = join(root, "examples", "presets", "starter", "README.md");
const starterReadme = await readFile(starterReadmePath, "utf-8");
const starterReadmeMatch = starterReadme.match(/Generated for Memoire v([0-9]+\.[0-9]+\.[0-9]+)\./);
if (!starterReadmeMatch) {
  fail("examples/presets/starter/README.md is missing its generated version marker");
} else if (starterReadmeMatch[1] !== version) {
  fail(`examples/presets/starter/README.md says v${starterReadmeMatch[1]} but package.json is ${version}`);
}

const featuredCatalogPath = join(root, "examples", "featured-registries.json");
const featuredCatalog = await readJson(featuredCatalogPath);
if (!Array.isArray(featuredCatalog) || featuredCatalog.length < 3) {
  fail("examples/featured-registries.json must contain at least three featured registries");
} else {
  for (const entry of featuredCatalog) {
    if (!entry.slug || !entry.packageName || !entry.installCommand || !entry.sourcePath || !entry.screenshotPath) {
      fail(`featured registry entry is missing required fields: ${JSON.stringify(entry)}`);
      continue;
    }

    if (!entry.installCommand.includes(entry.packageName)) {
      fail(`featured registry ${entry.slug} installCommand does not reference ${entry.packageName}`);
    }

    const sourceDir = join(root, entry.sourcePath);
    const screenshotPath = join(root, entry.screenshotPath);

    try {
      await access(sourceDir);
    } catch {
      fail(`featured registry ${entry.slug} sourcePath does not exist: ${entry.sourcePath}`);
    }

    try {
      await access(screenshotPath);
    } catch {
      fail(`featured registry ${entry.slug} screenshotPath does not exist: ${entry.screenshotPath}`);
    }
  }
}

const marketplaceCatalog = await readJson(join(root, "examples", "marketplace-catalog.v1.json"));
const packagedMarketplaceCatalog = await readJson(join(root, "assets", "marketplace-catalog.v1.json"));
if (JSON.stringify(marketplaceCatalog) !== JSON.stringify(packagedMarketplaceCatalog)) {
  fail("examples/marketplace-catalog.v1.json and assets/marketplace-catalog.v1.json are not synced");
}
if (marketplaceCatalog.version !== 1) {
  fail(`marketplace catalog version is ${marketplaceCatalog.version}, expected 1`);
}
if (!Array.isArray(marketplaceCatalog.entries) || marketplaceCatalog.entries.length < 7) {
  fail("marketplace catalog must contain at least seven registry entries");
} else {
  const seen = new Set();
  for (const entry of marketplaceCatalog.entries) {
    if (!entry.slug || seen.has(entry.slug)) {
      fail(`marketplace catalog has a missing or duplicate slug: ${entry.slug}`);
    }
    seen.add(entry.slug);
    for (const field of ["packageName", "installCommand", "sourcePath", "sourceUrl", "screenshotPath", "screenshotUrl", "registryItemUrl", "openInV0Url", "description", "category"]) {
      if (!entry[field]) fail(`marketplace catalog ${entry.slug} is missing ${field}`);
    }
    if (!entry.openInV0Url.includes(encodeURIComponent(entry.registryItemUrl))) {
      fail(`marketplace catalog ${entry.slug} openInV0Url does not encode registryItemUrl`);
    }
    if (!Array.isArray(entry.tags) || entry.tags.length < 3) {
      fail(`marketplace catalog ${entry.slug} must include at least three SEO tags`);
    }
    if (!entry.installCommand?.includes(entry.packageName)) {
      fail(`marketplace catalog ${entry.slug} installCommand does not reference ${entry.packageName}`);
    }
  }
}

const requiredAgentNotes = [
  "hermes-agent-bridge",
  "openclaw-agent-bridge",
  "agent-messaging-gateway",
  "multi-agent-kanban",
  "agent-skill-migration",
  "mcp-server-studio",
  "approval-sandbox-policies",
  "model-router-diagnostics",
  "agent-memory-profiles",
  "cron-agent-workflows",
  "agent-session-checkpoints",
  "apple-desktop-automation",
  "browser-research-agent",
  "gateway-ops-observability",
  "secure-secrets-for-agents",
];
for (const noteName of requiredAgentNotes) {
  const manifestPath = join(root, "notes", noteName, "note.json");
  const skillPath = join(root, "notes", noteName, `${noteName}.md`);
  let manifest;
  try {
    manifest = await readJson(manifestPath);
  } catch {
    fail(`required agent note is missing manifest: ${noteName}`);
    continue;
  }
  try {
    await access(skillPath);
  } catch {
    fail(`required agent note is missing skill markdown: ${noteName}`);
  }
  if (!Array.isArray(manifest.sourceUrls) || manifest.sourceUrls.length < 2) {
    fail(`required agent note ${noteName} must include at least two sourceUrls`);
  }
  if (!manifest.lastResearchedAt) {
    fail(`required agent note ${noteName} must include lastResearchedAt`);
  }
  if (!Number.isInteger(manifest.freshnessDays) || manifest.freshnessDays <= 0) {
    fail(`required agent note ${noteName} must include a positive freshnessDays`);
  }
}
for (const siteBundlePath of [
  join(root, "examples", "site-bundle", "notes", "catalog.v1.json"),
  join(root, "examples", "site-bundle", "notes", "index.html"),
  join(root, "examples", "site-bundle", "notes", "hermes-agent-bridge", "index.html"),
  join(root, "examples", "site-bundle", "assets", "marketplace-catalog.v1.json"),
]) {
  try {
    await access(siteBundlePath);
  } catch {
    fail(`site bundle is missing required marketplace path: ${siteBundlePath}`);
  }
}

if (process.env.SKIP_PACK_GATE !== "1") {
  const pack = spawnSync(process.execPath, [join(root, "scripts", "pack-dry-run.mjs")], {
    cwd: root,
    encoding: "utf-8",
    maxBuffer: 1024 * 1024,
  });
  if (pack.status !== 0) {
    fail(`package size gate failed: ${pack.stderr.trim() || pack.stdout.trim() || pack.status}`);
  }
}

if (process.env.SKIP_AUDIT_GATE !== "1") {
  const audit = spawnSync("npm", ["audit", "--omit=dev", "--audit-level=high", "--json"], {
    cwd: root,
    encoding: "utf-8",
    maxBuffer: 1024 * 1024 * 5,
    env: {
      ...process.env,
      npm_config_ignore_scripts: "true",
    },
  });
  if (audit.status !== 0) {
    fail(`production audit gate failed: ${audit.stderr.trim() || audit.stdout.trim() || audit.status}`);
  }
}

if (failures.length > 0) {
  console.error("\nRelease consistency check failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error("");
  process.exit(1);
}

console.log(`Release consistency check passed for v${version}.`);

async function findRegistryFiles(dir) {
  const registryFiles = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      registryFiles.push(...await findRegistryFiles(path));
      continue;
    }
    if (entry.isFile() && entry.name === "registry.json") {
      registryFiles.push(path);
    }
  }

  return registryFiles;
}

async function collectPackagedFiles(fileEntries) {
  const includes = fileEntries.filter((entry) => typeof entry === "string" && !entry.startsWith("!"));
  const excludes = fileEntries.filter((entry) => typeof entry === "string" && entry.startsWith("!")).map((entry) => entry.slice(1));
  const files = [];

  for (const entry of includes) {
    const abs = join(root, entry);
    let entryStat;
    try {
      entryStat = await stat(abs);
    } catch {
      continue;
    }
    if (entryStat.isDirectory()) await walkPackagedDir(abs, excludes, files);
    else pushPackagedFile(entry, excludes, files);
  }

  return Array.from(new Set(files));
}

async function walkPackagedDir(dir, excludes, files) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkPackagedDir(abs, excludes, files);
    } else {
      pushPackagedFile(abs.slice(root.length + 1), excludes, files);
    }
  }
}

function pushPackagedFile(file, excludes, files) {
  const normalized = file.replace(/\\/g, "/");
  if (isExcludedPackageFile(normalized, excludes)) return;
  files.push(normalized);
}

function isExcludedPackageFile(file, excludes) {
  return excludes.some((pattern) => {
    const normalized = pattern.replace(/\\/g, "/");
    if (normalized.includes("**/__tests__")) return file.includes("/__tests__/");
    if (!normalized.includes("*")) return file === normalized;
    const prefix = normalized.split("*")[0];
    return file.startsWith(prefix);
  });
}

function isMiroFishBoundaryScanner(file) {
  return /(^|\/)simulation\/license-boundary\.(cjs|js|mjs|ts)$/.test(file);
}
