import { MEMOIRE_PACKAGE_NAME, MEMOIRE_PACKAGE_URL, MEMOIRE_PACKAGE_VERSION } from "./package-info.js";

export type StudioReferenceTraceKind =
  | "package"
  | "spec"
  | "knowledge"
  | "figma"
  | "file"
  | "artifact"
  | "model";

export interface StudioReferenceTraceItem {
  id: string;
  kind: StudioReferenceTraceKind;
  label: string;
  summary: string;
  sourcePath?: string;
  packageName?: string;
  packageVersion?: string;
  url?: string;
  eventIds: string[];
}

interface StudioAgentContextLike {
  memory: {
    recent: Array<{
      kind: string;
      title: string;
      summary: string;
      sourcePath?: string;
    }>;
  };
  figma: {
    enabled: boolean;
    status: string;
    clients: number;
    port: number | null;
  };
  knowledge?: {
    recent: Array<{
      kind: string;
      title: string;
      summary: string;
      sourcePath: string;
    }>;
  };
}

const KIND_ORDER: Record<StudioReferenceTraceItem["kind"], number> = {
  package: 0,
  spec: 1,
  knowledge: 2,
  figma: 3,
  file: 4,
  artifact: 5,
  model: 6,
};

export function buildSessionReferenceTrace(context: StudioAgentContextLike): StudioReferenceTraceItem[] {
  const references: StudioReferenceTraceItem[] = [
    {
      id: `package:${MEMOIRE_PACKAGE_NAME}`,
      kind: "package",
      label: `${MEMOIRE_PACKAGE_NAME}@${MEMOIRE_PACKAGE_VERSION}`,
      summary: "The npm package that supplied this Studio harness, prompt envelope, and local runtime.",
      packageName: MEMOIRE_PACKAGE_NAME,
      packageVersion: MEMOIRE_PACKAGE_VERSION,
      url: MEMOIRE_PACKAGE_URL,
      eventIds: [],
    },
  ];

  for (const item of context.memory.recent) {
    references.push({
      id: `${item.kind}:${item.sourcePath ?? item.title}`,
      kind: item.kind === "spec" ? "spec" : "file",
      label: `${item.kind}: ${item.title}`,
      summary: item.summary,
      sourcePath: item.sourcePath,
      eventIds: [],
    });
  }

  for (const item of context.knowledge?.recent ?? []) {
    references.push({
      id: `knowledge:${item.sourcePath}`,
      kind: "knowledge",
      label: `${item.kind}: ${item.title}`,
      summary: item.summary,
      sourcePath: item.sourcePath,
      eventIds: [],
    });
  }

  references.push({
    id: "figma:bridge",
    kind: "figma",
    label: "Figma bridge",
    summary: context.figma.enabled
      ? `${context.figma.status} with ${context.figma.clients} client${context.figma.clients === 1 ? "" : "s"}${context.figma.port ? ` on port ${context.figma.port}` : ""}.`
      : "Figma bridge disabled for this run.",
    eventIds: [],
  });

  return mergeReferenceTraceItems(references);
}

export function deriveReferenceTraceFromEvents(events: ReferenceTraceEventLike[]): StudioReferenceTraceItem[] {
  const references: StudioReferenceTraceItem[] = [];

  for (const event of events) {
    if (event.type === "reference_trace") {
      for (const item of referencesFromPayload(event.data)) {
        references.push({ ...item, eventIds: [...new Set([...item.eventIds, event.id])] });
      }
      continue;
    }

    const payloadReference = referenceFromEventPayload(event);
    if (payloadReference) references.push(payloadReference);
  }

  return mergeReferenceTraceItems(references);
}

function referencesFromPayload(data: unknown): StudioReferenceTraceItem[] {
  if (!isRecord(data) || !Array.isArray(data.references)) return [];
  return data.references.flatMap((item) => normalizeReferenceItem(item));
}

function normalizeReferenceItem(value: unknown): StudioReferenceTraceItem[] {
  if (!isRecord(value)) return [];
  const kind = typeof value.kind === "string" && value.kind in KIND_ORDER
    ? value.kind as StudioReferenceTraceItem["kind"]
    : "file";
  const label = typeof value.label === "string" && value.label.trim() ? value.label.trim() : null;
  const sourcePath = typeof value.sourcePath === "string" && value.sourcePath.trim() ? value.sourcePath.trim() : undefined;
  const packageName = typeof value.packageName === "string" && value.packageName.trim() ? value.packageName.trim() : undefined;
  if (!label && !sourcePath && !packageName) return [];
  return [{
    id: typeof value.id === "string" && value.id.trim()
      ? value.id.trim()
      : `${kind}:${sourcePath ?? packageName ?? label}`,
    kind,
    label: label ?? sourcePath ?? packageName ?? "Reference",
    summary: typeof value.summary === "string" ? value.summary : "",
    sourcePath,
    packageName,
    packageVersion: typeof value.packageVersion === "string" ? value.packageVersion : undefined,
    url: typeof value.url === "string" ? value.url : undefined,
    eventIds: Array.isArray(value.eventIds) ? value.eventIds.filter((id): id is string => typeof id === "string") : [],
  }];
}

function referenceFromEventPayload(event: ReferenceTraceEventLike): StudioReferenceTraceItem | null {
  if (event.type !== "artifact" && event.type !== "file_change" && event.type !== "tool_call") return null;
  const sourcePath = sourcePathFromData(event.data) ?? sourcePathFromMessage(event.message);
  if (!sourcePath && event.type === "tool_call") return null;
  return {
    id: `${event.type}:${sourcePath ?? event.id}`,
    kind: event.type === "artifact" ? "artifact" : "file",
    label: sourcePath ?? event.message,
    summary: event.message,
    sourcePath: sourcePath ?? undefined,
    eventIds: [event.id],
  };
}

function sourcePathFromData(data: unknown): string | null {
  if (!isRecord(data)) return null;
  for (const key of ["sourcePath", "path", "file", "filePath", "artifactPath"]) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function sourcePathFromMessage(message: string): string | null {
  const match = message.match(/(?:^|\s)((?:\.?[\w-]+\/)+[\w.-]+\.(?:mdx?|ya?ml|json|tsx?|css|html))/i);
  return match?.[1] ?? null;
}

function mergeReferenceTraceItems(items: StudioReferenceTraceItem[]): StudioReferenceTraceItem[] {
  const merged = new Map<string, StudioReferenceTraceItem>();
  for (const item of items) {
    const key = item.id || `${item.kind}:${item.sourcePath ?? item.packageName ?? item.url ?? item.label}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...item, eventIds: [...new Set(item.eventIds)] });
      continue;
    }
    merged.set(key, {
      ...existing,
      summary: existing.summary || item.summary,
      sourcePath: existing.sourcePath ?? item.sourcePath,
      packageName: existing.packageName ?? item.packageName,
      packageVersion: existing.packageVersion ?? item.packageVersion,
      url: existing.url ?? item.url,
      eventIds: [...new Set([...existing.eventIds, ...item.eventIds])],
    });
  }
  return [...merged.values()].sort((a, b) => {
    const orderDelta = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    return orderDelta || a.label.localeCompare(b.label);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

interface ReferenceTraceEventLike {
  id: string;
  type: string;
  message: string;
  data?: unknown;
}
