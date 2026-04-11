import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  openSubsystemWalStore,
  type SubsystemWalStore,
} from "./subsystemWalStore.js";

describe("subsystemWalStore (ADR0006)", () => {
  const tempPaths: string[] = [];

  afterEach(() => {
    for (const p of tempPaths) {
      try {
        fs.unlinkSync(p);
      } catch {
        /* ignore */
      }
      try {
        fs.unlinkSync(`${p}-wal`);
      } catch {
        /* ignore */
      }
      try {
        fs.unlinkSync(`${p}-shm`);
      } catch {
        /* ignore */
      }
    }
    tempPaths.length = 0;
  });

  function tempStorePair(): {
    readonly dbPath: string;
    readonly store: SubsystemWalStore;
  } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "subsystem-wal-"));
    const dbPath = path.join(dir, "subsystem.db");
    tempPaths.push(dbPath);
    return { dbPath, store: openSubsystemWalStore(dbPath) };
  }

  function openTempStore(): SubsystemWalStore {
    return tempStorePair().store;
  }

  it("enables WAL and applies migrations with a root revision and head pointer", () => {
    const store = openTempStore();
    expect(store.getJournalMode().toLowerCase()).toBe("wal");
    expect(store.getHeadRevisionId()).toBe(1);
    expect(store.getFilesAtRevision(1).size).toBe(0);
    store.close();
  });

  it("appends a revision with file changes and exposes materialized tree at head", () => {
    const store = openTempStore();
    const head1 = store.getHeadRevisionId();
    const rev2 = store.appendRevision({
      expectedHeadRevisionId: head1,
      changes: [{ path: "src/a.js", content: "export const x = 1;\n" }],
    });
    expect(rev2).toBe(2);
    expect(store.getHeadRevisionId()).toBe(2);
    const files = store.getFilesAtRevision(2);
    expect(files.get("src/a.js")).toBe("export const x = 1;\n");
    store.close();
  });

  it("materializes nested history by walking the linear revision chain", () => {
    const store = openTempStore();
    store.appendRevision({
      expectedHeadRevisionId: 1,
      changes: [{ path: "a.txt", content: "one" }],
    });
    store.appendRevision({
      expectedHeadRevisionId: 2,
      changes: [{ path: "b.txt", content: "two" }],
    });
    const at3 = store.getFilesAtRevision(3);
    expect(at3.get("a.txt")).toBe("one");
    expect(at3.get("b.txt")).toBe("two");
    const at2 = store.getFilesAtRevision(2);
    expect(at2.get("a.txt")).toBe("one");
    expect(at2.has("b.txt")).toBe(false);
    store.close();
  });

  it("records file deletion with null content", () => {
    const store = openTempStore();
    store.appendRevision({
      expectedHeadRevisionId: 1,
      changes: [{ path: "x.js", content: "// hi" }],
    });
    store.appendRevision({
      expectedHeadRevisionId: 2,
      changes: [{ path: "x.js", content: null }],
    });
    expect(store.getFilesAtRevision(3).has("x.js")).toBe(false);
    store.close();
  });

  it("rejects append when expected head does not match (single-writer consistency)", () => {
    const store = openTempStore();
    expect(() =>
      store.appendRevision({
        expectedHeadRevisionId: 999,
        changes: [{ path: "a.js", content: "" }],
      }),
    ).toThrow(/head/i);
    store.close();
  });

  it("stores arbitrary metadata key/value pairs", () => {
    const store = openTempStore();
    store.setMetadata("workspace_label", "alpha");
    expect(store.getMetadata("workspace_label")).toBe("alpha");
    store.close();
  });

  it("records promotion and test rows linked to a revision", () => {
    const store = openTempStore();
    store.appendRevision({
      expectedHeadRevisionId: 1,
      changes: [{ path: "m.js", content: "" }],
    });
    const id = store.recordPromotionEvent({
      revisionId: 2,
      kind: "test_pass",
      detail: { suite: "gate" },
    });
    expect(id).toBeGreaterThan(0);
    const rows = store.listPromotionEventsForRevision(2);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("test_pass");
    expect(rows[0]?.detail).toEqual({ suite: "gate" });
    store.close();
  });

  it("reopens the same database file with durable head and file tree", () => {
    const { dbPath, store } = tempStorePair();
    store.appendRevision({
      expectedHeadRevisionId: 1,
      changes: [{ path: "persist.js", content: "ok" }],
    });
    store.close();

    const again = openSubsystemWalStore(dbPath);
    expect(again.getHeadRevisionId()).toBe(2);
    expect(again.getFilesAtRevision(2).get("persist.js")).toBe("ok");
    again.close();
  });
});

describe("subsystemWalStore revision tags and replay (ADR0007)", () => {
  const tempPaths: string[] = [];

  afterEach(() => {
    for (const p of tempPaths) {
      try {
        fs.unlinkSync(p);
      } catch {
        /* ignore */
      }
      try {
        fs.unlinkSync(`${p}-wal`);
      } catch {
        /* ignore */
      }
      try {
        fs.unlinkSync(`${p}-shm`);
      } catch {
        /* ignore */
      }
    }
    tempPaths.length = 0;
  });

  function openTaggedStore(): SubsystemWalStore {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "subsystem-wal-tag-"));
    const dbPath = path.join(dir, "subsystem.db");
    tempPaths.push(dbPath);
    return openSubsystemWalStore(dbPath);
  }

  it("stores a tag as a named pointer to a revision and resolves it", () => {
    const store = openTaggedStore();
    store.appendRevision({
      expectedHeadRevisionId: 1,
      changes: [{ path: "x.js", content: "v1" }],
    });
    store.putRevisionTag({
      name: "baseline-before-map-change",
      revisionId: 2,
    });
    expect(store.getRevisionTag("baseline-before-map-change")).toBe(2);
    const listed = store.listRevisionTags();
    expect(listed).toEqual([
      { name: "baseline-before-map-change", revisionId: 2 },
    ]);
    store.close();
  });

  it("updates a tag to point at a new revision without rewriting history", () => {
    const store = openTaggedStore();
    store.appendRevision({
      expectedHeadRevisionId: 1,
      changes: [{ path: "a.js", content: "1" }],
    });
    store.putRevisionTag({ name: "release-2026-04", revisionId: 2 });
    store.appendRevision({
      expectedHeadRevisionId: 2,
      changes: [{ path: "a.js", content: "2" }],
    });
    store.putRevisionTag({ name: "release-2026-04", revisionId: 3 });
    expect(store.getHeadRevisionId()).toBe(3);
    expect(store.getRevisionTag("release-2026-04")).toBe(3);
    expect(store.getFilesAtRevision(2).get("a.js")).toBe("1");
    store.close();
  });

  it("rejects tagging a revision that does not exist", () => {
    const store = openTaggedStore();
    expect(() =>
      store.putRevisionTag({ name: "nope", revisionId: 999 }),
    ).toThrow(/unknown revision/i);
    store.close();
  });

  it("deletes a tag and persists across reopen", () => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "subsystem-wal-tag-del-"),
    );
    const dbPath = path.join(dir, "subsystem.db");
    tempPaths.push(dbPath);
    const store = openSubsystemWalStore(dbPath);
    store.putRevisionTag({ name: "t", revisionId: 1 });
    expect(store.deleteRevisionTag("t")).toBe(true);
    expect(store.deleteRevisionTag("t")).toBe(false);
    store.close();

    const again = openSubsystemWalStore(dbPath);
    expect(again.getRevisionTag("t")).toBeUndefined();
    again.close();
  });

  it("materializeReplayFiles returns the same tree as getFilesAtRevision", () => {
    const store = openTaggedStore();
    store.appendRevision({
      expectedHeadRevisionId: 1,
      changes: [{ path: "m.js", content: "replay" }],
    });
    const viaReplay = store.materializeReplayFiles(2);
    const viaGet = store.getFilesAtRevision(2);
    expect([...viaReplay.entries()].sort()).toEqual(
      [...viaGet.entries()].sort(),
    );
    store.close();
  });

  it("appendRevisionReverting adds a new revision that restores paths to parent-of-R state", () => {
    const store = openTaggedStore();
    store.appendRevision({
      expectedHeadRevisionId: 1,
      changes: [
        { path: "a.txt", content: "old" },
        { path: "b.txt", content: "gone-soon" },
      ],
    });
    store.appendRevision({
      expectedHeadRevisionId: 2,
      changes: [
        { path: "a.txt", content: "new" },
        { path: "b.txt", content: null },
      ],
    });
    const headBefore = store.getHeadRevisionId();
    const rev4 = store.appendRevisionReverting({
      expectedHeadRevisionId: headBefore,
      revisionId: 3,
    });
    expect(rev4).toBe(4);
    const files = store.getFilesAtRevision(4);
    expect(files.get("a.txt")).toBe("old");
    expect(files.has("b.txt")).toBe(true);
    expect(files.get("b.txt")).toBe("gone-soon");
    expect(store.getFilesAtRevision(3).get("a.txt")).toBe("new");
    store.close();
  });

  it("rejects reverting the root bootstrap revision", () => {
    const store = openTaggedStore();
    expect(() =>
      store.appendRevisionReverting({
        expectedHeadRevisionId: 1,
        revisionId: 1,
      }),
    ).toThrow(/root/i);
    store.close();
  });

  it("rejects revert when expected head does not match", () => {
    const store = openTaggedStore();
    store.appendRevision({
      expectedHeadRevisionId: 1,
      changes: [{ path: "z.js", content: "" }],
    });
    expect(() =>
      store.appendRevisionReverting({
        expectedHeadRevisionId: 1,
        revisionId: 2,
      }),
    ).toThrow(/head/i);
    store.close();
  });
});
