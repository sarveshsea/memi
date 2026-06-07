import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveCliProjectRoot } from "../project-root.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveCliProjectRoot", () => {
  it("uses an absolute Studio project root without querying process cwd", () => {
    vi.spyOn(process, "cwd").mockImplementation(() => {
      throw new Error("cwd should not be queried");
    });

    expect(resolveCliProjectRoot({
      MEMOIRE_STUDIO_PROJECT_ROOT: "/Volumes/ExtremeSSD/Projects/memi-studio",
    })).toBe("/Volumes/ExtremeSSD/Projects/memi-studio");
  });

  it("falls back to the current working directory for normal CLI runs", () => {
    vi.spyOn(process, "cwd").mockReturnValue("/tmp/memoire-cli");

    expect(resolveCliProjectRoot({})).toBe("/tmp/memoire-cli");
  });
});
