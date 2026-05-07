export type StudioDesignSystemArtifactReviewState = "unreviewed" | "looks_good" | "needs_work";
export type StudioDesignSystemArtifactSectionKind =
  | "brand"
  | "type"
  | "colors"
  | "spacing"
  | "components"
  | "screens"
  | "accessibility"
  | "drift"
  | "handoff";

export interface StudioDesignSystemArtifactSourceRef {
  id: string;
  label: string;
  sourcePath?: string;
  url?: string;
  line?: number;
  eventIds: string[];
}

export interface StudioDesignSystemArtifactPreview {
  kind: "summary" | "tokens" | "typography" | "buttons" | "brand" | "spacing" | "components";
  items: Array<{
    label: string;
    value: string;
    detail?: string;
  }>;
}

export interface StudioDesignSystemResolvedAsset {
  id: string;
  kind: "brand" | "logo" | "image" | "icon";
  label: string;
  sourcePath: string;
  previewUrl?: string;
  mimeType?: string;
  sectionId?: string;
}

export interface StudioDesignSystemResolvedToken {
  id: string;
  kind: "color" | "typography" | "spacing" | "radius" | "shadow" | "component";
  name: string;
  value: string;
  sourcePath?: string;
  line?: number;
  sectionId?: string;
}

export interface StudioDesignSystemArtifactSection {
  id: string;
  kind: StudioDesignSystemArtifactSectionKind;
  title: string;
  summary: string;
  content: string;
  reviewState: StudioDesignSystemArtifactReviewState;
  comments: string[];
  sourceRefs: StudioDesignSystemArtifactSourceRef[];
  preview: StudioDesignSystemArtifactPreview;
  eventIds: string[];
}

export type StudioAgenticDesignSystemRoleId =
  | "harness_status"
  | "message_composer"
  | "tool_trace"
  | "artifact_review"
  | "memory_context"
  | "permission_control";
export type StudioAgenticAtomicLevel = "atom" | "molecule" | "organism" | "template" | "page";
export type StudioAgenticSurface = "topbar" | "composer" | "output" | "canvas" | "drawer";

export interface StudioAgenticDesignSystemRole {
  id: StudioAgenticDesignSystemRoleId;
  label: string;
  atomicLevel: StudioAgenticAtomicLevel;
  surface: StudioAgenticSurface;
  purpose: string;
  requiredSignals: string[];
  commandIds: string[];
  fallbackState: string;
}

export interface StudioAgenticOpenSourceReference {
  name: string;
  url: string;
  license: string;
  category: string;
  mappedRoles: StudioAgenticDesignSystemRoleId[];
}

export interface StudioAgenticInteractionPattern {
  id: string;
  label: string;
  source: string;
  appliesTo: StudioAgenticDesignSystemRoleId[];
  requiredSignals: string[];
}

export interface StudioAgenticDesignSystemContract {
  contractVersion: 1;
  source: {
    name: string;
    url: string;
    figmaPreviewUrl: string;
    access: "public-preview";
    downloaded: false;
  };
  roles: StudioAgenticDesignSystemRole[];
  outputSections: string[];
  agentRules: string[];
  openSourceReferences?: StudioAgenticOpenSourceReference[];
  interactionPatterns?: StudioAgenticInteractionPattern[];
}

export interface StudioDesignSystemArtifact {
  schemaVersion: 1;
  id: string;
  title: string;
  status: "draft" | "review" | "published";
  sourceWorkspace: string | null;
  createdByHarness: string;
  sourceSessionId: string | null;
  sourceEventIds: string[];
  sourceRefs: StudioDesignSystemArtifactSourceRef[];
  sections: StudioDesignSystemArtifactSection[];
  agentic?: StudioAgenticDesignSystemContract;
  assets?: StudioDesignSystemResolvedAsset[];
  tokens?: StudioDesignSystemResolvedToken[];
  resolvedAt?: string | null;
  resolverDiagnostics?: string[];
  rawContent: string;
  createdAt: string;
  updatedAt: string;
}
