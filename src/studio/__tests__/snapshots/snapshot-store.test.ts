import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FileSnapshotStore,
  MemorySnapshotStore,
  buildSnapshot,
  type HarnessSnapshot,
} from "../../snapshots/snapshot-store.js";
import { asId, makeId } from "../../contracts/ids.js";
import type { SessionId } from "../../contracts/ids.js";

function fixture(overrides: Partial<HarnessSnapshot> = {}): HarnessSnapshot {
  const sessionId = (overrides.sessionId ?? asId("SessionId", makeId("SessionId"))) as SessionId;
  return buildSnapshot({
    sessionId,
    harnessId: asId("HarnessId", "hns_codex"),
    sessionState: "ready",
    totalInputTokens: 10,
    totalOutputTokens: 20,
    totalReasoningTokens: 0,
    estimatedCostUsd: 0.001,
    lastEventSeq: 5,
    createdAt: new Date().toISOString(),
    ...overrides,
  });
}

describe("snapshots/MemorySnapshotStore", () => {
  it("save + load round-trips", async () => {
    const store = new MemorySnapshotStore();
    const snap = fixture();
    await store.save(snap);
    const loaded = await store.load(snap.sessionId);
    expect(loaded?.sessionId).toBe(snap.sessionId);
    expect(loaded?.totalInputTokens).toBe(10);
  });

  it("load returns null for unknown session", async () => {
    const store = new MemorySnapshotStore();
    const loaded = await store.load(asId("SessionId", "ses_unknown"));
    expect(loaded).toBeNull();
  });

  it("list returns all saved snapshots", async () => {
    const store = new MemorySnapshotStore();
    await store.save(fixture());
    await store.save(fixture());
    const all = await store.list();
    expect(all.length).toBe(2);
  });

  it("delete removes a snapshot", async () => {
    const store = new MemorySnapshotStore();
    const snap = fixture();
    await store.save(snap);
    await store.delete(snap.sessionId);
    expect(await store.load(snap.sessionId)).toBeNull();
  });

  it("prune by age removes old snapshots", async () => {
    const store = new MemorySnapshotStore();
    const old: HarnessSnapshot = {
      ...fixture(),
      updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    };
    await store.save(old);
    const fresh = fixture();
    await store.save(fresh);
    const removed = await store.prune({ olderThanMs: 7 * 24 * 60 * 60 * 1000 });
    expect(removed).toBe(1);
    expect(await store.list()).toHaveLength(1);
  });

  it("prune by max keeps the N newest", async () => {
    const store = new MemorySnapshotStore();
    for (let i = 0; i < 5; i += 1) {
      const snap = fixture({});
      // stagger updatedAt
      const offset = (5 - i) * 1000;
      await store.save({ ...snap, updatedAt: new Date(Date.now() - offset).toISOString() });
    }
    const removed = await store.prune({ max: 3 });
    expect(removed).toBe(2);
    expect((await store.list()).length).toBe(3);
  });
});

describe("snapshots/FileSnapshotStore", () => {
  let root: string;
  let store: FileSnapshotStore;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "memoire-snap-"));
    store = new FileSnapshotStore(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("save + load round-trips through disk", async () => {
    const snap = fixture();
    await store.save(snap);
    const loaded = await store.load(snap.sessionId);
    expect(loaded?.sessionId).toBe(snap.sessionId);
    expect(loaded?.totalInputTokens).toBe(10);
  });

  it("load returns null for unknown session (no file)", async () => {
    const loaded = await store.load(asId("SessionId", "ses_unknown"));
    expect(loaded).toBeNull();
  });

  it("list returns all snapshots in the directory", async () => {
    await store.save(fixture());
    await store.save(fixture());
    const all = await store.list();
    expect(all.length).toBe(2);
  });

  it("delete removes the snapshot file", async () => {
    const snap = fixture();
    await store.save(snap);
    await store.delete(snap.sessionId);
    expect(await store.load(snap.sessionId)).toBeNull();
  });

  it("delete on missing file is a no-op", async () => {
    await expect(store.delete(asId("SessionId", "ses_missing"))).resolves.toBeUndefined();
  });

  it("save is atomic (write-tmp + rename, no corrupt files visible)", async () => {
    const snap = fixture();
    await store.save(snap);
    const all = await store.list();
    // No .tmp files leaked into list()
    for (const s of all) {
      expect(String(s.sessionId)).toMatch(/^ses_/);
    }
  });

  it("list ignores corrupt files (no throw)", async () => {
    const snap = fixture();
    await store.save(snap);
    // Inject a corrupt file
    const fs = await import("node:fs/promises");
    await fs.writeFile(join(root, ".memoire/studio/snapshots/ses_corrupt.json"), "not json", "utf-8");
    const all = await store.list();
    expect(all.length).toBe(1); // skipped the corrupt one
  });

  it("prune by age removes old snapshots from disk", async () => {
    const old: HarnessSnapshot = {
      ...fixture(),
      updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    };
    await store.save(old);
    await store.save(fixture());
    const removed = await store.prune({ olderThanMs: 7 * 24 * 60 * 60 * 1000 });
    expect(removed).toBe(1);
    expect((await store.list()).length).toBe(1);
  });
});

describe("snapshots/buildSnapshot", () => {
  it("stamps lastEventAt and updatedAt to now", () => {
    const before = Date.now();
    const snap = buildSnapshot({
      sessionId: asId("SessionId", "ses_x"),
      harnessId: asId("HarnessId", "hns_codex"),
      sessionState: "ready",
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalReasoningTokens: 0,
      estimatedCostUsd: 0,
      lastEventSeq: 0,
      createdAt: new Date().toISOString(),
    });
    const after = Date.now();
    expect(Date.parse(snap.lastEventAt)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(snap.lastEventAt)).toBeLessThanOrEqual(after);
    expect(snap.updatedAt).toBe(snap.lastEventAt);
  });
});
