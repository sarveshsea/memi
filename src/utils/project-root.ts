import { isAbsolute, resolve } from "path";

/**
 * Resolve the CLI project root without touching getcwd when the Studio shell
 * has already provided an absolute workspace. This keeps the packaged Bun
 * sidecar away from flaky external-volume cwd resolution during app launch.
 */
export function resolveCliProjectRoot(env: NodeJS.ProcessEnv = process.env): string {
  const studioProjectRoot = env.MEMOIRE_STUDIO_PROJECT_ROOT?.trim();
  if (studioProjectRoot) {
    return isAbsolute(studioProjectRoot) ? studioProjectRoot : resolve(process.cwd(), studioProjectRoot);
  }
  return process.cwd();
}
