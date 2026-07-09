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
    expect(workflow).toContain("esbuildPackage: darwin-x64");
    expect(workflow).toContain("esbuildPackage: win32-x64");
    expect(workflow).toContain("ESBUILD_VERSION=\"$(node -p \"require('./node_modules/vite/node_modules/esbuild/package.json').version\")\"");
    expect(workflow).toContain('npm install --no-save --package-lock=false --ignore-scripts "@esbuild/${{ matrix.esbuildPackage }}@${ESBUILD_VERSION}"');
    expect(workflow).toContain("SKIP_AUDIT_GATE: \"1\"");
  });
});
