import { build } from "vite";
import { access, copyFile, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const widgetVersion = "2";

export async function buildPluginBundle(options = {}) {
  const rootDir = options.rootDir ? resolve(options.rootDir) : defaultRoot;
  const outDir = options.outDir ? resolve(options.outDir) : resolve(rootDir, "plugin");
  const uiSourceDir = resolve(rootDir, "src", "plugin", "ui");
  const uiEntry = resolve(uiSourceDir, "index.html");
  const mainEntry = resolve(rootDir, "src", "plugin", "main", "index.ts");
  const tempRoot = await mkdtemp(join(tmpdir(), "memoire-plugin-"));
  const uiOutDir = join(tempRoot, "ui");

  await build({
    configFile: false,
    root: rootDir,
    publicDir: false,
    build: {
      target: "es2017",
      minify: false,
      emptyOutDir: false,
      outDir,
      lib: {
        entry: mainEntry,
        formats: ["iife"],
        name: "MemoirePluginMain",
        fileName: () => "code.js",
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  });

  const bareMainOutput = join(outDir, "code");
  try {
    await access(bareMainOutput);
    await rm(join(outDir, "code.js"), { force: true });
    await rename(bareMainOutput, join(outDir, "code.js"));
  } catch {
    // Vite emitted code.js directly.
  }

  // Mark this as build output — the file is committed (Figma loads plugin
  // code from a static path, it can't fetch source at install time), so a
  // human or security scanner reading it should attribute its content to
  // this build pipeline (src/plugin/main/**), not to hand-authored logic.
  const codeJsPath = join(outDir, "code.js");
  const codeJsContent = await readFile(codeJsPath, "utf-8");
  await writeFile(
    codeJsPath,
    `// GENERATED FILE — built by scripts/build-plugin.mjs from src/plugin/main/**.\n// Do not edit directly; run \`npm run build:plugin\` to regenerate.\n${codeJsContent}`,
    "utf-8",
  );

  await build({
    configFile: false,
    root: uiSourceDir,
    publicDir: false,
    build: {
      target: "es2017",
      minify: false,
      emptyOutDir: true,
      outDir: uiOutDir,
      rollupOptions: {
        input: uiEntry,
        output: {
          entryFileNames: "assets/[name].js",
          chunkFileNames: "assets/[name].js",
          assetFileNames: "assets/[name][extname]",
        },
      },
    },
  });

  const manifestSource = resolve(rootDir, "plugin", "manifest.json");
  const manifestTarget = join(outDir, "manifest.json");
  try {
    await access(manifestTarget);
  } catch {
    await copyFile(manifestSource, manifestTarget);
  }

  const html = await readFile(join(uiOutDir, "index.html"), "utf-8");
  const inlined = await inlineAssets(html, uiOutDir);
  await writeFile(join(outDir, "ui.html"), inlined, "utf-8");
  await writeWidgetMeta(rootDir, outDir);
  await rm(tempRoot, { recursive: true, force: true });

  return {
    outDir,
    codePath: join(outDir, "code.js"),
    htmlPath: join(outDir, "ui.html"),
    metaPath: join(outDir, "widget-meta.json"),
  };
}

export const buildPlugin = buildPluginBundle;

async function inlineAssets(html, outDir) {
  let result = html;

  const scriptMatches = [...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*><\/script>/g)];
  for (const match of scriptMatches) {
    const assetPath = join(outDir, match[1]);
    const source = await readFile(assetPath, "utf-8");
    result = result.replace(match[0], `<script>${source}</script>`);
  }

  const styleMatches = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g)];
  for (const match of styleMatches) {
    const assetPath = join(outDir, match[1]);
    const source = await readFile(assetPath, "utf-8");
    result = result.replace(match[0], `<style>\n${source}\n</style>`);
  }

  return result;
}

async function writeWidgetMeta(rootDir, outDir) {
  const packageJson = JSON.parse(await readFile(join(rootDir, "package.json"), "utf-8"));
  const metaPath = join(outDir, "widget-meta.json");
  const previousMeta = await readJson(metaPath);
  const manifest = await createAsset(outDir, join(outDir, "manifest.json"));
  const code = await createAsset(outDir, join(outDir, "code.js"));
  const ui = await createAsset(outDir, join(outDir, "ui.html"));
  const bundleHash = sha256(JSON.stringify([
    manifest.sha256 || "missing",
    code.sha256 || "missing",
    ui.sha256 || "missing",
  ]));
  const builtAt = previousMeta?.bundleHash === bundleHash && typeof previousMeta.builtAt === "string"
    ? previousMeta.builtAt
    : new Date().toISOString();

  await writeFile(
    metaPath,
    JSON.stringify({
      widgetVersion,
      packageVersion: packageJson.version ?? null,
      builtAt,
      bundleHash,
      manifest,
      code,
      ui,
    }, null, 2) + "\n",
    "utf-8",
  );
}

async function createAsset(bundleRoot, path) {
  const buffer = await readFile(path);
  return {
    path: relative(bundleRoot, path).replace(/\\/g, "/"),
    exists: true,
    bytes: buffer.byteLength,
    sha256: sha256(buffer),
  };
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf-8"));
  } catch {
    return null;
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  await buildPluginBundle();
}
