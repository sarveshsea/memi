import { readFile } from "fs/promises";
import { join } from "path";
import { describe, expect, it } from "vitest";

describe("runtime release workflow", () => {
  it("names runtime resources from the runtime tag instead of the npm package version", async () => {
    const workflow = await readFile(
      join(process.cwd(), ".github", "workflows", "runtime-release.yml"),
      "utf-8",
    );

    expect(workflow).toContain('VERSION="${TAG#runtime-v}"');
    expect(workflow).not.toContain('VERSION=$(node -p "require(\\\'./package.json\\\').version")');
    expect(workflow).not.toContain('VERSION=$(node -p "require(\'./package.json\').version")');
  });
});
