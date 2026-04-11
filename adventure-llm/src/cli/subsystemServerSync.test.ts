import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applySubsystemReplicaSync,
  isValidSubsystemWorkspaceId,
  openServerSubsystemReplicaStore,
  resetServerSubsystemReplicaStoreSingletonForTests,
} from "./subsystemServerSync.js";

afterEach(() => {
  resetServerSubsystemReplicaStoreSingletonForTests();
});

describe("subsystemServerSync (ADR0008)", () => {
  it("rejects invalid workspace ids", () => {
    expect(isValidSubsystemWorkspaceId("")).toBe(false);
    expect(isValidSubsystemWorkspaceId("../x")).toBe(false);
    expect(isValidSubsystemWorkspaceId("a".repeat(200))).toBe(false);
    expect(isValidSubsystemWorkspaceId("ws-01")).toBe(true);
  });

  it("applies a linear revision batch idempotently and updates server head", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "subsync-"));
    const dbPath = path.join(dir, "r.db");
    const store = openServerSubsystemReplicaStore(dbPath);
    expect(store.getHeadRevisionId()).toBe(1);

    const r1 = applySubsystemReplicaSync(store.getDatabase(), {
      clientHeadRevisionId: 2,
      revisions: [
        {
          id: 2,
          parentRevisionId: 1,
          createdAtIso: "2026-04-10T12:00:00.000Z",
          fileChanges: [{ path: "a.txt", content: "hello" }],
        },
      ],
    });
    expect(r1.status).toBe("applied");
    if (r1.status !== "applied") throw new Error("expected applied");
    expect(r1.serverHeadRevisionId).toBe(2);
    expect(r1.appliedRevisionIds).toEqual([2]);
    expect(store.getHeadRevisionId()).toBe(2);
    expect(store.getFilesAtRevision(2).get("a.txt")).toBe("hello");

    const r2 = applySubsystemReplicaSync(store.getDatabase(), {
      clientHeadRevisionId: 2,
      revisions: [
        {
          id: 2,
          parentRevisionId: 1,
          createdAtIso: "2026-04-10T12:00:00.000Z",
          fileChanges: [{ path: "a.txt", content: "hello" }],
        },
      ],
    });
    expect(r2.status).toBe("noop");
    if (r2.status !== "noop") throw new Error("expected noop");
    expect(r2.serverHeadRevisionId).toBe(2);
    expect(store.getHeadRevisionId()).toBe(2);

    store.close();
  });

  it("detects fork when the first new revision does not extend server head", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "subsync-fork-"));
    const dbPath = path.join(dir, "r.db");
    const store = openServerSubsystemReplicaStore(dbPath);
    applySubsystemReplicaSync(store.getDatabase(), {
      clientHeadRevisionId: 2,
      revisions: [
        {
          id: 2,
          parentRevisionId: 1,
          createdAtIso: "2026-04-10T12:00:00.000Z",
          fileChanges: [{ path: "x", content: "1" }],
        },
      ],
    });
    applySubsystemReplicaSync(store.getDatabase(), {
      clientHeadRevisionId: 3,
      revisions: [
        {
          id: 3,
          parentRevisionId: 2,
          createdAtIso: "2026-04-10T12:01:00.000Z",
          fileChanges: [{ path: "x", content: "2" }],
        },
      ],
    });
    expect(store.getHeadRevisionId()).toBe(3);

    const fork = applySubsystemReplicaSync(store.getDatabase(), {
      clientHeadRevisionId: 4,
      revisions: [
        {
          id: 4,
          parentRevisionId: 2,
          createdAtIso: "2026-04-10T12:02:00.000Z",
          fileChanges: [{ path: "x", content: "fork" }],
        },
      ],
    });
    expect(fork.status).toBe("fork");
    if (fork.status !== "fork") throw new Error("expected fork");
    expect(fork.serverHeadRevisionId).toBe(3);
    expect(store.getHeadRevisionId()).toBe(3);

    store.close();
  });

  it("reports client behind server when client head is lower and batch is empty", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "subsync-behind-"));
    const dbPath = path.join(dir, "r.db");
    const store = openServerSubsystemReplicaStore(dbPath);
    applySubsystemReplicaSync(store.getDatabase(), {
      clientHeadRevisionId: 2,
      revisions: [
        {
          id: 2,
          parentRevisionId: 1,
          createdAtIso: "2026-04-10T12:00:00.000Z",
          fileChanges: [],
        },
      ],
    });
    expect(store.getHeadRevisionId()).toBe(2);

    const behind = applySubsystemReplicaSync(store.getDatabase(), {
      clientHeadRevisionId: 1,
      revisions: [],
    });
    expect(behind.status).toBe("noop");
    if (behind.status !== "noop") throw new Error("expected noop");
    expect(behind.clientBehindServer).toBe(true);
    expect(behind.serverHeadRevisionId).toBe(2);

    store.close();
  });

  it("replicates revision tags with revisions", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "subsync-tags-"));
    const dbPath = path.join(dir, "r.db");
    const store = openServerSubsystemReplicaStore(dbPath);
    applySubsystemReplicaSync(store.getDatabase(), {
      clientHeadRevisionId: 2,
      revisions: [
        {
          id: 2,
          parentRevisionId: 1,
          createdAtIso: "2026-04-10T12:00:00.000Z",
          fileChanges: [],
          tags: [
            {
              name: "release",
              createdAtIso: "2026-04-10T12:00:01.000Z",
              updatedAtIso: "2026-04-10T12:00:01.000Z",
            },
          ],
        },
      ],
    });
    expect(store.getRevisionTag("release")).toBe(2);
    store.close();
  });
});
