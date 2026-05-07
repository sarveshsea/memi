import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { captureStudioAttachment, getStudioAttachment } from "../attachment-store.js";

describe("studio attachment store", () => {
  it("captures pasted text material and pasted image files with durable metadata", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-attachments-"));
    try {
      await mkdir(root, { recursive: true });
      const text = await captureStudioAttachment(root, {
        kind: "text",
        name: "research-material.txt",
        mimeType: "text/plain",
        source: "paste",
        text: "Long pasted research material for the next agent run.",
      });
      const image = await captureStudioAttachment(root, {
        sessionId: "studio-session-1",
        kind: "image",
        name: "screen.png",
        mimeType: "image/png",
        source: "paste",
        dataUrl: `data:image/png;base64,${Buffer.from("png-bytes").toString("base64")}`,
      });

      expect(text.path).toContain(join(".memoire", "studio", "attachments", "draft"));
      expect(await readFile(text.path ?? "", "utf-8")).toContain("Long pasted research material");
      expect(image.path).toContain(join(".memoire", "studio", "attachments", "studio-session-1"));
      expect(await readFile(image.path ?? "")).toEqual(Buffer.from("png-bytes"));
      expect(await getStudioAttachment(root, image.id)).toMatchObject({
        id: image.id,
        kind: "image",
        name: "screen.png",
        source: "paste",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
