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

describe("release binary workflow", () => {
  it("keeps platform optional packages available and defers the npm audit gate", async () => {
    const workflow = await readFile(
      join(process.cwd(), ".github", "workflows", "release-binaries.yml"),
      "utf-8",
    );

    expect(workflow).toContain("npm ci --include=optional --ignore-scripts");
    expect(workflow).toContain("SKIP_AUDIT_GATE: \"1\"");
  });
});
