import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultStudioConfig } from "../config.js";
import { StudioComputerAdapter } from "../computer-adapter.js";

describe("studio computer adapter", () => {
  it("writes a real screenshot artifact through an injected macOS command runner", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-computer-"));
    try {
      const adapter = new StudioComputerAdapter({
        projectRoot: root,
        platform: "darwin",
        execFile: async (_file, args) => {
          const path = args.at(-1);
          if (typeof path !== "string") throw new Error("expected screenshot path");
          await mkdir(join(path, ".."), { recursive: true });
          await writeFile(path, "png");
        },
      });
      const config = {
        ...defaultStudioConfig(root),
        computer: {
          ...defaultStudioConfig(root).computer,
          enabled: true,
          requireApproval: false,
        },
      };

      await expect(adapter.action({ action: "captureScreen" }, config)).resolves.toMatchObject({
        status: "completed",
        action: "captureScreen",
        executed: true,
        artifactPath: expect.stringMatching(/screen.*\.png$/),
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
