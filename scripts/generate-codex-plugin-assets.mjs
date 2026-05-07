#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas } from "@napi-rs/canvas";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "plugins", "memoire", "assets");

await mkdir(outDir, { recursive: true });

await writePng("authentic-logo.png", drawLogo({ size: 256, background: true }));
await writePng("screenshot-plugin-overview.png", drawScreenshot({
  title: "Memoire Codex plugin",
  subtitle: "Design memory and UI quality tools inside Codex.",
  command: "Use Memoire before broad frontend edits",
  bullets: [
    "Skill context for Tailwind, shadcn/ui, Figma, and Atomic Design",
    "MCP server wiring for memi mcp start --no-figma",
    "Project evidence from diagnose, tokens, specs, and registries",
  ],
}));

function drawLogo({ size, background }) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  if (background) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, size, size);
  } else {
    ctx.clearRect(0, 0, size, size);
  }
  const scale = size / 512;
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(256, 256);
  const gradient = ctx.createLinearGradient(-132, -176, 132, 176);
  gradient.addColorStop(0, background ? "#ffffff" : "#111111");
  gradient.addColorStop(0.58, background ? "#f6f6f2" : "#2f2f2c");
  gradient.addColorStop(1, background ? "#c9c9c4" : "#5b5b56");
  ctx.fillStyle = gradient;
  for (let i = 0; i < 4; i += 1) {
    ctx.save();
    ctx.rotate((Math.PI / 2) * i);
    petal(ctx);
    ctx.restore();
  }
  ctx.globalCompositeOperation = "destination-out";
  centerCut(ctx);
  for (let i = 0; i < 4; i += 1) {
    ctx.save();
    ctx.rotate((Math.PI / 2) * i);
    veinCut(ctx);
    ctx.restore();
  }
  ctx.restore();
  return canvas;
}

function petal(ctx) {
  ctx.beginPath();
  ctx.moveTo(0, -36);
  ctx.bezierCurveTo(-20, -62, -60, -80, -75, -117);
  ctx.bezierCurveTo(-89, -152, -72, -184, -39, -189);
  ctx.bezierCurveTo(-19, -192, -6, -181, 0, -168);
  ctx.bezierCurveTo(6, -181, 19, -192, 39, -189);
  ctx.bezierCurveTo(72, -184, 89, -152, 75, -117);
  ctx.bezierCurveTo(60, -80, 20, -62, 0, -36);
  ctx.closePath();
  ctx.fill();
}

function centerCut(ctx) {
  ctx.beginPath();
  ctx.moveTo(0, -52);
  ctx.bezierCurveTo(8, -24, 24, -8, 52, 0);
  ctx.bezierCurveTo(24, 8, 8, 24, 0, 52);
  ctx.bezierCurveTo(-8, 24, -24, 8, -52, 0);
  ctx.bezierCurveTo(-24, -8, -8, -24, 0, -52);
  ctx.closePath();
  ctx.fill();
}

function veinCut(ctx) {
  ctx.beginPath();
  ctx.moveTo(0, -130);
  ctx.bezierCurveTo(-13, -102, -12, -68, 0, -36);
  ctx.bezierCurveTo(12, -68, 13, -102, 0, -130);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -111, 15, 0, Math.PI * 2);
  ctx.fill();
}

function drawScreenshot({ title, subtitle, command, bullets }) {
  const width = 200;
  const height = 125;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0f0f10";
  ctx.fillRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#191919");
  bg.addColorStop(0.54, "#2b2b2d");
  bg.addColorStop(1, "#111112");
  roundRect(ctx, 10, 10, width - 20, height - 20, 9, bg);

  ctx.strokeStyle = "#3a3a3d";
  ctx.lineWidth = 2;
  strokeRoundRect(ctx, 10, 10, width - 20, height - 20, 9);

  const logo = drawLogo({ size: 18, background: true });
  ctx.drawImage(logo, 16, 18);

  ctx.fillStyle = "#f7f7f3";
  ctx.font = "700 9px Arial, sans-serif";
  ctx.fillText(title, 42, 25);
  ctx.fillStyle = "#b9b9b4";
  ctx.font = "400 5px Arial, sans-serif";
  wrapText(ctx, subtitle, 42, 36, 136, 7);

  roundRect(ctx, 16, 49, 168, 22, 5, "#050505");
  ctx.strokeStyle = "#4a4a4d";
  ctx.lineWidth = 1;
  strokeRoundRect(ctx, 16, 49, 168, 22, 5);
  ctx.fillStyle = "#f6f6f2";
  ctx.font = command.length > 80 ? "500 4px Menlo, monospace" : "500 6px Menlo, monospace";
  wrapText(ctx, command, 22, 58, 156, 6);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 6px Arial, sans-serif";
  ctx.fillText("What Codex gets", 20, 84);

  ctx.font = "400 4px Arial, sans-serif";
  ctx.fillStyle = "#deded9";
  bullets.forEach((bullet, index) => {
    const y = 95 + index * 8;
    ctx.fillStyle = "#f6f6f2";
    ctx.beginPath();
    ctx.arc(23, y - 1.5, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#deded9";
    ctx.fillText(bullet, 29, y);
  });

  ctx.fillStyle = "#a7a7a2";
  ctx.font = "500 4px Arial, sans-serif";
  ctx.fillText("memoire.cv/codex-plugin", 20, 116);
  return canvas;
}

function roundRect(ctx, x, y, width, height, radius, fillStyle) {
  pathRoundRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

function strokeRoundRect(ctx, x, y, width, height, radius) {
  pathRoundRect(ctx, x, y, width, height, radius);
  ctx.stroke();
}

function pathRoundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}

async function writePng(name, canvas) {
  const outputPath = join(outDir, name);
  await writeFile(outputPath, canvas.toBuffer("image/png", { compressionLevel: 9 }));
  const optimized = spawnSync("magick", [
    outputPath,
    "-strip",
    "-colors",
    "32",
    "-define",
    "png:compression-level=9",
    "-define",
    "png:compression-filter=5",
    "-define",
    "png:compression-strategy=1",
    outputPath,
  ], { stdio: "ignore" });
  if (optimized.error && optimized.error.code !== "ENOENT") {
    throw optimized.error;
  }
}
