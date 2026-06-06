/**
 * Small runtime-detection helpers shared across commands.
 */

/**
 * True when running as the prebuilt standalone binary (bun build --compile),
 * where process.execPath points at the `memi` binary itself rather than node.
 * In dev / npm installs, execPath is the node binary.
 */
export function isStandaloneBinary(): boolean {
  const exec = process.execPath.toLowerCase();
  return exec.endsWith("memi") || exec.endsWith("memi.exe") || exec.includes("/memi-") || exec.includes("\\memi-");
}
