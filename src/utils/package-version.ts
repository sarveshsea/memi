import { readFileSync } from "node:fs";
import { packagePath } from "./asset-path.js";

export function getMemoirePackageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(packagePath("package.json"), "utf-8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}
