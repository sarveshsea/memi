/**
 * Layout Composer — chooses a PageSpec's layout template and each section's
 * arrangement/order using design judgment grounded in memi's own UX tenets
 * and traps, instead of requiring the spec author to hardcode them.
 *
 * This does NOT invent arbitrary novel React/JSX. Output stays deterministic
 * shadcn/Tailwind assembled by page-generator.ts's existing LAYOUT_TEMPLATES
 * and layoutToGridClass() lookup tables — composition only picks WHICH of
 * those already-safe options to use, and in what order. When no AI key is
 * present, or the spec sets layoutLocked, this falls back to a deterministic
 * keyword heuristic (or is skipped entirely) — never a hard dependency.
 */

import { z } from "zod";
import { getAI, hasAI } from "../ai/index.js";
import { UX_TENETS, UX_TRAPS } from "../ux/tenets-traps.js";
import type { PageSpec } from "../specs/types.js";
import type { CodegenContext } from "./generator.js";

const PAGE_LAYOUTS = ["sidebar-main", "full-width", "centered", "split", "dashboard", "marketing"] as const;
const SECTION_LAYOUTS = ["full-width", "half", "third", "quarter", "grid-2", "grid-3", "grid-4", "stack", "inline"] as const;

export interface LayoutComposition {
  layout: PageSpec["layout"];
  sectionOrder: string[];
  sectionLayouts: Record<string, PageSpec["sections"][number]["layout"]>;
  rationale: string;
  source: "ai" | "heuristic";
}

const LayoutCompositionSchema = z.object({
  layout: z.enum(PAGE_LAYOUTS),
  sectionOrder: z.array(z.string()),
  sectionLayouts: z.record(z.enum(SECTION_LAYOUTS)),
  rationale: z.string(),
});

/**
 * Compose a layout for the given page spec. Respects spec.layoutLocked
 * (skips entirely, returns the spec's own values verbatim) and
 * MEMOIRE_DISABLE_LAYOUT_AI (forces the heuristic path so CI/batch
 * `generate --all` jobs can opt out of the added LLM round-trip).
 */
export async function composeLayout(spec: PageSpec, ctx: CodegenContext): Promise<LayoutComposition> {
  if (spec.layoutLocked) {
    return {
      layout: spec.layout,
      sectionOrder: spec.sections.map((s) => s.name),
      sectionLayouts: Object.fromEntries(spec.sections.map((s) => [s.name, s.layout])),
      rationale: "layoutLocked is set — using the spec's authored layout verbatim.",
      source: "heuristic",
    };
  }

  if (!hasAI() || process.env.MEMOIRE_DISABLE_LAYOUT_AI === "1") {
    return heuristicComposeLayout(spec);
  }

  const client = getAI();
  if (!client) return heuristicComposeLayout(spec);

  try {
    const { system, prompt } = buildComposerPrompt(spec, ctx);
    const result = await client.completeJSON({
      system,
      messages: [{ role: "user", content: prompt }],
      model: "fast",
      schema: LayoutCompositionSchema,
    });
    const validNames = new Set(spec.sections.map((s) => s.name));
    const orderIsValidPermutation =
      result.sectionOrder.length === spec.sections.length &&
      result.sectionOrder.every((name) => validNames.has(name)) &&
      new Set(result.sectionOrder).size === result.sectionOrder.length;

    return {
      layout: result.layout,
      sectionOrder: orderIsValidPermutation ? result.sectionOrder : spec.sections.map((s) => s.name),
      sectionLayouts: result.sectionLayouts,
      rationale: result.rationale,
      source: "ai",
    };
  } catch {
    return heuristicComposeLayout(spec);
  }
}

/**
 * Pure, deterministic, zero-I/O fallback. Maps purpose/section-name keywords
 * onto the same enums PageSpecSchema already defines, so its output always
 * validates against the existing schema with no new failure modes. Never
 * reorders sections (no reliable signal to reorder by without AI judgment) —
 * only fills in layout choices.
 */
export function heuristicComposeLayout(spec: PageSpec): LayoutComposition {
  const haystack = `${spec.purpose} ${spec.sections.map((s) => s.name).join(" ")}`.toLowerCase();

  let layout: PageSpec["layout"] = spec.layout;
  const matchers: [RegExp, PageSpec["layout"]][] = [
    [/dashboard|analytics|metrics?|kpi|admin\s*panel/, "dashboard"],
    [/settings|account|profile|nav(igation)?\b/, "sidebar-main"],
    [/login|sign[\s-]?in|sign[\s-]?up|auth|onboarding/, "centered"],
    [/landing|marketing|hero|pricing/, "marketing"],
    [/compare|before.*after|side.by.side|two.column/, "split"],
  ];
  for (const [pattern, candidate] of matchers) {
    if (pattern.test(haystack)) {
      layout = candidate;
      break;
    }
  }

  const sectionLayouts: Record<string, PageSpec["sections"][number]["layout"]> = {};
  for (const section of spec.sections) {
    if (section.repeat >= 4) sectionLayouts[section.name] = "grid-4";
    else if (section.repeat === 3) sectionLayouts[section.name] = "grid-3";
    else if (section.repeat === 2) sectionLayouts[section.name] = "half";
    else if (/chart|table|detail|list/.test(section.name.toLowerCase())) sectionLayouts[section.name] = "full-width";
    else sectionLayouts[section.name] = section.layout;
  }

  return {
    layout,
    sectionOrder: spec.sections.map((s) => s.name),
    sectionLayouts,
    rationale: `Heuristic match: layout="${layout}" from purpose/section-name keywords; section layouts derived from repeat counts and name patterns.`,
    source: "heuristic",
  };
}

function buildComposerPrompt(spec: PageSpec, ctx: CodegenContext): { system: string; prompt: string } {
  const tenets = UX_TENETS.map((t) => `- ${t.name}: ${t.description}`).join("\n");
  const traps = UX_TRAPS.map((t) => `- ${t.name}: ${t.description} (avoid by: ${t.defaultFix})`).join("\n");

  const system = `You are a layout composer for a design-system code generator. You choose WHICH of a fixed set of already-safe layout templates and grid arrangements to use for a page — you do not write any JSX or invent new layout primitives.

Page layout options (choose exactly one): ${PAGE_LAYOUTS.join(", ")}
Section layout options (choose one per section): ${SECTION_LAYOUTS.join(", ")}

Ground your choice in these UX tenets (protect them):
${tenets}

And avoid these traps:
${traps}

Return ONLY a JSON object matching: { layout: <one of the page layout options>, sectionOrder: [<section names in your chosen order>], sectionLayouts: { <section name>: <one of the section layout options> }, rationale: <one sentence> }`;

  const sectionList = spec.sections
    .map((s) => `- ${s.name} (component: ${s.component}, repeat: ${s.repeat}, props keys: ${Object.keys(s.props).join(", ") || "none"})`)
    .join("\n");

  const prompt = `Page purpose: ${spec.purpose}

Sections (name, component, repeat count, prop keys only — you decide arrangement and order):
${sectionList}

Design system has ${ctx.designSystem?.tokens?.length ?? 0} tokens defined.

Choose the page layout, the order to render these sections in, and each section's grid/flex arrangement.`;

  return { system, prompt };
}

/**
 * Apply a composition to a spec, producing a new PageSpec with layout/section
 * arrangement filled in. Only overwrites fields that still equal their Zod
 * schema default ("full-width" for both spec.layout and section.layout) —
 * this is a heuristic proxy for "the author never set this explicitly", not
 * a true one (a spec author who deliberately chose full-width is indistinguishable
 * from one who left it at the default), and is the documented tradeoff that
 * keeps this feature safe-by-default rather than silently overriding authored
 * intent in the common case where a field truly was set on purpose.
 */
export function applyComposition(spec: PageSpec, composition: LayoutComposition): PageSpec {
  const layout = spec.layout === "full-width" ? composition.layout : spec.layout;

  const orderedNames = composition.sectionOrder.length === spec.sections.length
    ? composition.sectionOrder
    : spec.sections.map((s) => s.name);
  const byName = new Map(spec.sections.map((s) => [s.name, s]));

  const sections = orderedNames
    .map((name) => byName.get(name))
    .filter((s): s is PageSpec["sections"][number] => Boolean(s))
    .map((section) => ({
      ...section,
      layout: section.layout === "full-width" && composition.sectionLayouts[section.name]
        ? composition.sectionLayouts[section.name]
        : section.layout,
    }));

  return { ...spec, layout, sections };
}
