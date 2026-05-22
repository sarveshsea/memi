import { readFile } from "node:fs/promises";
import { relative } from "node:path";

export interface LicenseBoundaryViolation {
  path: string;
  marker: string;
}

export interface LicenseBoundaryResult {
  ok: boolean;
  violations: LicenseBoundaryViolation[];
}

export interface LicenseBoundaryOptions {
  packageFiles: string[];
}

const FORK_SOURCE_MARKERS = [
  ["camel", "-oasis"].join(""),
  ["camel", "_oasis"].join(""),
  ["generate", "_twitter", "_agent", "_graph"].join(""),
  ["generate", "_reddit", "_agent", "_graph"].join(""),
  ["Miro", "Fish", " Team"].join(""),
  ["ZepGraph", "Memory", "Updater"].join(""),
  ["Oasis", "Profile", "Generator"].join(""),
  ["run", "_parallel", "_simulation", ".py"].join(""),
];

const REFERENCE_ONLY_EXTENSIONS = /\.(md|mdx|txt)$/i;

export async function scanForkSourceLicenseBoundary(root: string, options: LicenseBoundaryOptions): Promise<LicenseBoundaryResult> {
  const violations: LicenseBoundaryViolation[] = [];
  for (const packageFile of options.packageFiles) {
    if (REFERENCE_ONLY_EXTENSIONS.test(packageFile)) continue;
    const path = `${root.replace(/\/+$/, "")}/${packageFile}`;
    let content = "";
    try {
      content = await readFile(path, "utf-8");
    } catch {
      continue;
    }
    for (const marker of FORK_SOURCE_MARKERS) {
      if (content.includes(marker)) {
        violations.push({ path: relative(root, path), marker });
      }
    }
  }
  return { ok: violations.length === 0, violations };
}
