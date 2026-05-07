import type {
  StudioDesignSystemArtifact,
  StudioDesignSystemArtifactPreview,
  StudioDesignSystemArtifactSection,
  StudioDesignSystemArtifactSectionKind,
  StudioDesignSystemArtifactSourceRef,
} from "./design-system-artifact-types.js";
import { withAgenticDesignSystemContract } from "./agentic-design-system.js";

export const DESIGN_SYSTEM_ARTIFACT_EVENT_TYPES = new Set([
  "design_system_artifact",
  "artifact",
  "design_decision",
  "research_note",
  "acceptance_statement",
  "session_result",
]);

const SECTION_ORDER: StudioDesignSystemArtifactSectionKind[] = [
  "brand",
  "type",
  "colors",
  "spacing",
  "components",
  "screens",
  "accessibility",
  "drift",
  "handoff",
];

const SECTION_TITLES: Record<StudioDesignSystemArtifactSectionKind, string> = {
  brand: "Brand",
  type: "Type",
  colors: "Colors",
  spacing: "Spacing",
  components: "Components",
  screens: "Screens",
  accessibility: "Accessibility",
  drift: "Drift",
  handoff: "Handoff",
};

export function shouldCaptureDesignSystemArtifactEvent(event: Pick<StudioEventLike, "type" | "message" | "data">): boolean {
  if (!DESIGN_SYSTEM_ARTIFACT_EVENT_TYPES.has(event.type)) return false;
  const data = asRecord(event.data);
  if (event.type === "design_system_artifact") return true;
  return /\b(design[- ]system|design system pull|tokens?|typography|spacing|components?|accessibility|handoff)\b/i.test(`${event.message} ${String(data.title ?? "")}`);
}

export function deriveDesignSystemArtifactsFromEvents(input: {
  session?: DesignSystemArtifactSessionLike | null;
  events: StudioEventLike[];
}): StudioDesignSystemArtifact[] {
  const candidateEvents = input.events.filter(shouldCaptureDesignSystemArtifactEvent);
  if (candidateEvents.length === 0) return [];
  return [normalizeDesignSystemArtifactFromEvents({ session: input.session, events: candidateEvents })];
}

export function normalizeDesignSystemArtifactFromEvents(input: {
  session?: DesignSystemArtifactSessionLike | null;
  events: StudioEventLike[];
}): StudioDesignSystemArtifact {
  const candidateEvents = input.events.filter((event) => DESIGN_SYSTEM_ARTIFACT_EVENT_TYPES.has(event.type));
  const primaryEvent = candidateEvents.find((event) => event.type === "design_system_artifact")
    ?? candidateEvents.find((event) => event.type === "artifact" && shouldCaptureDesignSystemArtifactEvent(event))
    ?? candidateEvents.find((event) => shouldCaptureDesignSystemArtifactEvent(event))
    ?? candidateEvents[0]
    ?? input.events[0];
  const sourceSessionId = input.session?.id ?? primaryEvent?.sessionId ?? input.events[0]?.sessionId ?? null;
  const createdByHarness = input.session?.harness ?? eventDataString(primaryEvent, "harness") ?? "model";
  const sourceWorkspace = input.session?.cwd ?? eventDataString(primaryEvent, "cwd") ?? null;
  const sourceEventIds = Array.from(new Set(candidateEvents.map((event) => event.id)));
  const rawContent = candidateEvents.map((event) => sectionPrefixForEvent(event)).filter(Boolean).join("\n\n").trim();
  const title = extractArtifactTitle(primaryEvent?.message ?? rawContent) ?? "Design System Review";
  const createdAt = minTimestamp(candidateEvents) ?? new Date().toISOString();
  const updatedAt = maxTimestamp(candidateEvents) ?? createdAt;
  const sectionDrafts = splitSections(rawContent);
  const sourceRefs = mergeSourceRefs(candidateEvents.flatMap((event) => extractSourceRefs(event.message, [event.id])));
  const sections = SECTION_ORDER.map((kind) => buildSection(kind, sectionDrafts.get(kind) ?? [], candidateEvents, sourceRefs));
  const id = stableArtifactId(sourceSessionId, title, rawContent);

  return withAgenticDesignSystemContract({
    schemaVersion: 1,
    id,
    title,
    status: "review",
    sourceWorkspace,
    createdByHarness,
    sourceSessionId,
    sourceEventIds,
    sourceRefs,
    sections,
    rawContent,
    createdAt,
    updatedAt,
  });
}

type StudioEventLike = {
  id: string;
  type: string;
  timestamp?: string;
  message: string;
  data?: unknown;
  sessionId?: string;
};
type DesignSystemArtifactSessionLike = {
  id?: string;
  harness?: string;
  cwd?: string;
} | null;

function buildSection(
  kind: StudioDesignSystemArtifactSectionKind,
  lines: string[],
  events: StudioEventLike[],
  artifactRefs: StudioDesignSystemArtifactSourceRef[],
): StudioDesignSystemArtifactSection {
  const content = lines.join("\n").trim() || fallbackSectionContent(kind, events);
  const eventIds = events.filter((event) => content.includes(event.message) || eventMatchesKind(event, kind)).map((event) => event.id);
  const refs = mergeSourceRefs([
    ...extractSourceRefs(content, eventIds.length ? eventIds : events.map((event) => event.id)),
    ...artifactRefs.filter((ref) => sectionMentionsRef(content, ref)),
  ]);
  return {
    id: `section:${kind}`,
    kind,
    title: SECTION_TITLES[kind],
    summary: summarize(content || SECTION_TITLES[kind]),
    content,
    reviewState: "unreviewed",
    comments: [],
    sourceRefs: refs,
    preview: previewForSection(kind, content),
    eventIds: Array.from(new Set(eventIds.length ? eventIds : events.map((event) => event.id))),
  };
}

function splitSections(rawContent: string): Map<StudioDesignSystemArtifactSectionKind, string[]> {
  const sections = new Map<StudioDesignSystemArtifactSectionKind, string[]>();
  for (const line of rawContent.split(/\r?\n/)) {
    const kind = classifyLine(line);
    if (!kind) continue;
    const cleaned = line.replace(/^\s*[-*]\s*/, "").replace(/^[A-Za-z /&-]+:\s*/, "").trim();
    if (!cleaned) continue;
    const current = sections.get(kind) ?? [];
    current.push(cleaned);
    sections.set(kind, current);
  }
  return sections;
}

function classifyLine(line: string): StudioDesignSystemArtifactSectionKind | null {
  const normalized = line.toLowerCase();
  if (/\b(brand|logo|identity|tone|honeycomb|pollen|swarm|buzz)\b/.test(normalized)) return "brand";
  if (/\b(type|typography|font|heading|body|mono|display)\b/.test(normalized)) return "type";
  if (/\b(color|palette|theme|emerald|accent|surface|contrast|status)\b/.test(normalized)) return "colors";
  if (/\b(spacing|radius|radii|shadow|glow|motion|density|scale)\b/.test(normalized)) return "spacing";
  if (/\b(component|button|card|badge|sheet|avatar|input|tab|widget|atom|molecule|organism)\b/.test(normalized)) return "components";
  if (/\b(screen|route|page|dashboard|games|swipe|chat|profile|settings|navigation)\b/.test(normalized)) return "screens";
  if (/\b(accessibility|a11y|touch target|reduce motion|haptic|screen reader|contrast)\b/.test(normalized)) return "accessibility";
  if (/\b(drift|exception|gap|debt|risk|fragmented|needs work|p1|p2)\b/.test(normalized)) return "drift";
  if (/\b(handoff|next|acceptance|files changed|completed|publish|default)\b/.test(normalized)) return "handoff";
  return null;
}

function fallbackSectionContent(kind: StudioDesignSystemArtifactSectionKind, events: StudioEventLike[]): string {
  if (kind === "handoff") {
    return events
      .filter((event) => event.type === "acceptance_statement" || event.type === "session_result")
      .map((event) => event.message)
      .join("\n")
      .trim();
  }
  if (kind === "drift") {
    return events
      .filter((event) => event.type === "design_decision")
      .map((event) => event.message)
      .join("\n")
      .trim();
  }
  return `${SECTION_TITLES[kind]} review pending.`;
}

function previewForSection(kind: StudioDesignSystemArtifactSectionKind, content: string): StudioDesignSystemArtifactPreview {
  const items = content
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((line) => {
      const [label, ...rest] = line.split(/:\s+/);
      return {
        label: label.length < 42 && rest.length ? label : summarize(line, 36),
        value: rest.join(": ") || summarize(line, 72),
      };
    });
  return {
    kind: previewKind(kind),
    items: items.length ? items : [{ label: SECTION_TITLES[kind], value: "No preview items yet." }],
  };
}

function previewKind(kind: StudioDesignSystemArtifactSectionKind): StudioDesignSystemArtifactPreview["kind"] {
  if (kind === "colors") return "tokens";
  if (kind === "type") return "typography";
  if (kind === "components") return "components";
  if (kind === "brand") return "brand";
  if (kind === "spacing") return "spacing";
  return "summary";
}

function extractSourceRefs(text: string, eventIds: string[]): StudioDesignSystemArtifactSourceRef[] {
  const refs: StudioDesignSystemArtifactSourceRef[] = [];
  for (const link of extractMarkdownLinks(text)) {
    refs.push(sourceRefFrom(link.label, link.target, eventIds));
  }
  for (const match of text.matchAll(/(?:^|\s)(\/Users\/[^\s),\]]+?\.(?:tsx?|mdx?|json|ya?ml|css|scss))(?:[:#](\d+))?/g)) {
    refs.push(sourceRefFrom(compactBaseName(match[1]), `${match[1]}${match[2] ? `:${match[2]}` : ""}`, eventIds));
  }
  return mergeSourceRefs(refs);
}

function extractMarkdownLinks(text: string): Array<{ label: string; target: string }> {
  const links: Array<{ label: string; target: string }> = [];
  let index = 0;
  while (index < text.length) {
    const labelStart = text.indexOf("[", index);
    if (labelStart < 0) break;
    const labelEnd = text.indexOf("](", labelStart);
    if (labelEnd < 0) break;
    const targetStart = labelEnd + 2;
    let depth = 0;
    for (let cursor = targetStart; cursor < text.length; cursor += 1) {
      const char = text[cursor];
      if (char === "(") depth += 1;
      if (char === ")") {
        if (depth === 0) {
          links.push({
            label: text.slice(labelStart + 1, labelEnd),
            target: text.slice(targetStart, cursor),
          });
          index = cursor + 1;
          break;
        }
        depth -= 1;
      }
      if (cursor === text.length - 1) index = text.length;
    }
  }
  return links;
}

function sourceRefFrom(label: string, target: string, eventIds: string[]): StudioDesignSystemArtifactSourceRef {
  const lineMatch = target.match(/:(\d+)$/);
  const line = lineMatch ? Number(lineMatch[1]) : undefined;
  const cleanTarget = lineMatch ? target.slice(0, -lineMatch[0].length) : target;
  const isUrl = /^https?:\/\//i.test(cleanTarget);
  const cleanLabel = compactBaseName(label.replace(/`/g, "")) || label;
  return {
    id: `source:${hash(`${cleanTarget}:${line ?? ""}`)}`,
    label: cleanLabel,
    sourcePath: isUrl ? undefined : cleanTarget,
    url: isUrl ? cleanTarget : undefined,
    line,
    eventIds,
  };
}

function mergeSourceRefs(refs: StudioDesignSystemArtifactSourceRef[]): StudioDesignSystemArtifactSourceRef[] {
  const merged = new Map<string, StudioDesignSystemArtifactSourceRef>();
  for (const ref of refs) {
    const existing = merged.get(ref.id);
    if (!existing) {
      merged.set(ref.id, { ...ref, eventIds: Array.from(new Set(ref.eventIds)) });
      continue;
    }
    existing.eventIds = Array.from(new Set([...existing.eventIds, ...ref.eventIds]));
  }
  return Array.from(merged.values());
}

function sectionMentionsRef(content: string, ref: StudioDesignSystemArtifactSourceRef): boolean {
  return Boolean(ref.sourcePath && content.includes(ref.sourcePath)) || content.includes(ref.label);
}

function eventMatchesKind(event: StudioEventLike, kind: StudioDesignSystemArtifactSectionKind): boolean {
  return classifyLine(`${event.type}: ${event.message}`) === kind;
}

function sectionPrefixForEvent(event: StudioEventLike): string {
  if (event.type === "artifact" || event.type === "design_system_artifact") return event.message;
  if (event.type === "design_decision") return `Drift: ${event.message}`;
  if (event.type === "research_note") return `Handoff: ${event.message}`;
  if (event.type === "acceptance_statement" || event.type === "session_result") return `Handoff: ${event.message}`;
  return event.message;
}

function extractArtifactTitle(text: string): string | null {
  const first = text.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  if (!first) return null;
  return first
    .replace(/^[-*#\s]+/, "")
    .replace(/^artifact\s*:\s*/i, "")
    .replace(/:$/, "")
    .trim() || null;
}

function stableArtifactId(sessionId: string | null, title: string, rawContent: string): string {
  return `design-system-${slug(sessionId ?? "session")}-${slug(title)}-${hash(rawContent).slice(0, 8)}`;
}

export function designSystemArtifactFileName(id: string): string {
  return `${slug(id)}.json`;
}

export function slugDesignSystemArtifactId(value: string): string {
  return slug(value);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 96) || "artifact";
}

function hash(value: string): string {
  let output = 5381;
  for (let index = 0; index < value.length; index += 1) {
    output = ((output << 5) + output) ^ value.charCodeAt(index);
  }
  return Math.abs(output >>> 0).toString(16).padStart(8, "0");
}

function compactBaseName(value: string): string {
  return value.replaceAll("\\", "/").split("/").filter(Boolean).at(-1) ?? value;
}

function summarize(value: string, max = 140): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1).trimEnd()}...`;
}

function minTimestamp(events: StudioEventLike[]): string | null {
  return events.map((event) => event.timestamp).filter(Boolean).sort()[0] ?? null;
}

function maxTimestamp(events: StudioEventLike[]): string | null {
  return events.map((event) => event.timestamp).filter(Boolean).sort().at(-1) ?? null;
}

function eventDataString(event: StudioEventLike | undefined, key: string): string | null {
  const value = asRecord(event?.data)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
