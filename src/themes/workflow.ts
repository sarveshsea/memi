import { mkdir, readFile, readdir, writeFile } from "fs/promises";
import { basename, dirname, extname, join, resolve } from "path";
import type { DesignSystem, DesignToken } from "../engine/registry.js";
import { generateShadcnTokenMapping } from "../codegen/tailwind-tokens.js";
import { generateTailwindV4Theme } from "../codegen/tailwind-v4.js";
import { fetchTweakcnTheme, parseTweakcnCss } from "../integrations/tweakcn.js";
import { parseCssColorToRgb } from "../utils/color.js";

const THEME_SCHEMA_VERSION = 1;
const DEFAULT_THEME_VARIANTS: ThemeVariantRecipe[] = ["dark", "warm", "enterprise", "high-contrast"];

const REQUIRED_SEMANTIC_TOKENS = [
  "background",
  "foreground",
  "primary",
  "primary-foreground",
  "border",
  "input",
  "ring",
] as const;

const RECOMMENDED_SEMANTIC_TOKENS = [
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
] as const;

const CONTRAST_PAIRS = [
  ["foreground", "background"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["muted-foreground", "muted"],
  ["destructive-foreground", "destructive"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
] as const;

export type ThemeSourceKind = "file" | "url" | "generated";
export type ThemeVariantRecipe = "dark" | "warm" | "enterprise" | "high-contrast";

export interface ThemeSourceRef {
  kind: ThemeSourceKind;
  value: string;
  resolved?: string;
}

export interface ThemeValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  token?: string;
  mode?: string;
}

export interface ThemeContrastCheck {
  pair: string;
  mode: string;
  foregroundToken: string;
  backgroundToken: string;
  foregroundValue: string;
  backgroundValue: string;
  ratio: number | null;
  status: "pass" | "warn" | "skip";
}

export interface ThemeValidationReport {
  status: "pass" | "warn" | "fail";
  issues: ThemeValidationIssue[];
  contrast: ThemeContrastCheck[];
  summary: {
    errors: number;
    warnings: number;
    totalTokens: number;
    semanticCoverage: number;
    missingDarkTokens: number;
    contrastFailures: number;
  };
}

export interface StoredTheme {
  schemaVersion: number;
  kind: "memoire-theme";
  name: string;
  slug: string;
  importedAt: string;
  source: ThemeSourceRef;
  hasDarkMode: boolean;
  tokens: DesignToken[];
  css: string;
  validation: ThemeValidationReport;
  summary: {
    colors: number;
    spacing: number;
    radius: number;
    shadow: number;
    typography: number;
    other: number;
  };
  lineage?: {
    baseTheme: string;
    recipe: ThemeVariantRecipe;
  };
}

export interface ThemeDiffResult {
  from: { name: string; slug: string; importedAt: string };
  to: { name: string; slug: string; importedAt: string };
  tokens: {
    added: string[];
    removed: string[];
    changed: Array<{ name: string; type: DesignToken["type"]; from: string; to: string }>;
  };
  highlights: string[];
  contrastRegressions: Array<{ pair: string; mode: string; from: number | null; to: number | null }>;
  darkMode: { from: boolean; to: boolean };
}

export interface ThemeImportResult {
  theme: StoredTheme;
  filePath: string;
}

export interface ThemeApplyResult {
  designSystem: DesignSystem;
  outDir: string;
  filesWritten: string[];
}

export interface ThemePreviewResult {
  outFile: string;
  html: string;
}

export interface ThemePackageArtifacts {
  themePath: string;
  previewPath: string;
}

export async function importThemeFromSource(input: {
  arkDir: string;
  source: string;
  name?: string;
  cwd?: string;
}): Promise<ThemeImportResult> {
  const cwd = input.cwd ?? process.cwd();
  const loaded = await loadThemeCss(input.source, cwd);
  const theme = buildStoredTheme({
    name: input.name ?? deriveThemeName(input.source),
    source: loaded.source,
    css: loaded.css,
  });
  const filePath = await saveTheme(input.arkDir, theme);
  return { theme, filePath };
}

export async function saveTheme(arkDir: string, theme: StoredTheme): Promise<string> {
  const dir = getThemesDir(arkDir);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${theme.slug}.json`);
  await writeFile(filePath, JSON.stringify(theme, null, 2));
  return filePath;
}

export async function listThemes(arkDir: string): Promise<StoredTheme[]> {
  const dir = getThemesDir(arkDir);
  await mkdir(dir, { recursive: true });
  const entries = await readdir(dir).catch(() => []);
  const themes: StoredTheme[] = [];

  for (const entry of entries.filter((name) => name.endsWith(".json")).sort()) {
    try {
      const raw = await readFile(join(dir, entry), "utf-8");
      const parsed = JSON.parse(raw) as StoredTheme;
      if (parsed && parsed.kind === "memoire-theme" && Array.isArray(parsed.tokens)) {
        themes.push(parsed);
      }
    } catch {
      // Ignore malformed theme files and keep scanning.
    }
  }

  return themes.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
}

export async function getTheme(arkDir: string, reference?: string): Promise<StoredTheme | null> {
  const themes = await listThemes(arkDir);
  if (themes.length === 0) return null;
  if (!reference) return themes[0];

  const slug = slugifyThemeName(reference);
  const lower = reference.toLowerCase();
  return themes.find((theme) => theme.slug === slug || theme.name.toLowerCase() === lower) ?? null;
}

export function buildStoredTheme(input: {
  name: string;
  source: ThemeSourceRef;
  css: string;
  importedAt?: string;
  lineage?: StoredTheme["lineage"];
}): StoredTheme {
  const parsed = parseTweakcnCss(input.css);
  if (parsed.tokens.length === 0) {
    throw new Error("No tokens found in tweakcn theme");
  }

  const tokens = [...parsed.tokens].sort((a, b) => a.name.localeCompare(b.name));
  const validation = validateThemeTokens(tokens, parsed.hasDarkMode);
  const importedAt = input.importedAt ?? new Date().toISOString();
  const name = input.name.trim();
  const slug = slugifyThemeName(name);

  return {
    schemaVersion: THEME_SCHEMA_VERSION,
    kind: "memoire-theme",
    name,
    slug,
    importedAt,
    source: input.source,
    hasDarkMode: parsed.hasDarkMode,
    tokens,
    css: input.css,
    validation,
    summary: summarizeTokens(tokens),
    lineage: input.lineage,
  };
}

export function validateThemeTokens(tokens: DesignToken[], hasDarkMode: boolean): ThemeValidationReport {
  const issues: ThemeValidationIssue[] = [];
  const contrast: ThemeContrastCheck[] = [];
  const tokenMap = buildTokenMap(tokens);

  let semanticFound = 0;
  for (const name of REQUIRED_SEMANTIC_TOKENS) {
    if (tokenMap.has(name)) {
      semanticFound++;
      continue;
    }
    issues.push({
      severity: "error",
      code: "semantic-token-missing",
      token: name,
      message: `Missing required semantic token "${name}"`,
    });
  }

  for (const name of RECOMMENDED_SEMANTIC_TOKENS) {
    if (tokenMap.has(name)) {
      semanticFound++;
      continue;
    }
    issues.push({
      severity: "warning",
      code: "semantic-token-recommended",
      token: name,
      message: `Missing recommended semantic token "${name}"`,
    });
  }

  if (!hasDarkMode) {
    issues.push({
      severity: "warning",
      code: "missing-dark-mode",
      message: "Theme does not define a dark mode block",
    });
  }

  let missingDarkTokens = 0;
  if (hasDarkMode) {
    for (const name of [...REQUIRED_SEMANTIC_TOKENS, ...RECOMMENDED_SEMANTIC_TOKENS]) {
      const token = tokenMap.get(name);
      if (!token) continue;
      if (token.values.default !== undefined && token.values.dark === undefined) {
        missingDarkTokens++;
        issues.push({
          severity: "warning",
          code: "dark-value-missing",
          token: token.name,
          mode: "dark",
          message: `Semantic token "${token.name}" has no dark value`,
        });
      }
    }
  }

  const radiusTokens = tokens.filter((token) => token.type === "radius");
  if (radiusTokens.length === 0) {
    issues.push({
      severity: "warning",
      code: "radius-scale-missing",
      message: "Theme does not define any radius tokens",
    });
  } else {
    for (const token of radiusTokens) {
      const px = parseSizeToPx(firstModeValue(token));
      if (px !== null && px > 32) {
        issues.push({
          severity: "warning",
          code: "radius-outlier",
          token: token.name,
          message: `Radius token "${token.name}" is unusually large (${firstModeValue(token)})`,
        });
      }
    }
  }

  const spacingTokens = tokens.filter((token) => token.type === "spacing");
  if (spacingTokens.length > 0) {
    const tinySpacing = spacingTokens.filter((token) => {
      const px = parseSizeToPx(firstModeValue(token));
      return px !== null && px < 4;
    });
    if (tinySpacing.length > 0) {
      issues.push({
        severity: "warning",
        code: "spacing-scale-fragile",
        message: `${tinySpacing.length} spacing token${tinySpacing.length === 1 ? "" : "s"} are under 4px`,
      });
    }
  }

  for (const [foregroundName, backgroundName] of CONTRAST_PAIRS) {
    const foreground = tokenMap.get(foregroundName);
    const background = tokenMap.get(backgroundName);
    if (!foreground || !background) continue;

    const modes = new Set(["default"]);
    if (foreground.values.dark !== undefined || background.values.dark !== undefined) modes.add("dark");

    for (const mode of modes) {
      const fg = modeValue(foreground, mode);
      const bg = modeValue(background, mode);
      if (fg === undefined || bg === undefined) continue;

      const fgRgb = parseCssColor(fg);
      const bgRgb = parseCssColor(bg);
      const pair = `${foregroundName} on ${backgroundName}`;
      if (!fgRgb || !bgRgb) {
        contrast.push({
          pair,
          mode,
          foregroundToken: foreground.name,
          backgroundToken: background.name,
          foregroundValue: fg,
          backgroundValue: bg,
          ratio: null,
          status: "skip",
        });
        issues.push({
          severity: "warning",
          code: "contrast-unparseable",
          token: `${foreground.name}/${background.name}`,
          mode,
          message: `Could not compute contrast for ${pair} (${mode})`,
        });
        continue;
      }

      const ratio = computeContrastRatio(fgRgb, bgRgb);
      const rounded = Math.round(ratio * 100) / 100;
      const passes = ratio >= 4.5;
      contrast.push({
        pair,
        mode,
        foregroundToken: foreground.name,
        backgroundToken: background.name,
        foregroundValue: fg,
        backgroundValue: bg,
        ratio: rounded,
        status: passes ? "pass" : "warn",
      });

      if (!passes) {
        issues.push({
          severity: "error",
          code: "contrast-fail",
          token: `${foreground.name}/${background.name}`,
          mode,
          message: `${pair} (${mode}) fails WCAG AA at ${rounded}:1`,
        });
      }
    }
  }

  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.length - errors;
  return {
    status: errors > 0 ? "fail" : warnings > 0 ? "warn" : "pass",
    issues,
    contrast,
    summary: {
      errors,
      warnings,
      totalTokens: tokens.length,
      semanticCoverage: semanticFound,
      missingDarkTokens,
      contrastFailures: contrast.filter((entry) => entry.status === "warn" && entry.ratio !== null && entry.ratio < 4.5).length,
    },
  };
}

export function diffThemes(from: StoredTheme, to: StoredTheme): ThemeDiffResult {
  const fromMap = new Map(from.tokens.map((token) => [token.name, token]));
  const toMap = new Map(to.tokens.map((token) => [token.name, token]));
  const added = [...toMap.keys()].filter((name) => !fromMap.has(name)).sort();
  const removed = [...fromMap.keys()].filter((name) => !toMap.has(name)).sort();
  const changed: ThemeDiffResult["tokens"]["changed"] = [];

  for (const [name, token] of toMap) {
    const previous = fromMap.get(name);
    if (!previous) continue;
    if (JSON.stringify(previous.values) !== JSON.stringify(token.values)) {
      changed.push({
        name,
        type: token.type,
        from: JSON.stringify(previous.values),
        to: JSON.stringify(token.values),
      });
    }
  }

  const highlights: string[] = [];
  if (changed.some((entry) => entry.name === "primary" || entry.name.startsWith("primary-"))) {
    highlights.push("primary changed");
  }
  if (changed.some((entry) => entry.type === "radius")) highlights.push("radius scale changed");
  if (from.hasDarkMode && !to.hasDarkMode) highlights.push("dark mode missing");
  if (to.validation.summary.errors < from.validation.summary.errors) highlights.push("validation improved");
  if (to.validation.summary.errors > from.validation.summary.errors) highlights.push("validation regressed");

  const fromContrast = new Map(from.validation.contrast.map((entry) => [`${entry.pair}:${entry.mode}`, entry]));
  const toContrast = new Map(to.validation.contrast.map((entry) => [`${entry.pair}:${entry.mode}`, entry]));
  const contrastRegressions: ThemeDiffResult["contrastRegressions"] = [];
  for (const [key, next] of toContrast) {
    const prev = fromContrast.get(key);
    if (!prev || prev.ratio === null || next.ratio === null) continue;
    if (prev.ratio >= 4.5 && next.ratio < 4.5) {
      const [pair, mode] = key.split(":");
      contrastRegressions.push({ pair, mode, from: prev.ratio, to: next.ratio });
    }
  }

  if (contrastRegressions.length > 0) highlights.push("contrast regressed");

  return {
    from: { name: from.name, slug: from.slug, importedAt: from.importedAt },
    to: { name: to.name, slug: to.slug, importedAt: to.importedAt },
    tokens: { added, removed, changed },
    highlights,
    contrastRegressions,
    darkMode: { from: from.hasDarkMode, to: to.hasDarkMode },
  };
}

export function createThemeVariants(
  baseTheme: StoredTheme,
  recipes: ThemeVariantRecipe[] = DEFAULT_THEME_VARIANTS,
): StoredTheme[] {
  return recipes.map((recipe) => {
    const tokens = cloneTokens(baseTheme.tokens).map((token) => transformTokenForVariant(token, recipe));
    const name = `${baseTheme.name} ${labelForRecipe(recipe)}`;
    const css = generateThemeCss(tokens);
    return buildStoredTheme({
      name,
      source: { kind: "generated", value: `variant:${baseTheme.slug}:${recipe}` },
      css,
      importedAt: new Date().toISOString(),
      lineage: { baseTheme: baseTheme.slug, recipe },
    });
  });
}

export async function applyThemeToProject(input: {
  theme: StoredTheme;
  designSystem: DesignSystem;
  outputDir: string;
  mode?: "replace" | "merge";
}): Promise<ThemeApplyResult> {
  const mode = input.mode ?? "merge";
  const tokens = mode === "replace" ? cloneTokens(input.theme.tokens) : mergeThemeTokens(input.designSystem.tokens, input.theme.tokens);
  const designSystem: DesignSystem = {
    tokens,
    components: input.designSystem.components,
    styles: input.designSystem.styles,
    lastSync: new Date().toISOString(),
  };

  await mkdir(input.outputDir, { recursive: true });
  const filesWritten: string[] = [];

  const cssPath = join(input.outputDir, "tokens.css");
  await writeFile(cssPath, generateThemeCss(input.theme.tokens));
  filesWritten.push(cssPath);

  const shadcnPath = join(input.outputDir, "shadcn-theme.css");
  await writeFile(shadcnPath, generateShadcnTokenMapping(input.theme.tokens));
  filesWritten.push(shadcnPath);

  const tailwindPath = join(input.outputDir, "tailwind-theme.css");
  await writeFile(tailwindPath, generateTailwindV4Theme(input.theme.tokens));
  filesWritten.push(tailwindPath);

  const themePath = join(input.outputDir, "theme.json");
  await writeFile(themePath, JSON.stringify(input.theme, null, 2));
  filesWritten.push(themePath);

  return { designSystem, outDir: input.outputDir, filesWritten };
}

export async function writeThemePreview(theme: StoredTheme, outFile: string): Promise<ThemePreviewResult> {
  const html = generateThemePreviewHtml(theme);
  await mkdir(dirname(resolve(outFile)), { recursive: true });
  await writeFile(outFile, html);
  return { outFile, html };
}

export async function writeThemePackageArtifacts(outDir: string, theme: StoredTheme): Promise<ThemePackageArtifacts> {
  const themePath = join(outDir, "theme.json");
  await writeFile(themePath, JSON.stringify(theme, null, 2));

  const previewDir = join(outDir, "preview");
  await mkdir(previewDir, { recursive: true });
  const previewPath = join(previewDir, "theme-preview.html");
  await writeFile(previewPath, generateThemePreviewHtml(theme));

  const pkgPath = join(outDir, "package.json");
  try {
    const pkg = JSON.parse(await readFile(pkgPath, "utf-8")) as { files?: string[] };
    pkg.files = [...new Set([...(pkg.files ?? []), "theme.json", "preview/"])];
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2));
  } catch {
    // Package artifacts are additive; keep going if package.json is not present.
  }

  const readmePath = join(outDir, "README.md");
  try {
    const readme = await readFile(readmePath, "utf-8");
    const appendix = [
      "",
      "## Theme Workflow",
      "",
      "```bash",
      '@import "<your-registry>/tokens/tokens.css";',
      "```",
      "",
      "- Preview included at `preview/theme-preview.html`",
      "- Full Memoire theme metadata included at `theme.json`",
      "",
    ].join("\n");
    await writeFile(readmePath, readme + appendix);
  } catch {
    // Ignore README append failures; published package remains valid.
  }

  return { themePath, previewPath };
}

export function generateThemeCss(tokens: DesignToken[]): string {
  const rootLines = [
    "/* Generated by Memoire — tweakcn theme */",
    ":root {",
    ...serializeTokenLines(tokens, "default").map((line) => `  ${line}`),
    "}",
  ];
  const hasDarkMode = tokens.some((token) => token.values.dark !== undefined);
  if (!hasDarkMode) return rootLines.join("\n") + "\n";

  return [
    ...rootLines,
    "",
    ".dark {",
    ...serializeTokenLines(tokens, "dark").map((line) => `  ${line}`),
    "}",
    "",
  ].join("\n");
}

export function generateThemePreviewHtml(theme: StoredTheme): string {
  const css = generateThemeCss(theme.tokens);
  const colorTokens = theme.tokens.filter((token) => token.type === "color").slice(0, 18);
  const swatches = colorTokens.map((token) => {
    const safe = escapeHtml(token.name);
    return [
      `<div class="swatch">`,
      `  <div class="chip" style="background: var(${token.cssVariable}, ${escapeHtml(firstModeValue(token))});"></div>`,
      `  <div class="meta">`,
      `    <strong>${safe}</strong>`,
      `    <span>${escapeHtml(firstModeValue(token))}</span>`,
      "  </div>",
      "</div>",
    ].join("\n");
  }).join("\n");

  const stats = [
    ["Tokens", String(theme.tokens.length)],
    ["Colors", String(theme.summary.colors)],
    ["Dark mode", theme.hasDarkMode ? "yes" : "no"],
    ["Validation", theme.validation.status],
  ].map(([label, value]) => `<div class="stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("\n");

  const tokenTable = theme.tokens.slice(0, 40).map((token) => {
    const darkValue = token.values.dark !== undefined ? String(token.values.dark) : "—";
    return `<tr><td>${escapeHtml(token.name)}</td><td>${escapeHtml(token.type)}</td><td>${escapeHtml(firstModeValue(token))}</td><td>${escapeHtml(darkValue)}</td></tr>`;
  }).join("\n");

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8" />',
    `  <title>${escapeHtml(theme.name)} — Theme Preview</title>`,
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    "  <style>",
    "    :root { --preview-bg: #f5f5f4; --preview-card: #ffffff; --preview-border: #e7e5e4; --preview-ink: #111827; --preview-muted: #6b7280; font-family: 'SF Pro Display', 'Inter', system-ui, sans-serif; }",
    css,
    "    * { box-sizing: border-box; }",
    "    body { margin: 0; background: radial-gradient(circle at top, #fef3c7 0%, #fafaf9 26%, #e7e5e4 100%); color: var(--preview-ink); }",
    "    .shell { max-width: 1240px; margin: 0 auto; padding: 40px 24px 80px; }",
    "    .hero { display: grid; gap: 20px; grid-template-columns: 1.4fr 1fr; align-items: start; margin-bottom: 28px; }",
    "    .hero-card, .surface, .table-card { border: 1px solid var(--preview-border); border-radius: 28px; background: rgba(255,255,255,0.82); backdrop-filter: blur(14px); box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08); }",
    "    .hero-card { padding: 28px; }",
    "    .eyebrow { display: inline-flex; padding: 8px 12px; border-radius: 999px; background: rgba(15, 23, 42, 0.05); color: var(--preview-muted); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }",
    "    h1 { margin: 16px 0 10px; font-size: clamp(2.4rem, 5vw, 4rem); line-height: 0.95; }",
    "    p { color: var(--preview-muted); font-size: 15px; line-height: 1.6; margin: 0; }",
    "    .stats { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }",
    "    .stat { padding: 18px; border-radius: 22px; border: 1px solid rgba(15, 23, 42, 0.08); background: rgba(255,255,255,0.7); }",
    "    .stat span { display: block; color: var(--preview-muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }",
    "    .stat strong { font-size: 1.5rem; }",
    "    .surfaces { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); margin-bottom: 24px; }",
    "    .surface { padding: 22px; }",
    "    .surface.default-preview { background: var(--background, #ffffff); color: var(--foreground, #111827); }",
    "    .surface.dark-preview { background: var(--background, #ffffff); color: var(--foreground, #111827); }",
    "    .dark-preview { box-shadow: inset 0 0 0 999px rgba(0, 0, 0, 0.02); }",
    "    .dark-preview.dark { background: var(--background, #111827); color: var(--foreground, #f8fafc); }",
    "    .demo-row { display: flex; flex-wrap: wrap; gap: 12px; margin: 16px 0; }",
    "    .btn { appearance: none; border: none; border-radius: var(--radius, 12px); padding: 12px 16px; font: inherit; cursor: pointer; }",
    "    .btn-primary { background: var(--primary, #2563eb); color: var(--primary-foreground, white); }",
    "    .btn-secondary { background: var(--secondary, #e5e7eb); color: var(--secondary-foreground, #111827); }",
    "    .input { min-width: 220px; border-radius: calc(var(--radius, 12px) - 2px); border: 1px solid var(--input, var(--border, #d4d4d8)); background: var(--card, rgba(255,255,255,0.8)); color: inherit; padding: 12px 14px; }",
    "    .card { border-radius: calc(var(--radius, 12px) + 8px); border: 1px solid var(--border, rgba(15,23,42,0.12)); background: var(--card, rgba(255,255,255,0.9)); color: var(--card-foreground, inherit); padding: 18px; display: grid; gap: 12px; }",
    "    .badge { display: inline-flex; width: fit-content; padding: 8px 12px; border-radius: 999px; background: var(--accent, #e0f2fe); color: var(--accent-foreground, #0f172a); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }",
    "    .chart { display: grid; grid-template-columns: repeat(6, 1fr); align-items: end; gap: 10px; height: 160px; margin-top: 12px; }",
    "    .bar { border-radius: 999px 999px 12px 12px; background: linear-gradient(180deg, var(--primary, #2563eb), var(--accent, #14b8a6)); }",
    "    .palette { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-top: 24px; }",
    "    .swatch { border-radius: 20px; border: 1px solid rgba(15,23,42,0.08); background: rgba(255,255,255,0.66); padding: 14px; display: grid; gap: 10px; }",
    "    .chip { height: 72px; border-radius: 16px; border: 1px solid rgba(15,23,42,0.08); }",
    "    .meta { display: grid; gap: 4px; }",
    "    .meta span { color: var(--preview-muted); font-size: 12px; overflow-wrap: anywhere; }",
    "    .table-card { margin-top: 24px; padding: 18px; overflow: auto; }",
    "    table { width: 100%; border-collapse: collapse; font-size: 14px; }",
    "    th, td { padding: 10px 12px; border-bottom: 1px solid rgba(15,23,42,0.08); text-align: left; }",
    "    th { color: var(--preview-muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }",
    "    @media (max-width: 900px) { .hero { grid-template-columns: 1fr; } }",
    "  </style>",
    "</head>",
    "<body>",
    '  <main class="shell">',
    '    <section class="hero">',
    '      <div class="hero-card">',
    '        <span class="eyebrow">Memoire Theme Preview</span>',
    `        <h1>${escapeHtml(theme.name)}</h1>`,
    `        <p>Imported from ${escapeHtml(theme.source.kind)} source ${escapeHtml(theme.source.value)}. This preview gives the tweakcn theme a shadcn-style reality check before you apply or publish it.</p>`,
    "      </div>",
    `      <div class="hero-card"><div class="stats">${stats}</div></div>`,
    "    </section>",
    '    <section class="surfaces">',
    `      <div class="surface default-preview">
            <span class="eyebrow">Default</span>
            <div class="demo-row">
              <button class="btn btn-primary">Primary action</button>
              <button class="btn btn-secondary">Secondary</button>
            </div>
            <div class="demo-row">
              <input class="input" value="Search teams" />
              <span class="badge">Theme ready</span>
            </div>
            <div class="card">
              <strong>Dashboard Card</strong>
              <p>Use this to sanity-check background, border, card foreground, and accent colors together.</p>
              <div class="chart">
                <div class="bar" style="height: 42%;"></div>
                <div class="bar" style="height: 56%;"></div>
                <div class="bar" style="height: 72%;"></div>
                <div class="bar" style="height: 61%;"></div>
                <div class="bar" style="height: 88%;"></div>
                <div class="bar" style="height: 78%;"></div>
              </div>
            </div>
          </div>`,
    `      <div class="surface dark-preview dark">
            <span class="eyebrow">Dark</span>
            <div class="demo-row">
              <button class="btn btn-primary">Primary action</button>
              <button class="btn btn-secondary">Secondary</button>
            </div>
            <div class="demo-row">
              <input class="input" value="Search teams" />
              <span class="badge">Theme ready</span>
            </div>
            <div class="card">
              <strong>Analytics Card</strong>
              <p>Confirms that the dark palette still feels legible once real surfaces and controls are layered together.</p>
              <div class="chart">
                <div class="bar" style="height: 48%;"></div>
                <div class="bar" style="height: 63%;"></div>
                <div class="bar" style="height: 81%;"></div>
                <div class="bar" style="height: 55%;"></div>
                <div class="bar" style="height: 92%;"></div>
                <div class="bar" style="height: 75%;"></div>
              </div>
            </div>
          </div>`,
    "    </section>",
    `    <section class="palette">${swatches}</section>`,
    '    <section class="table-card">',
    "      <table>",
    "        <thead><tr><th>Token</th><th>Type</th><th>Default</th><th>Dark</th></tr></thead>",
    `        <tbody>${tokenTable}</tbody>`,
    "      </table>",
    "    </section>",
    "  </main>",
    "</body>",
    "</html>",
  ].join("\n");
}

function getThemesDir(arkDir: string): string {
  return join(arkDir, "themes");
}

async function loadThemeCss(source: string, cwd: string): Promise<{ css: string; source: ThemeSourceRef }> {
  if (/^https?:\/\//i.test(source)) {
    return {
      css: await fetchTweakcnTheme(source),
      source: { kind: "url", value: source },
    };
  }

  const resolved = resolve(cwd, source);
  return {
    css: await readFile(resolved, "utf-8"),
    source: { kind: "file", value: source, resolved },
  };
}

function deriveThemeName(source: string): string {
  const base = basename(source).replace(extname(source), "");
  const normalized = base
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length > 0 ? titleCase(normalized) : "Imported Theme";
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function slugifyThemeName(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "theme";
}

function summarizeTokens(tokens: DesignToken[]): StoredTheme["summary"] {
  return {
    colors: tokens.filter((token) => token.type === "color").length,
    spacing: tokens.filter((token) => token.type === "spacing").length,
    radius: tokens.filter((token) => token.type === "radius").length,
    shadow: tokens.filter((token) => token.type === "shadow").length,
    typography: tokens.filter((token) => token.type === "typography").length,
    other: tokens.filter((token) => token.type === "other").length,
  };
}

function buildTokenMap(tokens: DesignToken[]): Map<string, DesignToken> {
  return new Map(tokens.map((token) => [token.name.toLowerCase(), token]));
}

function firstModeValue(token: DesignToken): string {
  return String(token.values.default ?? token.values.Default ?? Object.values(token.values)[0] ?? "");
}

function modeValue(token: DesignToken, mode: string): string | undefined {
  if (token.values[mode] !== undefined) return String(token.values[mode]);
  if (mode !== "default" && token.values.default !== undefined) return String(token.values.default);
  const first = Object.values(token.values)[0];
  return first !== undefined ? String(first) : undefined;
}

function parseSizeToPx(value: string): number | null {
  const trimmed = value.trim().toLowerCase();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return parseFloat(trimmed);
  const px = trimmed.match(/^(-?\d+(?:\.\d+)?)px$/);
  if (px) return parseFloat(px[1]);
  const rem = trimmed.match(/^(-?\d+(?:\.\d+)?)rem$/);
  if (rem) return parseFloat(rem[1]) * 16;
  return null;
}

function cloneTokens(tokens: DesignToken[]): DesignToken[] {
  return tokens.map((token) => ({
    ...token,
    values: { ...token.values },
  }));
}

function mergeThemeTokens(existing: DesignToken[], incoming: DesignToken[]): DesignToken[] {
  const byKey = new Map<string, DesignToken>();
  for (const token of existing) {
    byKey.set(token.cssVariable || token.name, { ...token, values: { ...token.values } });
  }
  for (const token of incoming) {
    byKey.set(token.cssVariable || token.name, { ...token, values: { ...token.values } });
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function serializeTokenLines(tokens: DesignToken[], mode: "default" | "dark"): string[] {
  return tokens
    .map((token) => {
      const value = modeValue(token, mode);
      return value ? `${token.cssVariable}: ${value};` : null;
    })
    .filter((line): line is string => line !== null)
    .sort((a, b) => a.localeCompare(b));
}

function transformTokenForVariant(token: DesignToken, recipe: ThemeVariantRecipe): DesignToken {
  const next: DesignToken = { ...token, values: { ...token.values } };
  if (token.type === "radius" && recipe === "enterprise") {
    for (const [mode, value] of Object.entries(next.values)) {
      const px = parseSizeToPx(String(value));
      if (px === null) continue;
      next.values[mode] = px > 8 ? "0.5rem" : value;
    }
    return next;
  }

  if (token.type !== "color") return next;

  if (recipe === "high-contrast") {
    applyHighContrastRecipe(next);
    return next;
  }

  if (recipe === "dark") {
    for (const mode of Object.keys(next.values)) {
      const sourceValue = mode === "default"
        ? String(next.values.dark ?? next.values.default ?? next.values[mode])
        : String(next.values.dark ?? next.values.default ?? next.values[mode]);
      next.values[mode] = transformDarkValue(next.name, sourceValue);
    }
    next.values.default = transformDarkValue(next.name, String(next.values.dark ?? next.values.default ?? firstModeValue(next)));
    next.values.dark = String(next.values.default);
    return next;
  }

  for (const [mode, value] of Object.entries(next.values)) {
    const original = String(value);
    if (recipe === "warm") {
      next.values[mode] = transformWarmValue(next.name, original);
    } else if (recipe === "enterprise") {
      next.values[mode] = transformEnterpriseValue(next.name, original);
    }
  }

  return next;
}

function applyHighContrastRecipe(token: DesignToken): void {
  const setIfNamed = (name: string, light: string, dark: string = light): boolean => {
    if (token.name !== name) return false;
    token.values.default = light;
    if (token.values.dark !== undefined) token.values.dark = dark;
    return true;
  };

  if (
    setIfNamed("background", "#ffffff", "#09090b") ||
    setIfNamed("card", "#ffffff", "#111827") ||
    setIfNamed("popover", "#ffffff", "#111827") ||
    setIfNamed("secondary", "#e5e7eb", "#1f2937") ||
    setIfNamed("muted", "#f3f4f6", "#111827") ||
    setIfNamed("accent", "#dbeafe", "#1e3a8a") ||
    setIfNamed("foreground", "#0f172a", "#fafafa") ||
    setIfNamed("card-foreground", "#0f172a", "#fafafa") ||
    setIfNamed("popover-foreground", "#0f172a", "#fafafa") ||
    setIfNamed("secondary-foreground", "#111827", "#f9fafb") ||
    setIfNamed("muted-foreground", "#111827", "#f9fafb") ||
    setIfNamed("accent-foreground", "#0f172a", "#eff6ff") ||
    setIfNamed("primary", "#1d4ed8", "#60a5fa") ||
    setIfNamed("primary-foreground", "#ffffff", "#020617") ||
    setIfNamed("destructive", "#b91c1c", "#ef4444") ||
    setIfNamed("destructive-foreground", "#ffffff", "#111827") ||
    setIfNamed("border", "#334155", "#cbd5e1") ||
    setIfNamed("input", "#334155", "#cbd5e1") ||
    setIfNamed("ring", "#2563eb", "#93c5fd")
  ) {
    return;
  }

  for (const [mode, value] of Object.entries(token.values)) {
    token.values[mode] = adjustColor(value, (hsl) => {
      if (/(foreground)/i.test(token.name)) return { ...hsl, l: mode === "dark" ? 96 : 10, s: Math.min(hsl.s, 12) };
      if (/(background|card|popover|muted|secondary)/i.test(token.name)) return { ...hsl, l: mode === "dark" ? 8 : 98, s: Math.min(hsl.s, 10) };
      if (/(primary|accent|ring)/i.test(token.name)) return { ...hsl, s: Math.max(hsl.s, 72), l: mode === "dark" ? 68 : 46 };
      return { ...hsl, s: hsl.s, l: mode === "dark" ? 86 : 18 };
    });
  }
}

function transformWarmValue(name: string, value: string): string {
  return adjustColor(value, (hsl) => {
    if (/(primary|accent|ring|chart)/i.test(name)) return { ...hsl, h: shiftHue(hsl.h, 22), s: clamp(hsl.s * 1.02, 0, 100), l: clamp(hsl.l + 1, 0, 100) };
    if (/(background|card|popover|muted|secondary)/i.test(name)) return { ...hsl, h: shiftHue(hsl.h, 12), s: clamp(Math.max(hsl.s, 8), 0, 100), l: clamp(hsl.l + 2, 0, 100) };
    if (/(foreground)/i.test(name)) return { ...hsl, h: shiftHue(hsl.h, 8), s: clamp(hsl.s * 0.45, 0, 100) };
    return { ...hsl };
  });
}

function transformEnterpriseValue(name: string, value: string): string {
  return adjustColor(value, (hsl) => {
    if (/(primary|accent|chart|ring)/i.test(name)) return { ...hsl, h: shiftHue(hsl.h, -8), s: clamp(hsl.s * 0.68, 0, 100), l: clamp(hsl.l - 2, 0, 100) };
    if (/(background|card|popover|muted|secondary)/i.test(name)) return { ...hsl, h: 220, s: clamp(Math.min(hsl.s, 10), 0, 100), l: clamp(hsl.l, 6, 98) };
    if (/(foreground)/i.test(name)) return { ...hsl, h: 220, s: clamp(Math.min(hsl.s, 14), 0, 100) };
    return { ...hsl };
  });
}

function transformDarkValue(name: string, value: string): string {
  return adjustColor(value, (hsl) => {
    if (/(background|card|popover|muted|secondary)/i.test(name)) return { ...hsl, s: clamp(Math.min(hsl.s, 18), 0, 100), l: clamp(10 + hsl.l * 0.08, 4, 18) };
    if (/(foreground)/i.test(name)) return { ...hsl, s: clamp(Math.min(hsl.s, 18), 0, 100), l: clamp(92 + hsl.l * 0.02, 88, 98) };
    if (/(border|input)/i.test(name)) return { ...hsl, s: clamp(Math.min(hsl.s, 18), 0, 100), l: clamp(24 + hsl.l * 0.04, 18, 36) };
    if (/(primary|accent|ring|chart)/i.test(name)) return { ...hsl, s: clamp(Math.max(hsl.s, 48), 0, 100), l: clamp(Math.max(hsl.l, 62), 0, 100) };
    return { ...hsl, l: clamp(100 - hsl.l * 0.7, 16, 92) };
  });
}

interface ParsedRgb {
  r: number;
  g: number;
  b: number;
}

interface ParsedHsl {
  h: number;
  s: number;
  l: number;
}

function parseCssColor(input: string): ParsedRgb | null {
  const value = input.trim().toLowerCase();
  if (/^#[0-9a-f]{3,8}$/i.test(value)) return parseHex(value);
  if (value.startsWith("hsl(") || value.startsWith("hsla(")) return parseHslColor(value);
  if (value.startsWith("rgb(") || value.startsWith("rgba(")) return parseRgbColor(value);
  // oklch and anything else the shared parser understands (Tailwind v4 tokens)
  return parseCssColorToRgb(value);
}

function parseHex(value: string): ParsedRgb | null {
  const hex = value.slice(1);
  if (hex.length === 3) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    };
  }
  if (hex.length >= 6) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  return null;
}

function parseRgbColor(value: string): ParsedRgb | null {
  const inner = value.slice(value.indexOf("(") + 1, value.lastIndexOf(")")).replace(/\//g, " ");
  const parts = inner.split(/[,\s]+/).filter(Boolean).slice(0, 3);
  if (parts.length !== 3) return null;
  const channels = parts.map((part) => {
    if (part.endsWith("%")) return clamp(Math.round(parseFloat(part) * 2.55), 0, 255);
    return clamp(Math.round(parseFloat(part)), 0, 255);
  });
  if (channels.some((channel) => Number.isNaN(channel))) return null;
  return { r: channels[0], g: channels[1], b: channels[2] };
}

function parseHslColor(value: string): ParsedRgb | null {
  const inner = value.slice(value.indexOf("(") + 1, value.lastIndexOf(")")).replace(/\//g, " ");
  const parts = inner.split(/[,\s]+/).filter(Boolean).slice(0, 3);
  if (parts.length !== 3) return null;
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1].replace("%", ""));
  const l = parseFloat(parts[2].replace("%", ""));
  if ([h, s, l].some((part) => Number.isNaN(part))) return null;
  return hslToRgb({ h, s, l });
}

function computeContrastRatio(foreground: ParsedRgb, background: ParsedRgb): number {
  const fg = relativeLuminance(foreground);
  const bg = relativeLuminance(background);
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(rgb: ParsedRgb): number {
  const normalize = (channel: number): number => {
    const srgb = channel / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * normalize(rgb.r) + 0.7152 * normalize(rgb.g) + 0.0722 * normalize(rgb.b);
}

function adjustColor(value: string | number, transform: (color: ParsedHsl) => ParsedHsl): string {
  const original = String(value);
  const rgb = parseCssColor(original);
  if (!rgb) return original;
  const current = rgbToHsl(rgb);
  const next = transform(current);
  return formatColorLike(original, next);
}

function rgbToHsl(rgb: ParsedRgb): ParsedHsl {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  if (delta !== 0) {
    switch (max) {
      case r: h = 60 * (((g - b) / delta) % 6); break;
      case g: h = 60 * (((b - r) / delta) + 2); break;
      case b: h = 60 * (((r - g) / delta) + 4); break;
    }
  }

  return {
    h: h < 0 ? h + 360 : h,
    s: s * 100,
    l: l * 100,
  };
}

function hslToRgb(hsl: ParsedHsl): ParsedRgb {
  const h = ((hsl.h % 360) + 360) % 360;
  const s = clamp(hsl.s, 0, 100) / 100;
  const l = clamp(hsl.l, 0, 100) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (h < 60) [rPrime, gPrime, bPrime] = [c, x, 0];
  else if (h < 120) [rPrime, gPrime, bPrime] = [x, c, 0];
  else if (h < 180) [rPrime, gPrime, bPrime] = [0, c, x];
  else if (h < 240) [rPrime, gPrime, bPrime] = [0, x, c];
  else if (h < 300) [rPrime, gPrime, bPrime] = [x, 0, c];
  else [rPrime, gPrime, bPrime] = [c, 0, x];

  return {
    r: Math.round((rPrime + m) * 255),
    g: Math.round((gPrime + m) * 255),
    b: Math.round((bPrime + m) * 255),
  };
}

function formatColorLike(original: string, hsl: ParsedHsl): string {
  const normalized: ParsedHsl = {
    h: ((hsl.h % 360) + 360) % 360,
    s: clamp(hsl.s, 0, 100),
    l: clamp(hsl.l, 0, 100),
  };
  if (original.trim().startsWith("#")) {
    const rgb = hslToRgb(normalized);
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
  }
  return `hsl(${trimNumber(normalized.h)} ${trimNumber(normalized.s)}% ${trimNumber(normalized.l)}%)`;
}

function toHex(channel: number): string {
  return Math.round(channel).toString(16).padStart(2, "0");
}

function shiftHue(hue: number, delta: number): number {
  return ((hue + delta) % 360 + 360) % 360;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function trimNumber(value: number): string {
  return Number(value.toFixed(1)).toString();
}

function labelForRecipe(recipe: ThemeVariantRecipe): string {
  switch (recipe) {
    case "dark": return "Dark";
    case "warm": return "Warm";
    case "enterprise": return "Enterprise";
    case "high-contrast": return "High Contrast";
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
