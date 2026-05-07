import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { StudioAttachment, StudioAttachmentCaptureRequest } from "./types.js";

export async function captureStudioAttachment(projectRoot: string, input: StudioAttachmentCaptureRequest): Promise<StudioAttachment> {
  const id = `attachment-${randomUUID()}`;
  const sessionId = input.sessionId?.trim() || null;
  const dir = join(attachmentsDir(projectRoot), sessionId ?? "draft");
  await mkdir(dir, { recursive: true });

  const name = sanitizeFileName(input.name || `${input.kind}.txt`);
  const target = join(dir, `${id}-${name}`);
  const payload = attachmentPayload(input);
  await writeFile(target, payload);

  const attachment: StudioAttachment = {
    id,
    sessionId,
    kind: input.kind,
    name,
    mimeType: input.mimeType || "application/octet-stream",
    source: input.source,
    path: target,
    text: input.kind === "text" ? payload.toString("utf-8") : undefined,
    previewUrl: input.kind === "image" ? `/api/attachments/${encodeURIComponent(id)}?raw=1` : undefined,
    size: payload.byteLength,
    createdAt: new Date().toISOString(),
  };
  await writeAttachmentIndex(projectRoot, [...await listAttachmentIndex(projectRoot), attachment]);
  return attachment;
}

export async function getStudioAttachment(projectRoot: string, id: string): Promise<StudioAttachment | null> {
  return (await listAttachmentIndex(projectRoot)).find((attachment) => attachment.id === id) ?? null;
}

function attachmentsDir(projectRoot: string): string {
  return join(projectRoot, ".memoire", "studio", "attachments");
}

function attachmentIndexPath(projectRoot: string): string {
  return join(attachmentsDir(projectRoot), "index.json");
}

async function listAttachmentIndex(projectRoot: string): Promise<StudioAttachment[]> {
  try {
    return JSON.parse(await readFile(attachmentIndexPath(projectRoot), "utf-8")) as StudioAttachment[];
  } catch {
    return [];
  }
}

async function writeAttachmentIndex(projectRoot: string, attachments: StudioAttachment[]): Promise<void> {
  await mkdir(attachmentsDir(projectRoot), { recursive: true });
  await writeFile(attachmentIndexPath(projectRoot), `${JSON.stringify(attachments, null, 2)}\n`, "utf-8");
}

function attachmentPayload(input: StudioAttachmentCaptureRequest): Buffer {
  if (input.kind === "text") return Buffer.from(input.text ?? "", "utf-8");
  if (input.dataUrl) return Buffer.from(input.dataUrl.replace(/^data:[^,]+,/, ""), "base64");
  return Buffer.from(input.text ?? "", "utf-8");
}

function sanitizeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "attachment";
}
