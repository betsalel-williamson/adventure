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
