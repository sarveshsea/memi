import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StudioChatMode, StudioEvent, StudioPermissionMode, StudioRunAction, StudioSession, StudioSessionMode } from "./types.js";

export interface StudioSessionIndexEntry {
  id: string;
  conversationId?: string;
  turnIndex?: number;
  goal?: string;
  model?: string | null;
  effort?: string | null;
  harness: string;
  action: StudioRunAction;
  mode?: StudioSessionMode;
  chatMode?: StudioChatMode;
  permissionMode?: StudioPermissionMode;
  cwd: string;
  prompt: string;
  status: StudioSession["status"];
  startedAt: string;
  completedAt: string | null;
  exitCode: number | null;
  eventCount: number;
  updatedAt: string;
}

interface StudioSessionIndex {
  schemaVersion: 1;
  sessions: StudioSessionIndexEntry[];
}

export class StudioSessionStore {
  private readonly root: string;
  private index: StudioSessionIndex = { schemaVersion: 1, sessions: [] };

  constructor(projectRoot: string) {
    this.root = join(projectRoot, ".memoire", "studio");
  }

  init(): void {
    mkdirSync(this.sessionsDir, { recursive: true });
    try {
      this.index = JSON.parse(readFileSync(this.indexPath, "utf-8")) as StudioSessionIndex;
      if (this.index.schemaVersion !== 1 || !Array.isArray(this.index.sessions)) {
        this.index = { schemaVersion: 1, sessions: [] };
      }
    } catch {
      this.index = { schemaVersion: 1, sessions: [] };
      this.flushIndex();
    }
  }

  appendEvent(session: StudioSession, event: StudioEvent): void {
    mkdirSync(this.sessionsDir, { recursive: true });
    appendFileSync(this.eventLogPath(session.id), `${JSON.stringify(event)}\n`);
    this.upsertSession(session);
  }

  upsertSession(session: StudioSession): void {
    const entry: StudioSessionIndexEntry = {
      id: session.id,
      conversationId: session.conversationId,
      turnIndex: session.turnIndex,
      goal: session.goal,
      model: session.model,
      effort: session.effort,
      harness: session.harness,
      action: session.action,
      mode: session.mode,
      chatMode: session.chatMode,
      permissionMode: session.permissionMode,
      cwd: session.cwd,
      prompt: session.prompt,
      status: session.status,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      exitCode: session.exitCode,
      eventCount: session.events.length,
      updatedAt: new Date().toISOString(),
    };
    const next = this.index.sessions.filter((candidate) => candidate.id !== session.id);
    next.unshift(entry);
    this.index = { schemaVersion: 1, sessions: next.slice(0, 500) };
    this.flushIndex();
  }

  listSessions(): StudioSessionIndexEntry[] {
    return this.index.sessions;
  }

  getSession(sessionId: string): StudioSessionIndexEntry | null {
    return this.index.sessions.find((session) => session.id === sessionId) ?? null;
  }

  readSessionEvents(sessionId: string, options: { limit?: number } = {}): StudioEvent[] {
    const path = this.eventLogPath(sessionId);
    if (!existsSync(path)) return [];
    const events = readFileSync(path, "utf-8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as StudioEvent);
    return options.limit && options.limit > 0 ? events.slice(-options.limit) : events;
  }

  get indexedSessionCount(): number {
    return this.index.sessions.length;
  }

  private eventLogPath(sessionId: string): string {
    return join(this.sessionsDir, `${sessionId}.jsonl`);
  }

  private get sessionsDir(): string {
    return join(this.root, "sessions");
  }

  private get indexPath(): string {
    return join(this.root, "session-index.json");
  }

  private flushIndex(): void {
    mkdirSync(this.root, { recursive: true });
    writeFileSync(this.indexPath, `${JSON.stringify(this.index, null, 2)}\n`);
  }
}
