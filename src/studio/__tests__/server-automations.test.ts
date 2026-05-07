import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { StudioRuntimeServer } from "../server.js";

const servers: StudioRuntimeServer[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.stop()));
});

describe("studio automation routes", () => {
  it("creates, lists, updates, runs, and deletes Studio automations", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-server-automations-"));
    try {
      const server = new StudioRuntimeServer({ projectRoot: root, port: 0 });
      servers.push(server);
      const runtime = await server.start();

      const templates = await fetch(`${runtime.url}/api/automations/templates`).then((res) => res.json());
      expect(templates.templates.map((template: { id: string }) => template.id)).toContain("design-system-audit");

      const created = await fetch(`${runtime.url}/api/automations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateId: "design-system-audit",
          name: "Daily audit",
          rrule: "FREQ=DAILY;BYHOUR=9;BYMINUTE=0;BYSECOND=0",
          harness: "shell",
          action: "raw",
          prompt: "true",
          cwd: root,
        }),
      }).then((res) => res.json());

      expect(created.automation).toMatchObject({
        name: "Daily audit",
        harness: "shell",
        permissionMode: "plan",
        mutationPolicy: "review",
      });

      const listed = await fetch(`${runtime.url}/api/automations`).then((res) => res.json());
      expect(listed.automations.map((automation: { id: string }) => automation.id)).toContain(created.automation.id);

      const updated = await fetch(`${runtime.url}/api/automations/${created.automation.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "PAUSED" }),
      }).then((res) => res.json());
      expect(updated.automation.status).toBe("PAUSED");

      const run = await fetch(`${runtime.url}/api/automations/${created.automation.id}/run`, {
        method: "POST",
      }).then((res) => res.json());
      expect(run.run).toMatchObject({
        automationId: created.automation.id,
        status: expect.stringMatching(/completed|failed/),
      });

      const runs = await fetch(`${runtime.url}/api/automations/${created.automation.id}/runs`).then((res) => res.json());
      expect(runs.runs[0].automationId).toBe(created.automation.id);

      const deleted = await fetch(`${runtime.url}/api/automations/${created.automation.id}`, { method: "DELETE" }).then((res) => res.json());
      expect(deleted.deleted).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("serves scheduler status and due-run results", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-server-automation-due-"));
    try {
      const server = new StudioRuntimeServer({ projectRoot: root, port: 0 });
      servers.push(server);
      const runtime = await server.start();

      const scheduler = await fetch(`${runtime.url}/api/automations/scheduler/status`).then((res) => res.json());
      expect(scheduler.scheduler).toMatchObject({
        label: expect.stringContaining("cv.memoire.studio.automations"),
        installed: expect.any(Boolean),
      });

      const created = await fetch(`${runtime.url}/api/automations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateId: "research-reference-refresh",
          rrule: "FREQ=MINUTELY;INTERVAL=30",
          nextRunAt: "2026-05-07T14:00:00.000Z",
          harness: "shell",
          action: "raw",
          prompt: "true",
          cwd: root,
        }),
      }).then((res) => res.json());

      const due = await fetch(`${runtime.url}/api/automations/run-due`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ now: "2026-05-07T14:30:00.000Z" }),
      }).then((res) => res.json());

      expect(due.runs).toEqual([
        expect.objectContaining({ automationId: created.automation.id }),
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
