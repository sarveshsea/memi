import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { normalizeDesignSystemArtifactFromEvents } from "../design-system-artifacts.js";
import {
  captureDesignSystemArtifact,
  getDesignSystemArtifact,
  listDesignSystemArtifacts,
  updateDesignSystemArtifactSectionReview,
} from "../design-system-artifact-store.js";
import type { StudioEvent, StudioSession } from "../types.js";

describe("design system artifacts", () => {
  it("normalizes a Buzzr pull into reviewable design-system sections", () => {
    const artifact = normalizeDesignSystemArtifactFromEvents({
      session: makeSession("studio-buzzr-pull"),
      events: [
        makeEvent("studio-buzzr-pull", "artifact", BUZZR_PULL),
        makeEvent("studio-buzzr-pull", "design_decision", "P1: Token governance needs one owner across [palette.ts](/Users/sarveshchidambaram/Desktop/Projects/Buzzr/Buzzr/src/theme/palette.ts:30)."),
        makeEvent("studio-buzzr-pull", "acceptance_statement", "Buzzr design system pull completed read-only."),
      ],
    });

    expect(artifact).toMatchObject({
      title: "Buzzr Design System Pull",
      createdByHarness: "codex",
      sourceSessionId: "studio-buzzr-pull",
      status: "review",
    });
    expect(artifact.sections.map((section) => section.kind)).toEqual([
      "brand",
      "type",
      "colors",
      "spacing",
      "components",
      "screens",
      "accessibility",
      "drift",
      "handoff",
    ]);
    expect(artifact.sections.find((section) => section.kind === "brand")).toMatchObject({
      title: "Brand",
      reviewState: "unreviewed",
    });
    expect(artifact.sourceRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "BEE_BRANDING_ROADMAP.md",
        sourcePath: "/Users/sarveshchidambaram/Desktop/Projects/Buzzr/Buzzr/docs/BEE_BRANDING_ROADMAP.md",
        line: 9,
      }),
      expect.objectContaining({
        label: "Button.tsx",
        sourcePath: "/Users/sarveshchidambaram/Desktop/Projects/Buzzr/Buzzr/components/ui/Button.tsx",
        line: 88,
      }),
      expect.objectContaining({
        label: "tabs layout",
        sourcePath: "/Users/sarveshchidambaram/Desktop/Projects/Buzzr/Buzzr/app/(protected)/(tabs)/_layout.tsx",
        line: 245,
      }),
    ]));
    expect(artifact.sections.find((section) => section.kind === "colors")?.preview).toEqual(expect.objectContaining({
      kind: "tokens",
    }));
    expect(artifact.sections.find((section) => section.kind === "handoff")?.content).toContain("completed read-only");
    expect(artifact.rawContent).toContain("Buzzr Design System Pull");
  });

  it("attaches an agentic design-system contract for harness-readable UI roles", () => {
    const artifact = normalizeDesignSystemArtifactFromEvents({
      session: makeSession("studio-agentic-contract"),
      events: [makeEvent("studio-agentic-contract", "artifact", BUZZR_PULL)],
    });
    const agentic = (artifact as any).agentic;

    expect(agentic).toMatchObject({
      contractVersion: 1,
      source: {
        name: "Agentic UI",
        url: "https://agenticui.net/",
      },
    });
    expect(agentic.roles.map((role: any) => role.id)).toEqual(expect.arrayContaining([
      "message_composer",
      "tool_trace",
      "artifact_review",
      "memory_context",
      "harness_status",
    ]));
    expect(agentic.roles.find((role: any) => role.id === "artifact_review")).toMatchObject({
      atomicLevel: "organism",
      requiredSignals: expect.arrayContaining(["review_state", "source_refs"]),
    });
    expect(agentic.outputSections).toEqual(expect.arrayContaining([
      "research_note",
      "design_decision",
      "tool_call",
      "artifact",
      "acceptance_statement",
      "session_result",
    ]));
    expect(agentic.agentRules).toEqual(expect.arrayContaining([
      expect.stringContaining("Every visible control needs a command id"),
      expect.stringContaining("Every generated artifact needs source refs"),
    ]));
    expect(agentic.openSourceReferences).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: "GAIA UI",
        url: "https://github.com/theexperiencecompany/gaia-ui",
        license: "MIT",
        mappedRoles: expect.arrayContaining(["message_composer", "artifact_review"]),
      }),
      expect.objectContaining({
        name: "tool-ui",
        license: "MIT",
        mappedRoles: expect.arrayContaining(["tool_trace"]),
      }),
      expect.objectContaining({
        name: "Magentic-UI",
        license: "MIT",
        mappedRoles: expect.arrayContaining(["permission_control", "memory_context"]),
      }),
    ]));
    expect(agentic.openSourceReferences.every((reference: any) => reference.license === "MIT")).toBe(true);
    expect(agentic.openSourceReferences.every((reference: any) => reference.mappedRoles.length > 0)).toBe(true);
    expect(agentic.interactionPatterns).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "composer_agent_state",
        source: "assistant-ui",
        appliesTo: expect.arrayContaining(["message_composer", "permission_control"]),
      }),
      expect.objectContaining({
        id: "auditable_tool_trace_cards",
        source: "tool-ui",
        appliesTo: expect.arrayContaining(["tool_trace"]),
      }),
      expect.objectContaining({
        id: "human_review_checkpoint",
        source: "Magentic-UI",
        appliesTo: expect.arrayContaining(["artifact_review", "permission_control"]),
      }),
    ]));
  });

  it("persists captured artifacts and updates one section review without rewriting the rest", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-artifacts-"));
    try {
      const captured = await captureDesignSystemArtifact(root, {
        session: makeSession("studio-buzzr-pull"),
        events: [makeEvent("studio-buzzr-pull", "artifact", BUZZR_PULL)],
      });
      const before = await getDesignSystemArtifact(root, captured.id);
      const brandBefore = before?.sections.find((section) => section.kind === "brand");
      const colorsBefore = before?.sections.find((section) => section.kind === "colors");

      const updated = await updateDesignSystemArtifactSectionReview(root, captured.id, brandBefore?.id ?? "missing", {
        reviewState: "needs_work",
        comment: "Logo assets need the three approved lockups.",
      });

      expect(await listDesignSystemArtifacts(root)).toHaveLength(1);
      expect(updated.sections.find((section) => section.id === brandBefore?.id)).toMatchObject({
        reviewState: "needs_work",
        comments: ["Logo assets need the three approved lockups."],
      });
      expect(updated.sections.find((section) => section.id === colorsBefore?.id)).toEqual(colorsBefore);
      expect((await getDesignSystemArtifact(root, captured.id))?.sections.find((section) => section.id === brandBefore?.id)).toMatchObject({
        reviewState: "needs_work",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("resolves real workspace assets and design tokens for artifact previews", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-artifact-resolver-"));
    const workspace = join(root, "Buzzr");
    try {
      await mkdir(join(workspace, "assets", "branding"), { recursive: true });
      await mkdir(join(workspace, "src", "theme"), { recursive: true });
      await writeFile(join(workspace, "assets", "branding", "buzzr-logo-transparent.png"), Buffer.from("logo"));
      await writeFile(join(workspace, "src", "theme", "palette.ts"), "export const accent = '#00e676';\nexport const surface = '#0a0a0c';\n");
      await writeFile(join(workspace, "src", "theme", "typography.ts"), "export const heading = { fontFamily: 'Montserrat_800ExtraBold', fontSize: 32, fontWeight: '800' };\n");
      const captured = await captureDesignSystemArtifact(root, {
        session: { ...makeSession("studio-buzzr-resolved"), cwd: workspace },
        events: [makeEvent("studio-buzzr-resolved", "artifact", `Buzzr Design System Pull:
- Brand: Use real Buzzr lockups from [branding](${join(workspace, "assets", "branding", "buzzr-logo-transparent.png")}).
- Colors: Emerald accent and dark surfaces from [palette.ts](${join(workspace, "src", "theme", "palette.ts")}:1).
- Type: Montserrat heading ramp from [typography.ts](${join(workspace, "src", "theme", "typography.ts")}:1).`)],
      });

      expect(captured.assets).toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: "brand",
          label: "buzzr-logo-transparent.png",
          sourcePath: join(workspace, "assets", "branding", "buzzr-logo-transparent.png"),
        }),
      ]));
      expect(captured.tokens).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: "color", value: "#00e676", sourcePath: join(workspace, "src", "theme", "palette.ts") }),
        expect.objectContaining({ kind: "typography", value: expect.stringContaining("Montserrat_800ExtraBold") }),
      ]));
      expect(captured.resolvedAt).toEqual(expect.any(String));
      expect(captured.resolverDiagnostics).toEqual(expect.arrayContaining([expect.stringContaining("Resolved")]));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

const BUZZR_PULL = `Buzzr Design System Pull:
- Brand: Identity and tone: dark, sports-social, with emerald buzz/pollen energy. [BEE_BRANDING_ROADMAP.md](/Users/sarveshchidambaram/Desktop/Projects/Buzzr/Buzzr/docs/BEE_BRANDING_ROADMAP.md:9)
- Type: Montserrat headings and body scale in [Typography.ts](/Users/sarveshchidambaram/Desktop/Projects/Buzzr/Buzzr/src/theme/Typography.ts:15).
- Colors: Warm near-black surfaces, emerald accent #00e676, muted sports status colors in [palette.ts](/Users/sarveshchidambaram/Desktop/Projects/Buzzr/Buzzr/src/theme/palette.ts:30).
- Spacing: 1-36px spacing scale, rounded cards, motion durations in [Spacing.ts](/Users/sarveshchidambaram/Desktop/Projects/Buzzr/Buzzr/src/theme/Spacing.ts:8).
- Components: Buttons, cards, badges, sheets, avatars, chat rows, widgets. [Button.tsx](/Users/sarveshchidambaram/Desktop/Projects/Buzzr/Buzzr/components/ui/Button.tsx:88)
- Screens: Home, Dashboard, Games, Swipe, Chat, Profile, Settings. [IA_SITEMAP.md](/Users/sarveshchidambaram/Desktop/Projects/Buzzr/Buzzr/docs/IA_SITEMAP.md:20), [tabs layout](/Users/sarveshchidambaram/Desktop/Projects/Buzzr/Buzzr/app/(protected)/(tabs)/_layout.tsx:245)
- Accessibility: Touch targets, high contrast, reduce motion, haptics.
- Drift: Token governance is real but fragmented; centralize exception inventory.
- Handoff: Create a token exception inventory and route each component to atom, molecule, organism, template, or page.`;

function makeSession(id: string): StudioSession {
  return {
    id,
    harness: "codex",
    action: "audit",
    mode: "delegate",
    chatMode: "review",
    permissionMode: "plan",
    cwd: "/Users/sarveshchidambaram/Desktop/Projects/Buzzr/Buzzr",
    prompt: "Pull Buzzr design system",
    status: "completed",
    startedAt: "2026-05-06T00:00:00.000Z",
    completedAt: "2026-05-06T00:00:20.000Z",
    exitCode: 0,
    activeStreamId: null,
    pendingPrompt: null,
    events: [],
  };
}

function makeEvent(sessionId: string, type: StudioEvent["type"], message: string): StudioEvent {
  return {
    id: `${type}-${message.slice(0, 18).toLowerCase().replace(/\W+/g, "-")}`,
    sessionId,
    type,
    timestamp: "2026-05-06T00:00:01.000Z",
    message,
  };
}
