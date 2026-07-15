import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const manifest = JSON.parse(
  readFileSync(join(root, "mcpb", "manifest.json"), "utf8"),
) as {
  server: {
    entry_point: string;
    mcp_config: {
      command: string;
      args: string[];
    };
  };
};

describe("MCPB distribution bundle", () => {
  it("ships the executable entry point referenced by the manifest", () => {
    expect(manifest.server.entry_point).toBe("server/index.cjs");
    expect(existsSync(join(root, "mcpb", manifest.server.entry_point))).toBe(true);
    expect(manifest.server.mcp_config).toEqual({
      command: "node",
      args: ["${__dirname}/server/index.cjs"],
      env: {},
    });
  });

  it("pins the published CLI version in the bundled launcher", () => {
    const launcher = readFileSync(
      join(root, "mcpb", manifest.server.entry_point),
      "utf8",
    );

    expect(launcher).toContain("@memi-design/cli@2.5.0");
    expect(launcher).toContain('"mcp", "start", "--no-figma"');
  });
});
