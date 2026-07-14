import type { AtomicLevel, ComponentSpec, PageSpec } from "../specs/types.js";
import { inferAtomicLevel } from "../utils/naming.js";

export const AGENT_FILE_SCAFFOLD_KINDS = ["component", "page"] as const;
export type AgentFileScaffoldKind = typeof AGENT_FILE_SCAFFOLD_KINDS[number];

export type AgentFileScaffoldStatus = "planned" | "approved" | "written";

export interface AgentFileScaffoldSection {
  name: string;
  component: string;
  layout?: "full-width" | "half" | "third" | "quarter" | "grid-2" | "grid-3" | "grid-4" | "stack" | "inline";
}

export interface AgentFileScaffoldOptions {
  projectRoot: string;
  kind: AgentFileScaffoldKind;
  name: string;
  purpose?: string;
  intent?: string;
  level?: AtomicLevel;
  layout?: PageSpec["layout"];
  shadcnBase?: string[];
  composesSpecs?: string[];
  sections?: AgentFileScaffoldSection[];
  dryRun?: boolean;
  approved?: boolean;
}

export interface AgentFileScaffoldPlan {
  action: "scaffold_agent_design_files";
  schemaVersion: 1;
  status: AgentFileScaffoldStatus;
  projectRoot: string;
  dryRun: boolean;
  approved: boolean;
  kind: AgentFileScaffoldKind;
  name: string;
  atomicLevel: AtomicLevel | "page";
  intent: string;
  specPath: string;
  generationCommand: string;
  writeCommand: string;
  nextCommands: string[];
  guardrails: string[];
  spec: ComponentSpec | PageSpec;
}

const VALID_SPEC_NAME = /^[A-Za-z][A-Za-z0-9_-]*$/;

export function buildAgentFileScaffoldPlan(options: AgentFileScaffoldOptions): AgentFileScaffoldPlan {
  const name = normalizeSpecName(options.name);
  const dryRun = options.dryRun ?? true;
  const approved = options.approved ?? false;
  const intent = options.intent?.trim() || "Create spec-first files from local design evidence.";
  const status: AgentFileScaffoldStatus = dryRun || !approved ? "planned" : "approved";
  const now = new Date().toISOString();

  if (options.kind === "component") {
    const level = options.level ?? inferAtomicLevel(name);
    const composesSpecs = sanitizeList(options.composesSpecs);
    if (level === "atom" && composesSpecs.length > 0) {
      throw new Error("Atoms cannot compose other specs. Use molecule, organism, or template for composed scaffolds.");
    }

    const spec: ComponentSpec = {
      name,
      type: "component",
      level,
      purpose: options.purpose?.trim() || `${name} component scaffolded from agent design CI evidence.`,
      researchBacking: [],
      designTokens: { source: "manual", mapped: false },
      variants: ["default"],
      props: {},
      shadcnBase: sanitizeList(options.shadcnBase, ["Card"]),
      composesSpecs,
      codeConnect: { props: {}, mapped: false },
      accessibility: {
        ariaLabel: "optional",
        keyboardNav: true,
        focusStyle: "ring",
        focusWidth: "2px",
        touchTarget: "min-24",
        reducedMotion: true,
        liveRegion: "off",
        colorIndependent: true,
      },
      dataviz: null,
      tags: ["agent-design-ci", "spec-first"],
      createdAt: now,
      updatedAt: now,
    };

    return buildPlan({
      options,
      name,
      dryRun,
      approved,
      status,
      intent,
      atomicLevel: level,
      specPath: `specs/components/${name}.json`,
      spec,
    });
  }

  const purpose = options.purpose?.trim() || `${name} page scaffolded from agent design CI evidence.`;
  const spec: PageSpec = {
    name,
    type: "page",
    purpose,
    researchBacking: [],
    layout: options.layout ?? "dashboard",
    sections: (options.sections ?? []).map((section) => ({
      name: normalizeSectionName(section.name),
      component: normalizeSpecName(section.component),
      repeat: 1,
      layout: section.layout ?? "full-width",
      props: {},
    })),
    shadcnLayout: ["Card", "Separator"],
    responsive: { mobile: "stack", tablet: "grid-2", desktop: "grid-4" },
    accessibility: {
      language: "en",
      landmarks: true,
      skipLink: true,
      headingHierarchy: true,
      consistentNav: true,
      consistentHelp: true,
      pageTitle: name,
    },
    meta: {
      title: name,
      description: purpose,
    },
    tags: ["agent-design-ci", "spec-first"],
    layoutLocked: false,
    createdAt: now,
    updatedAt: now,
  };

  return buildPlan({
    options,
    name,
    dryRun,
    approved,
    status,
    intent,
    atomicLevel: "page",
    specPath: `specs/pages/${name}.json`,
    spec,
  });
}

export function markAgentFileScaffoldWritten(plan: AgentFileScaffoldPlan): AgentFileScaffoldPlan {
  return {
    ...plan,
    status: "written",
    dryRun: false,
    approved: true,
  };
}

export function parseAgentFileScaffoldSection(value: string): AgentFileScaffoldSection {
  const [name, component, layout] = value.split(":").map((part) => part.trim()).filter(Boolean);
  if (!name || !component) {
    throw new Error(`Invalid section "${value}". Use Name:Component[:layout].`);
  }
  return {
    name,
    component,
    ...(layout ? { layout: layout as AgentFileScaffoldSection["layout"] } : {}),
  };
}

function buildPlan(input: {
  options: AgentFileScaffoldOptions;
  name: string;
  dryRun: boolean;
  approved: boolean;
  status: AgentFileScaffoldStatus;
  intent: string;
  atomicLevel: AtomicLevel | "page";
  specPath: string;
  spec: ComponentSpec | PageSpec;
}): AgentFileScaffoldPlan {
  return {
    action: "scaffold_agent_design_files",
    schemaVersion: 1,
    status: input.status,
    projectRoot: input.options.projectRoot,
    dryRun: input.dryRun,
    approved: input.approved,
    kind: input.options.kind,
    name: input.name,
    atomicLevel: input.atomicLevel,
    intent: input.intent,
    specPath: input.specPath,
    generationCommand: `memi generate ${input.name} --preview --json`,
    writeCommand: `memi scaffold ${input.options.kind} ${input.name} --write --json`,
    nextCommands: [
      `memi generate ${input.name} --preview --json`,
      `memi generate ${input.name}`,
      "memi ci --json",
    ],
    guardrails: [
      "Atomic Design level is explicit before files are written.",
      "shadcn/ui base components are declared in the spec instead of inferred later.",
      "Tailwind tokens and CSS variables are preferred; avoid raw one-off colors.",
      "The dry-run JSON plan is inspectable before any registry write.",
      "Generation still runs through the existing quality gate before code files are emitted.",
    ],
    spec: input.spec,
  };
}

function normalizeSpecName(name: string): string {
  const trimmed = name.trim();
  if (!VALID_SPEC_NAME.test(trimmed)) {
    throw new Error(`Invalid spec name "${name}". Use letters, numbers, hyphens, or underscores and start with a letter.`);
  }
  if (trimmed.length > 128) {
    throw new Error(`Spec name "${name}" is too long. Use 128 characters or fewer.`);
  }
  return trimmed;
}

function normalizeSectionName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Section name cannot be empty.");
  return trimmed;
}

function sanitizeList(values: string[] | undefined, fallback: string[] = []): string[] {
  const clean = (values ?? fallback).map((value) => value.trim()).filter(Boolean);
  return Array.from(new Set(clean));
}
