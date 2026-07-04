/**
 * Layout Critic — scores already-generated page output against qualitative
 * design criteria (hierarchy, spacing rhythm, consistency, tenet risk),
 * grounded in memi's own UX_TRAPS taxonomy.
 *
 * This is genuine judgment — an LLM reading generated JSX and reasoning
 * about it — categorically different from auditGeneratedFiles' regex
 * rule-checker. It is advisory only: nothing it returns blocks a write.
 * Returns null (never throws) when no AI key is configured or the call
 * fails, so callers can treat null as "no critique available".
 */

import { z } from "zod";
import { getAI, hasAI } from "../ai/index.js";
import { UX_TRAPS, type UxTrapId } from "../ux/tenets-traps.js";
import type { PageSpec } from "../specs/types.js";
import type { CodegenContext } from "./generator.js";

const TRAP_IDS = UX_TRAPS.map((t) => t.id) as [UxTrapId, ...UxTrapId[]];

export const LayoutCritiqueSchema = z.object({
  score: z.number().min(0).max(100),
  hierarchy: z.object({
    verdict: z.enum(["strong", "adequate", "weak"]),
    notes: z.string(),
  }),
  spacingRhythm: z.object({
    verdict: z.enum(["consistent", "uneven"]),
    notes: z.string(),
  }),
  consistency: z.object({
    verdict: z.enum(["consistent", "inconsistent"]),
    notes: z.string(),
  }),
  tenetRisks: z.array(z.object({
    trapId: z.enum(TRAP_IDS),
    note: z.string(),
  })),
  summary: z.string(),
});

export type LayoutCritique = z.infer<typeof LayoutCritiqueSchema>;

/**
 * Critique already-generated page content. Never throws — returns null when
 * no AI key is present, when MEMOIRE_DISABLE_LAYOUT_AI=1, or when the AI
 * call/validation fails, since critique is advisory and a missing critique
 * must be indistinguishable from "no AI key" to the caller.
 */
export async function critiquePage(
  pageContent: string,
  spec: PageSpec,
  ctx: CodegenContext,
): Promise<LayoutCritique | null> {
  if (!hasAI() || process.env.MEMOIRE_DISABLE_LAYOUT_AI === "1") return null;
  const client = getAI();
  if (!client) return null;

  try {
    const { system, prompt } = buildCriticPrompt(pageContent, spec, ctx);
    return await client.completeJSON({
      system,
      messages: [{ role: "user", content: prompt }],
      model: "fast",
      schema: LayoutCritiqueSchema,
    });
  } catch {
    return null;
  }
}

function buildCriticPrompt(pageContent: string, spec: PageSpec, ctx: CodegenContext): { system: string; prompt: string } {
  const traps = UX_TRAPS.map((t) => `- ${t.id}: ${t.name} — ${t.description}`).join("\n");

  const system = `You are a design critic reviewing already-generated shadcn/Tailwind page code. Score it honestly against real criteria — do not default to high scores. Ground tenetRisks entries in this exact trap taxonomy (use the id field verbatim, never invent a new category):

${traps}

Return ONLY a JSON object matching the required schema. Be specific in "notes" fields — cite what you actually see in the code (section order, spacing classes, repeated patterns), not generic design advice.`;

  const truncated = pageContent.length > 6000 ? pageContent.slice(0, 6000) + "\n/* ... truncated ... */" : pageContent;

  const prompt = `Page purpose: ${spec.purpose}
Design system has ${ctx.designSystem?.tokens?.length ?? 0} tokens defined.

Generated page code:
\`\`\`tsx
${truncated}
\`\`\`

Critique hierarchy, spacing rhythm, and consistency. Flag any tenet risks using the trap taxonomy above.`;

  return { system, prompt };
}
