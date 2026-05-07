import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  designSystemArtifactFileName,
  normalizeDesignSystemArtifactFromEvents,
} from "./design-system-artifacts.js";
import { resolveDesignSystemArtifactEvidence } from "./design-system-resolver.js";
import type {
  StudioDesignSystemArtifact,
  StudioDesignSystemArtifactCaptureRequest,
  StudioDesignSystemArtifactReviewPatch,
} from "./types.js";

export function artifactsStoreDir(projectRoot: string): string {
  return join(projectRoot, ".memoire", "studio", "artifacts");
}

export async function listDesignSystemArtifacts(projectRoot: string): Promise<StudioDesignSystemArtifact[]> {
  const dir = artifactsStoreDir(projectRoot);
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const artifacts = await Promise.all(entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => ensureResolved(projectRoot, JSON.parse(await readFile(join(dir, entry.name), "utf-8")) as StudioDesignSystemArtifact)));
    return artifacts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
}

export async function getDesignSystemArtifact(projectRoot: string, id: string): Promise<StudioDesignSystemArtifact | null> {
  try {
    return ensureResolved(projectRoot, JSON.parse(await readFile(artifactFilePath(projectRoot, id), "utf-8")) as StudioDesignSystemArtifact);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function captureDesignSystemArtifact(
  projectRoot: string,
  input: StudioDesignSystemArtifactCaptureRequest,
): Promise<StudioDesignSystemArtifact> {
  const artifact = await resolveDesignSystemArtifactEvidence(projectRoot, input.artifact ?? normalizeDesignSystemArtifactFromEvents({
    session: input.session,
    events: input.events ?? (input.event ? [input.event] : []),
  }));
  await writeDesignSystemArtifact(projectRoot, artifact);
  return artifact;
}

async function ensureResolved(projectRoot: string, artifact: StudioDesignSystemArtifact): Promise<StudioDesignSystemArtifact> {
  if (artifact.resolvedAt) return artifact;
  const resolved = await resolveDesignSystemArtifactEvidence(projectRoot, artifact);
  await writeDesignSystemArtifact(projectRoot, resolved);
  return resolved;
}

export async function updateDesignSystemArtifactSectionReview(
  projectRoot: string,
  artifactId: string,
  sectionId: string,
  patch: StudioDesignSystemArtifactReviewPatch,
): Promise<StudioDesignSystemArtifact> {
  const artifact = await getDesignSystemArtifact(projectRoot, artifactId);
  if (!artifact) throw Object.assign(new Error(`Unknown design-system artifact: ${artifactId}`), { statusCode: 404 });
  let matched = false;
  const updated: StudioDesignSystemArtifact = {
    ...artifact,
    updatedAt: new Date().toISOString(),
    sections: artifact.sections.map((section) => {
      if (section.id !== sectionId) return section;
      matched = true;
      const comment = patch.comment?.trim();
      return {
        ...section,
        reviewState: patch.reviewState,
        comments: comment ? [...section.comments, comment] : section.comments,
      };
    }),
  };
  if (!matched) throw Object.assign(new Error(`Unknown artifact section: ${sectionId}`), { statusCode: 404 });
  await writeDesignSystemArtifact(projectRoot, updated);
  return updated;
}

export async function writeDesignSystemArtifact(projectRoot: string, artifact: StudioDesignSystemArtifact): Promise<void> {
  const dir = artifactsStoreDir(projectRoot);
  await mkdir(dir, { recursive: true });
  const target = artifactFilePath(projectRoot, artifact.id);
  const tmp = `${target}.${Date.now()}.tmp`;
  await writeFile(tmp, `${JSON.stringify(artifact, null, 2)}\n`, "utf-8");
  await rename(tmp, target);
}

function artifactFilePath(projectRoot: string, id: string): string {
  return join(artifactsStoreDir(projectRoot), designSystemArtifactFileName(id));
}

function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
