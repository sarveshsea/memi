import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { defaultStudioConfig } from "../config.js";
import {
  DESIGN_AUTOMATION_TEMPLATES,
  StudioAutomationStore,
  buildAutomationPrompt,
  buildLaunchAgentPlist,
  createAutomationFromTemplate,
  nextRunFromRRule,
} from "../automations.js";

describe("studio automations", () => {
  it("creates design-harness templates with Codex review-mode defaults", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-automations-"));
    try {
      const store = new StudioAutomationStore(root);
      const automation = await store.create(createAutomationFromTemplate({
        templateId: "design-system-audit",
        cwd: root,
        timezone: "America/Chicago",
      }));

      expect(DESIGN_AUTOMATION_TEMPLATES.map((template) => template.id)).toEqual([
        "design-system-audit",
        "figma-token-component-pull",
        "codex-app-build-review",
        "research-reference-refresh",
      ]);
      expect(automation).toMatchObject({
        schemaVersion: 1,
        kind: "cron",
        status: "ACTIVE",
        harness: "codex",
        action: "audit",
        chatMode: "review",
        permissionMode: "plan",
        mutationPolicy: "review",
        codex: {
          model: "gpt-5.5",
          reasoningEffort: "xhigh",
        },
        cwd: root,
        templateId: "design-system-audit",
      });
      expect(automation.nextRunAt).toEqual(expect.any(String));

      const persisted = JSON.parse(await readFile(join(root, ".memoire", "studio", "automations", automation.id, "automation.json"), "utf-8"));
      expect(persisted.id).toBe(automation.id);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("calculates next RRULE runs for weekly, daily, and minutely schedules", () => {
    const after = "2026-05-07T14:30:00.000Z";

    expect(nextRunFromRRule("FREQ=WEEKLY;BYDAY=FR;BYHOUR=9;BYMINUTE=0;BYSECOND=0", after)).toBe("2026-05-08T14:00:00.000Z");
    expect(nextRunFromRRule("FREQ=DAILY;BYHOUR=7;BYMINUTE=15;BYSECOND=0", after)).toBe("2026-05-08T12:15:00.000Z");
    expect(nextRunFromRRule("FREQ=MINUTELY;INTERVAL=30", after)).toBe("2026-05-07T15:00:00.000Z");
  });

  it("claims due automations once and appends run history", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-automation-due-"));
    try {
      const store = new StudioAutomationStore(root);
      const automation = await store.create({
        ...createAutomationFromTemplate({ templateId: "codex-app-build-review", cwd: root, timezone: "America/Chicago" }),
        rrule: "FREQ=MINUTELY;INTERVAL=30",
        nextRunAt: "2026-05-07T14:00:00.000Z",
      });

      const first = await store.claimDue("2026-05-07T14:30:00.000Z");
      const second = await store.claimDue("2026-05-07T14:30:00.000Z");

      expect(first.map((item) => item.id)).toEqual([automation.id]);
      expect(second).toEqual([]);

      await store.appendRun(automation.id, {
        id: "run-1",
        automationId: automation.id,
        sessionId: "studio-session",
        status: "completed",
        startedAt: "2026-05-07T14:30:00.000Z",
        completedAt: "2026-05-07T14:30:02.000Z",
        error: null,
      });

      expect(await store.listRuns(automation.id)).toEqual([
        expect.objectContaining({ id: "run-1", sessionId: "studio-session", status: "completed" }),
      ]);
      expect((await store.get(automation.id))?.lastRunAt).toBe("2026-05-07T14:30:00.000Z");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("builds scheduled Codex prompts with review-mode mutation boundaries and inherited config", () => {
    const root = "/Users/sarveshchidambaram/Desktop/Projects/Other/ark";
    const automation = createAutomationFromTemplate({ templateId: "figma-token-component-pull", cwd: root, timezone: "America/Chicago" });
    const prompt = buildAutomationPrompt(automation, defaultStudioConfig(root));

    expect(prompt).toContain("Mémoire Studio automation");
    expect(prompt).toContain("Mutation policy: review");
    expect(prompt).toContain("Do not mutate files or Figma canvas unless this automation explicitly allows writes.");
    expect(prompt).toContain("Codex model: gpt-5.5");
    expect(prompt).toContain("model_reasoning_effort: xhigh");
  });

  it("generates a user LaunchAgent plist for due-run checks", () => {
    const plist = buildLaunchAgentPlist({
      label: "cv.memoire.studio.automations.ark",
      runtimeBinary: "/Applications/Mémoire Studio.app/Contents/MacOS/memi-studio-runtime",
      projectRoot: "/Users/sarveshchidambaram/Desktop/Projects/Other/ark",
      intervalSeconds: 300,
      logPath: "/Users/sarveshchidambaram/Desktop/Projects/Other/ark/.memoire/studio/automations/scheduler.log",
    });

    expect(plist).toContain("<key>Label</key>");
    expect(plist).toContain("cv.memoire.studio.automations.ark");
    expect(plist).toContain("<string>studio</string>");
    expect(plist).toContain("<string>automations</string>");
    expect(plist).toContain("<string>run-due</string>");
    expect(plist).toContain("<string>--project</string>");
    expect(plist).toContain("<integer>300</integer>");
  });
});
