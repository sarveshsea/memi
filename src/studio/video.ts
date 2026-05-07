import { accessSync, constants, existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { delimiter, join, resolve } from "node:path";
import type {
  StudioEvent,
  StudioEventType,
  StudioVideoAdapterId,
  StudioVideoManifest,
} from "./types.js";

export interface VideoResolverOptions {
  resolveCommand?: (command: string) => string | null;
  resolvePackage?: (pkg: string) => string | null;
}

export interface StudioVideoProjectResult extends StudioVideoManifest {
  projectDir: string;
  events: StudioEvent[];
}

export interface StudioVideoAdapterStatus {
  remotion: { available: boolean; command: string | null; message: string };
  hyperframes: { available: boolean; command: string | null; message: string };
}

export interface StudioVideoOperationResult {
  id: string;
  adapter: StudioVideoAdapterId;
  status: "ready" | "missing-adapter";
  command: string[];
  message: string;
  events: StudioEvent[];
  outputPath?: string | null;
}

const require = createRequire(import.meta.url);

export async function createVideoProject(
  projectRoot: string,
  input: { title: string; prompt?: string; adapter?: StudioVideoAdapterId },
): Promise<StudioVideoProjectResult> {
  const title = input.title.trim();
  if (!title) throw new Error("Video title is required");
  const id = slugify(title);
  const adapter = input.adapter ?? "remotion";
  const projectDir = videoProjectDir(projectRoot, id);
  const createdAt = new Date().toISOString();
  const manifest: StudioVideoManifest = {
    schemaVersion: 1,
    id,
    title,
    prompt: input.prompt?.trim() || title,
    adapter,
    status: "created",
    createdAt,
    updatedAt: createdAt,
    files: adapter === "remotion"
      ? ["video.json", "README.md", "package.json", "remotion.config.ts", "src/index.ts", "src/Root.tsx", "src/Storyboard.tsx"]
      : ["video.json", "README.md", "index.html", "hyperframes.json"],
  };

  await mkdir(projectDir, { recursive: true });
  if (adapter === "remotion") await mkdir(join(projectDir, "src"), { recursive: true });
  await writeFile(join(projectDir, "video.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
  await writeFile(join(projectDir, "README.md"), readmeFor(manifest), "utf-8");
  if (adapter === "remotion") {
    await writeFile(join(projectDir, "package.json"), remotionPackageFor(manifest), "utf-8");
    await writeFile(join(projectDir, "remotion.config.ts"), remotionConfigFor(), "utf-8");
    await writeFile(join(projectDir, "src", "index.ts"), remotionIndexFor(), "utf-8");
    await writeFile(join(projectDir, "src", "Root.tsx"), remotionRootFor(manifest), "utf-8");
    await writeFile(join(projectDir, "src", "Storyboard.tsx"), storyboardFor(manifest), "utf-8");
  } else {
    await writeFile(join(projectDir, "index.html"), hyperframesHtmlFor(manifest), "utf-8");
    await writeFile(join(projectDir, "hyperframes.json"), hyperframesConfigFor(manifest), "utf-8");
  }

  return {
    ...manifest,
    projectDir,
    events: [videoEvent(id, "video_project_created", `Created ${adapter} video project ${id}`, manifest)],
  };
}

export function getVideoAdapterStatus(options: VideoResolverOptions = {}): StudioVideoAdapterStatus {
  const resolveCommand = options.resolveCommand ?? resolveCommandFromPath;
  const resolvePackage = options.resolvePackage ?? resolvePackageDefault;
  const npx = resolveCommand("npx");
  const remotion = resolveCommand("remotion") ?? (npx ? `${npx} remotion` : resolvePackage("@remotion/cli"));
  const hyperframes = resolveCommand("hyperframes") ?? (npx ? `${npx} hyperframes` : null) ?? resolvePackage("hyperframes") ?? resolvePackage("@hyperframes/core");

  return {
    remotion: {
      available: Boolean(remotion),
      command: remotion,
      message: remotion ? "Remotion available" : "Install @remotion/cli or use npx remotion",
    },
    hyperframes: {
      available: Boolean(hyperframes),
      command: hyperframes,
      message: hyperframes ? "Hyperframes available" : "Install hyperframes or @hyperframes/core",
    },
  };
}

export async function previewVideoProject(
  projectRoot: string,
  id: string,
  options: VideoResolverOptions = {},
): Promise<StudioVideoOperationResult> {
  const manifest = await readVideoManifest(projectRoot, id);
  const status = getVideoAdapterStatus(options)[manifest.adapter];
  if (!status.available) return missingAdapterResult(manifest, "preview");
  const command = manifest.adapter === "remotion"
    ? ["npx", "remotion", "studio", join(videoProjectDir(projectRoot, id), "src", "index.ts")]
    : ["npx", "hyperframes", "preview", videoProjectDir(projectRoot, id)];
  return {
    id,
    adapter: manifest.adapter,
    status: "ready",
    command,
    message: `Preview ${manifest.title}`,
    events: [videoEvent(id, "video_render_started", `Preview ready for ${id}`, { command })],
  };
}

export async function renderVideoProject(
  projectRoot: string,
  id: string,
  options: VideoResolverOptions = {},
): Promise<StudioVideoOperationResult> {
  const manifest = await readVideoManifest(projectRoot, id);
  const status = getVideoAdapterStatus(options)[manifest.adapter];
  if (!status.available) return missingAdapterResult(manifest, "render");
  const command = manifest.adapter === "remotion"
    ? ["npx", "remotion", "render", join(videoProjectDir(projectRoot, id), "src", "index.ts"), "MemoireVideo", videoOutputPath(projectRoot, id, manifest)]
    : ["npx", "hyperframes", "render", videoProjectDir(projectRoot, id), "--output", videoOutputPath(projectRoot, id, manifest)];
  return {
    id,
    adapter: manifest.adapter,
    status: "ready",
    command,
    outputPath: videoOutputPath(projectRoot, id, manifest),
    message: `Render command ready for ${manifest.title}`,
    events: [
      videoEvent(id, "video_render_started", `Render ready for ${id}`, { command }),
      videoEvent(id, "video_render_completed", `Render command prepared for ${id}`, { command }),
    ],
  };
}

export async function listVideoProjects(projectRoot: string): Promise<StudioVideoManifest[]> {
  const root = join(resolve(projectRoot), ".memoire", "videos");
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const manifests: StudioVideoManifest[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifest = await readVideoManifest(projectRoot, entry.name).catch(() => null);
      if (manifest) manifests.push(manifest);
    }
    return manifests.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  } catch {
    return [];
  }
}

export async function videoDownloadArtifact(projectRoot: string, id: string): Promise<{ path: string; mimeType: string; bytes: Buffer }> {
  const manifest = await readVideoManifest(projectRoot, id);
  const output = videoOutputPath(projectRoot, id, manifest);
  const outputStat = await stat(output).catch(() => null);
  const path = outputStat?.isFile() ? output : join(videoProjectDir(projectRoot, id), "video.json");
  return {
    path,
    mimeType: path.endsWith(".mp4") ? "video/mp4" : "application/json; charset=utf-8",
    bytes: await readFile(path),
  };
}

async function readVideoManifest(projectRoot: string, id: string): Promise<StudioVideoManifest> {
  return JSON.parse(await readFile(join(videoProjectDir(projectRoot, id), "video.json"), "utf-8")) as StudioVideoManifest;
}

function missingAdapterResult(manifest: StudioVideoManifest, operation: "preview" | "render"): StudioVideoOperationResult {
  const install = manifest.adapter === "remotion" ? "Install remotion or use npx remotion" : "Install hyperframes or @hyperframes/core";
  return {
    id: manifest.id,
    adapter: manifest.adapter,
    status: "missing-adapter",
    command: [],
    message: `${install} to ${operation} ${manifest.title}.`,
    events: [videoEvent(manifest.id, "video_render_failed", `${manifest.adapter} adapter missing`, { operation })],
  };
}

function videoProjectDir(projectRoot: string, id: string): string {
  return join(resolve(projectRoot), ".memoire", "videos", id);
}

function videoEvent(sessionId: string, type: StudioEventType, message: string, data?: unknown): StudioEvent {
  return {
    id: `${type}-${Date.now().toString(36)}`,
    sessionId: `video:${sessionId}`,
    type,
    timestamp: new Date().toISOString(),
    message,
    data,
  };
}

function readmeFor(manifest: StudioVideoManifest): string {
  const preview = manifest.adapter === "remotion"
    ? "npx remotion studio src/index.ts"
    : "npx hyperframes preview .";
  const render = manifest.adapter === "remotion"
    ? "npx remotion render src/index.ts MemoireVideo dist/video.mp4"
    : "npx hyperframes render . --output dist/video.mp4";
  return [
    `# ${manifest.title}`,
    "",
    manifest.prompt,
    "",
    `Adapter: ${manifest.adapter}`,
    "",
    "## Preview",
    "",
    `\`${preview}\``,
    "",
    "## Render",
    "",
    `\`${render}\``,
    "",
  ].join("\n");
}

function remotionPackageFor(manifest: StudioVideoManifest): string {
  return `${JSON.stringify({
    type: "module",
    scripts: {
      studio: "remotion studio src/index.ts",
      render: "remotion render src/index.ts MemoireVideo dist/video.mp4",
    },
    dependencies: {
      "@remotion/cli": "^4.0.0",
      "remotion": "^4.0.0",
      "react": "^18.3.1",
      "react-dom": "^18.3.1",
    },
    devDependencies: {
      typescript: "^5.6.0",
    },
    memoire: {
      videoId: manifest.id,
      adapter: manifest.adapter,
    },
  }, null, 2)}\n`;
}

function remotionConfigFor(): string {
  return [
    "import { Config } from '@remotion/cli/config';",
    "",
    "Config.setVideoImageFormat('jpeg');",
    "Config.setOverwriteOutput(true);",
    "",
  ].join("\n");
}

function remotionIndexFor(): string {
  return [
    "import { registerRoot } from 'remotion';",
    "import { RemotionRoot } from './Root';",
    "",
    "registerRoot(RemotionRoot);",
    "",
  ].join("\n");
}

function remotionRootFor(manifest: StudioVideoManifest): string {
  return [
    "import React from 'react';",
    "import { AbsoluteFill, Composition, interpolate, useCurrentFrame } from 'remotion';",
    "",
    "function MemoireVideo() {",
    "  const frame = useCurrentFrame();",
    "  const opacity = interpolate(frame, [0, 24, 150], [0, 1, 1], { extrapolateRight: 'clamp' });",
    "  return (",
    "    <AbsoluteFill style={{ background: '#0f1115', color: 'white', fontFamily: 'Inter, system-ui, sans-serif', justifyContent: 'center', padding: 80 }}>",
    `      <h1 style={{ fontSize: 72, lineHeight: 1, opacity }}>${escapeJsx(manifest.title)}</h1>`,
    `      <p style={{ fontSize: 28, maxWidth: 920, opacity }}>${escapeJsx(manifest.prompt)}</p>`,
    "    </AbsoluteFill>",
    "  );",
    "}",
    "",
    "export function RemotionRoot() {",
    "  return <Composition id=\"MemoireVideo\" component={MemoireVideo} durationInFrames={240} fps={30} width={1920} height={1080} />;",
    "}",
    "",
  ].join("\n");
}

function storyboardFor(manifest: StudioVideoManifest): string {
  return [
    "export const storyboard = {",
    `  title: ${JSON.stringify(manifest.title)},`,
    `  prompt: ${JSON.stringify(manifest.prompt)},`,
    `  adapter: ${JSON.stringify(manifest.adapter)},`,
    "  scenes: [",
    "    { id: 'open', label: 'Problem', duration: 90 },",
    "    { id: 'system', label: 'System', duration: 120 },",
    "    { id: 'handoff', label: 'Handoff', duration: 90 },",
    "  ],",
    "};",
    "",
  ].join("\n");
}

function hyperframesHtmlFor(manifest: StudioVideoManifest): string {
  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "  <meta charset=\"utf-8\" />",
    "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    `  <title>${escapeHtml(manifest.title)}</title>`,
    "  <style>",
    "    body { margin: 0; width: 100vw; height: 100vh; display: grid; place-items: center; background: #101418; color: white; font-family: Inter, system-ui, sans-serif; }",
    "    main { width: min(86vw, 1100px); }",
    "    h1 { font-size: 78px; line-height: 0.94; margin: 0 0 24px; }",
    "    p { font-size: 30px; line-height: 1.3; color: #d9e1e8; }",
    "  </style>",
    "</head>",
    "<body>",
    "  <main>",
    `    <h1>${escapeHtml(manifest.title)}</h1>`,
    `    <p>${escapeHtml(manifest.prompt)}</p>`,
    "  </main>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

function hyperframesConfigFor(manifest: StudioVideoManifest): string {
  return `${JSON.stringify({
    id: manifest.id,
    entry: "index.html",
    output: `dist/${manifest.id}.mp4`,
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 8,
  }, null, 2)}\n`;
}

function videoOutputPath(projectRoot: string, id: string, manifest: StudioVideoManifest): string {
  return join(videoProjectDir(projectRoot, id), "dist", `${manifest.id}.mp4`);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeJsx(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$").replace(/[{}]/g, "");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "video";
}

function resolvePackageDefault(pkg: string): string | null {
  try {
    return require.resolve(`${pkg}/package.json`);
  } catch {
    return null;
  }
}

function resolveCommandFromPath(command: string): string | null {
  const entries = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  for (const entry of entries) {
    const candidate = join(entry, command);
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Continue.
    }
  }
  return existsSync(command) ? command : null;
}
