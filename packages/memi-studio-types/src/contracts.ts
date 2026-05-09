/**
 * Re-exports from src/studio/contracts/*. Kept thin so the engine and
 * memi-studio see byte-identical types.
 *
 * NOTE: this file imports from a relative path into the engine's source
 * tree during local development. The publish pipeline (scripts/
 * publish-types.mjs, added in a follow-up commit) copies the engine's
 * contracts/* into ./src/_engine/ before `npm pack` so the published
 * tarball is self-contained.
 */

// During local development, point at the engine sources directly.
// The publish pipeline rewrites these to "./_engine/..." in the
// staged tarball.
export * from "../../../src/studio/contracts/ids.js";
export * from "../../../src/studio/contracts/errors.js";
export * from "../../../src/studio/contracts/provider-runtime.js";
