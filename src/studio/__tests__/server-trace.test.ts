import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { StudioRuntimeServer } from "../server.js";
import { StudioSessionStore } from "../session-store.js";
import type { StudioEvent, StudioSession } from "../types.js";

const servers: StudioRuntimeServer[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.stop()));
});

describe("studio backend trace and persisted sessions", () => {
  it("merges persisted sessions into /api/sessions after runtime restart", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-studio-persisted-sessions-"));
    try {
      const store = new StudioSessionStore(root);
      store.init();
      const session = makeSession(root, "completed");
      store.appendEvent(session, makeEvent(session.id, "session_started", "Started codex"));
      store.appendEvent(session, makeEvent(session.id, "session_result", "Design complete"));

      const server = new StudioRuntimeServer({ projectRoot: root, port: 0 });
      servers.push(server);
      const runtime = await server.start();

      const payload = await fetch(`${runtime.url}/api/sessions`).then((res) => res.json());

      expect(payload.sessions).toContainEqual(expect.objectContaining({
        id: session.id,
        harness: "codex",
        status: "completed",
        source: "persisted",
      }));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("serves non-SSE session events from persisted JSONL logs with a limit", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-studio-events-"));
    try {
      const store = new StudioSessionStore(root);
      store.init();
      const session = makeSession(root, "completed");
      store.appendEvent(session, makeEvent(session.id, "session_started", "Started codex"));
      store.appendEvent(session, makeEvent(session.id, "tool_call", "Read specs/Button.json"));
      store.appendEvent(session, makeEvent(session.id, "session_result", "Ready"));

      const server = new StudioRuntimeServer({ projectRoot: root, port: 0 });
      servers.push(server);
      const runtime = await server.start();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 750);

      try {
        const payload = await fetch(`${runtime.url}/api/sessions/${encodeURIComponent(session.id)}/events?limit=2`, {
          signal: controller.signal,
        }).then((res) => res.json());

        expect(payload.session).toMatchObject({ id: session.id, source: "persisted" });
        expect(payload.events.map((event: StudioEvent) => event.type)).toEqual(["tool_call", "session_result"]);
      } finally {
        clearTimeout(timer);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("marks persisted running sessions failed when the runtime restarts", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-studio-abandoned-session-"));
    try {
      const store = new StudioSessionStore(root);
      store.init();
      const session = makeSession(root, "running", "studio-abandoned-session");
      store.appendEvent(session, makeEvent(session.id, "session_started", "Started codex"));

      const server = new StudioRuntimeServer({ projectRoot: root, port: 0 });
      servers.push(server);
      const runtime = await server.start();

      const sessionsPayload = await fetch(`${runtime.url}/api/sessions`).then((res) => res.json());
      const eventsPayload = await fetch(`${runtime.url}/api/sessions/${encodeURIComponent(session.id)}/events`).then((res) => res.json());
      const repaired = sessionsPayload.sessions.find((entry: StudioSession) => entry.id === session.id);

      expect(repaired).toMatchObject({
        id: session.id,
        status: "failed",
        exitCode: null,
      });
      expect(repaired.completedAt).toEqual(expect.any(String));
      expect(eventsPayload.events).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: "session_error",
          message: expect.stringContaining("runtime restarted"),
          data: { reason: "runtime-restart" },
        }),
      ]));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("returns a backend trace snapshot from persisted events without inventing empty work", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-studio-trace-"));
    try {
      const store = new StudioSessionStore(root);
      store.init();
      const tracedSession = makeSession(root, "completed", "studio-traced-session");
      store.appendEvent(tracedSession, makeEvent(tracedSession.id, "reference_trace", "Mémoire package and source references loaded", {
        references: [
          {
            id: "package:@memi-design/cli",
            kind: "package",
            label: "@memi-design/cli@0.17.0",
            summary: "Runtime package",
            packageName: "@memi-design/cli",
            packageVersion: "0.17.0",
            url: "https://www.npmjs.com/package/@memi-design/cli",
            eventIds: [],
          },
        ],
      }));
      store.appendEvent(tracedSession, makeEvent(tracedSession.id, "research_note", "Research synthesized"));
      store.appendEvent(tracedSession, makeEvent(tracedSession.id, "tool_call", "Read specs/Button.json"));
      store.appendEvent(tracedSession, makeEvent(tracedSession.id, "design_preview", "Generated screen preview"));
      store.appendEvent(tracedSession, makeEvent(tracedSession.id, "artifact", "Wrote spec"));

      const emptySession = makeSession(root, "completed", "studio-empty-session");
      store.upsertSession(emptySession);

      const server = new StudioRuntimeServer({ projectRoot: root, port: 0 });
      servers.push(server);
      const runtime = await server.start();

      const traced = await fetch(`${runtime.url}/api/sessions/${encodeURIComponent(tracedSession.id)}/trace`).then((res) => res.json());
      const empty = await fetch(`${runtime.url}/api/sessions/${encodeURIComponent(emptySession.id)}/trace`).then((res) => res.json());

      expect(traced.trace).toMatchObject({
        sessionId: tracedSession.id,
        source: "persisted",
        evidenceCount: 4,
      });
      expect(traced.trace.references).toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: "package",
          packageName: "@memi-design/cli",
          packageVersion: "0.17.0",
        }),
        expect.objectContaining({
          kind: "file",
          sourcePath: "specs/Button.json",
        }),
      ]));
      expect(traced.trace.phases.map((phase: { id: string; status: string }) => [phase.id, phase.status])).toEqual([
        ["research", "completed"],
        ["analyze", "completed"],
        ["ideate", "queued"],
        ["design", "completed"],
        ["spec", "completed"],
        ["handoff", "queued"],
      ]);
      expect(traced.trace.tasks.find((task: { id: string; evidenceIds: string[] }) => task.id === "specs-handoff").evidenceIds).toHaveLength(1);
      expect(empty.trace.phases.every((phase: { status: string }) => phase.status === "queued")).toBe(true);
      expect(empty.trace.tasks.every((task: { status: string; progress: number }) => task.status === "queued" && task.progress === 0)).toBe(true);
      expect(empty.trace.references).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("uses persisted JSONL for live trace snapshots so noisy model output cannot evict references", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-studio-live-trace-"));
    try {
      const store = new StudioSessionStore(root);
      store.init();
      const noisySession = makeSession(root, "running", "studio-live-noisy-session");
      store.appendEvent(noisySession, makeEvent(noisySession.id, "reference_trace", "Mémoire package and source references loaded", {
        references: [
          {
            id: "package:@memi-design/cli",
            kind: "package",
            label: "@memi-design/cli@0.17.0",
            summary: "Runtime package",
            packageName: "@memi-design/cli",
            packageVersion: "0.17.0",
            url: "https://www.npmjs.com/package/@memi-design/cli",
            eventIds: [],
          },
        ],
      }));
      for (let index = 0; index < 450; index += 1) {
        store.appendEvent(noisySession, makeEvent(noisySession.id, "stdout", `chunk ${index}`));
      }
      noisySession.events = [
        makeEvent(noisySession.id, "stdout", "tail chunk 1"),
        makeEvent(noisySession.id, "stdout", "tail chunk 2"),
      ];

      const server = new StudioRuntimeServer({ projectRoot: root, port: 0 });
      servers.push(server);
      const runtime = await server.start();
      (server as unknown as { sessions: Map<string, StudioSession> }).sessions.set(noisySession.id, noisySession);

      const traced = await fetch(`${runtime.url}/api/sessions/${encodeURIComponent(noisySession.id)}/trace`).then((res) => res.json());

      expect(traced.trace.source).toBe("live");
      expect(traced.trace.references).toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: "package",
          packageName: "@memi-design/cli",
        }),
      ]));
      expect(traced.trace.outputs.length).toBeGreaterThan(400);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("captures, lists, reads, and reviews design-system artifacts through runtime APIs", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-studio-artifacts-api-"));
    try {
      const server = new StudioRuntimeServer({ projectRoot: root, port: 0 });
      servers.push(server);
      const runtime = await server.start();

      const capture = await fetch(`${runtime.url}/api/artifacts/capture`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session: makeSession(root, "completed", "studio-buzzr-artifact"),
          events: [
            makeEvent("studio-buzzr-artifact", "artifact", "Buzzr Design System Pull:\n- Brand: [Brand](/Users/sarveshchidambaram/Desktop/Projects/Buzzr/Buzzr/docs/BEE_BRANDING_ROADMAP.md:9)\n- Components: [Button.tsx](/Users/sarveshchidambaram/Desktop/Projects/Buzzr/Buzzr/components/ui/Button.tsx:88)"),
          ],
        }),
      }).then((res) => res.json());

      const listed = await fetch(`${runtime.url}/api/artifacts`).then((res) => res.json());
      const firstSection = capture.artifact.sections[0];
      const reviewed = await fetch(`${runtime.url}/api/artifacts/${encodeURIComponent(capture.artifact.id)}/sections/${encodeURIComponent(firstSection.id)}/review`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewState: "looks_good", comment: "Brand source verified." }),
      }).then((res) => res.json());
      const read = await fetch(`${runtime.url}/api/artifacts/${encodeURIComponent(capture.artifact.id)}`).then((res) => res.json());

      expect(listed.artifacts).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: capture.artifact.id, title: "Buzzr Design System Pull" }),
      ]));
      expect(reviewed.artifact.sections.find((section: { id: string }) => section.id === firstSection.id)).toMatchObject({
        reviewState: "looks_good",
        comments: ["Brand source verified."],
      });
      expect(read.artifact.sourceRefs).toEqual(expect.arrayContaining([
        expect.objectContaining({ label: "Button.tsx" }),
      ]));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

function makeSession(root: string, status: StudioSession["status"], id = "studio-persisted-session"): StudioSession {
  return {
    id,
    harness: "codex",
    action: "raw",
    cwd: root,
    prompt: "design",
    status,
    startedAt: "2026-05-05T00:00:00.000Z",
    completedAt: "2026-05-05T00:00:02.000Z",
    exitCode: 0,
    activeStreamId: null,
    pendingPrompt: null,
    events: [],
  };
}

function makeEvent(sessionId: string, type: StudioEvent["type"], message: string, data?: unknown): StudioEvent {
  return {
    id: `${type}-${message.toLowerCase().replace(/\W+/g, "-")}`,
    sessionId,
    type,
    timestamp: "2026-05-05T00:00:01.000Z",
    message,
    data,
  };
}
