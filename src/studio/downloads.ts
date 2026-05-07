import { EventEmitter } from "node:events";
import type { ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { installNote } from "../notes/installer.js";
import type { StudioDownloadEvent, StudioDownloadJob } from "./types.js";

interface DownloadStoreFile {
  schemaVersion: 1;
  jobs: StudioDownloadJob[];
  events: StudioDownloadEvent[];
}

export class StudioDownloadStore {
  private readonly projectRoot: string;
  private readonly emitter = new EventEmitter();
  private loaded = false;
  private jobs = new Map<string, StudioDownloadJob>();
  private events = new Map<string, StudioDownloadEvent[]>();

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.emitter.setMaxListeners(200);
  }

  async init(): Promise<void> {
    if (this.loaded) return;
    await mkdir(this.downloadsDir(), { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(this.storePath(), "utf-8")) as DownloadStoreFile;
      const retainedJobs = parsed.jobs.filter((job) => shouldRetainJob(job));
      for (const job of retainedJobs) this.jobs.set(job.id, job);
      const retainedIds = new Set(retainedJobs.map((job) => job.id));
      for (const event of parsed.events ?? []) {
        if (!retainedIds.has(event.jobId)) continue;
        const current = this.events.get(event.jobId) ?? [];
        current.push(event);
        this.events.set(event.jobId, current);
      }
    } catch {
      // Fresh store.
    }
    this.loaded = true;
    await this.persist();
  }

  list(): StudioDownloadJob[] {
    return Array.from(this.jobs.values()).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  get(id: string): StudioDownloadJob | null {
    return this.jobs.get(id) ?? null;
  }

  eventsFor(id: string): StudioDownloadEvent[] {
    return this.events.get(id) ?? [];
  }

  metrics(): { total: number; active: number; queued: number } {
    const jobs = this.list();
    return {
      total: jobs.length,
      active: jobs.filter((job) => job.status === "running").length,
      queued: jobs.filter((job) => job.status === "queued").length,
    };
  }

  async installNoteJob(input: {
    noteId?: string | null;
    source?: string | null;
    version?: string | null;
    catalogUrl?: string | null;
  }): Promise<StudioDownloadJob> {
    await this.init();
    const source = input.source?.trim() || input.noteId?.trim();
    if (!source) throw Object.assign(new Error("noteId or source is required"), { statusCode: 400 });
    const now = new Date().toISOString();
    const job: StudioDownloadJob = {
      id: `download-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
      type: "note-install",
      status: "queued",
      noteName: input.noteId?.trim() || null,
      noteId: input.noteId?.trim() || null,
      source,
      catalogUrl: input.catalogUrl?.trim() || null,
      progress: 0,
      message: `Queued ${source}`,
      error: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    this.jobs.set(job.id, job);
    this.pushEvent(job, "queued", job.message, 0);
    await this.persist();

    await this.runInstall(job, source);
    return job;
  }

  writeEventsSSE(id: string, res: ServerResponse): void {
    const job = this.get(id);
    if (!job) {
      res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: `Unknown download: ${id}` }));
      return;
    }
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    for (const event of this.eventsFor(id)) writeDownloadSSE(res, event);
    if (job.status === "completed" || job.status === "failed") {
      res.end();
      return;
    }
    const listener = (event: StudioDownloadEvent) => {
      if (event.jobId !== id) return;
      writeDownloadSSE(res, event);
      if (event.type === "completed" || event.type === "failed") res.end();
    };
    this.emitter.on("event", listener);
    res.on("close", () => this.emitter.off("event", listener));
  }

  private async runInstall(job: StudioDownloadJob, source: string): Promise<void> {
    this.updateJob(job, {
      status: "running",
      progress: 10,
      message: `Installing ${source}`,
      updatedAt: new Date().toISOString(),
    });
    this.pushEvent(job, "progress", job.message, job.progress);
    await this.persist();
    try {
      const manifest = await installNote(source, this.projectRoot, {
        catalogUrl: job.catalogUrl,
        onProgress: (event) => {
          const progress = event.type === "completed" ? 90 : Math.max(job.progress, 35);
          this.updateJob(job, { progress, message: event.message, updatedAt: new Date().toISOString() });
          this.pushEvent(job, "progress", event.message, progress);
        },
      });
      this.updateJob(job, {
        status: "completed",
        noteName: manifest.name,
        noteId: manifest.name,
        progress: 100,
        message: `Installed ${manifest.name}@${manifest.version}`,
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });
      this.pushEvent(job, "completed", job.message, 100);
    } catch (error) {
      this.updateJob(job, {
        status: "failed",
        progress: 100,
        message: error instanceof Error ? error.message : String(error),
        error: error instanceof Error ? error.message : String(error),
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });
      this.pushEvent(job, "failed", job.message, 100);
    }
    await this.persist();
  }

  private updateJob(job: StudioDownloadJob, patch: Partial<StudioDownloadJob>): void {
    Object.assign(job, patch);
    this.jobs.set(job.id, job);
  }

  private pushEvent(
    job: StudioDownloadJob,
    type: StudioDownloadEvent["type"],
    message: string,
    progress: number,
  ): void {
    const event: StudioDownloadEvent = {
      id: `${type}-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`,
      jobId: job.id,
      type,
      timestamp: new Date().toISOString(),
      message,
      progress,
    };
    const current = this.events.get(job.id) ?? [];
    current.push(event);
    this.events.set(job.id, current);
    this.emitter.emit("event", event);
  }

  private async persist(): Promise<void> {
    await mkdir(this.downloadsDir(), { recursive: true });
    const payload: DownloadStoreFile = {
      schemaVersion: 1,
      jobs: this.list(),
      events: Array.from(this.events.values()).flat(),
    };
    await writeFile(this.storePath(), `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  }

  private downloadsDir(): string {
    return join(this.projectRoot, ".memoire", "downloads");
  }

  private storePath(): string {
    return join(this.downloadsDir(), "downloads.json");
  }
}

function shouldRetainJob(job: StudioDownloadJob): boolean {
  if (job.status === "running" || job.status === "queued") return true;
  const completed = Date.parse(job.completedAt ?? job.updatedAt);
  if (!Number.isFinite(completed)) return true;
  return Date.now() - completed < 7 * 24 * 60 * 60 * 1000;
}

function writeDownloadSSE(res: ServerResponse, event: StudioDownloadEvent): void {
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}
