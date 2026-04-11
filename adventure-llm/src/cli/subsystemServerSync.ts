/**
 * Server-side subsystem replica apply + sync batch handling (ADR0008).
 * Client WAL schema matches {@link ../browser/subsystemWalStore.js}; sync batches carry explicit revision ids.
 */
import fs from "node:fs";
import path from "node:path";
import BetterSqlite3 from "better-sqlite3";
import type { Database } from "better-sqlite3";
import {
  assertRevisionEligibleForLiveTag,
  SUBSYSTEM_LIVE_REVISION_TAG_NAME,
} from "../browser/subsystemPromoteGate.js";
import {
  migrateSubsystemWalStore,
  SubsystemWalStore,
} from "../browser/subsystemWalStore.js";

const META_HEAD_KEY = "head_revision_id" as const;

const WORKSPACE_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

export function isValidSubsystemWorkspaceId(id: string): boolean {
  return id.length > 0 && id.length <= 128 && WORKSPACE_ID_RE.test(id);
}

export function resolveServerSubsystemReplicaDbPath(
  packageRoot: string,
  workspaceId: string,
): string {
  if (!isValidSubsystemWorkspaceId(workspaceId)) {
    throw new Error("subsystemServerSync: invalid workspace id");
  }
  const v = process.env.ADVENTURE_LLM_SUBSYSTEM_REPLICA_DIR?.trim();
  const baseDir =
    v && v.length > 0
      ? path.resolve(v)
      : path.join(packageRoot, ".cache", "subsystem-replica");
  return path.join(baseDir, `${workspaceId}.db`);
}

export type SubsystemSyncRevisionPayload = {
  readonly id: number;
  readonly parentRevisionId: number | null;
  readonly createdAtIso: string;
  readonly fileChanges: ReadonlyArray<{
    readonly path: string;
    readonly content: string | null;
  }>;
  readonly tags?: ReadonlyArray<{
    readonly name: string;
    readonly createdAtIso: string;
    readonly updatedAtIso: string;
  }>;
  readonly promotions?: ReadonlyArray<{
    readonly id: number;
    readonly kind: string;
    readonly createdAtIso: string;
    readonly detailJson: string;
  }>;
};

export type SubsystemSyncInput = {
  readonly clientHeadRevisionId: number;
  readonly revisions: readonly SubsystemSyncRevisionPayload[];
};

/**
 * Parse POST `/api/subsystem-sync` JSON. Returns null if the shape is invalid.
 */
export function parseSubsystemSyncHttpBody(body: unknown): {
  readonly workspaceId: string;
  readonly input: SubsystemSyncInput;
} | null {
  if (body === null || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const workspaceId = o.workspaceId;
  if (
    typeof workspaceId !== "string" ||
    !isValidSubsystemWorkspaceId(workspaceId)
  ) {
    return null;
  }
  const ch = o.clientHeadRevisionId;
  if (
    typeof ch !== "number" ||
    !Number.isInteger(ch) ||
    ch < 0 ||
    ch > Number.MAX_SAFE_INTEGER
  ) {
    return null;
  }
  const revsRaw = o.revisions;
  if (!Array.isArray(revsRaw)) return null;
  const revisions: SubsystemSyncRevisionPayload[] = [];
  for (const item of revsRaw) {
    if (item === null || typeof item !== "object") return null;
    const r = item as Record<string, unknown>;
    if (
      typeof r.id !== "number" ||
      !Number.isInteger(r.id) ||
      r.id < 1 ||
      r.id > Number.MAX_SAFE_INTEGER
    ) {
      return null;
    }
    const parentRevisionId = r.parentRevisionId;
    if (
      parentRevisionId !== null &&
      (typeof parentRevisionId !== "number" ||
        !Number.isInteger(parentRevisionId) ||
        parentRevisionId < 1)
    ) {
      return null;
    }
    if (typeof r.createdAtIso !== "string" || r.createdAtIso === "") {
      return null;
    }
    if (!Array.isArray(r.fileChanges)) return null;
    const fileChanges: Array<{ path: string; content: string | null }> = [];
    for (const fc of r.fileChanges) {
      if (fc === null || typeof fc !== "object") return null;
      const f = fc as Record<string, unknown>;
      if (typeof f.path !== "string" || f.path === "") return null;
      if (f.content !== null && typeof f.content !== "string") return null;
      fileChanges.push({ path: f.path, content: f.content as string | null });
    }
    let tags: SubsystemSyncRevisionPayload["tags"];
    if (r.tags !== undefined) {
      if (!Array.isArray(r.tags)) return null;
      const tagRows: Array<{
        name: string;
        createdAtIso: string;
        updatedAtIso: string;
      }> = [];
      for (const t of r.tags) {
        if (t === null || typeof t !== "object") return null;
        const tr = t as Record<string, unknown>;
        if (
          typeof tr.name !== "string" ||
          tr.name === "" ||
          typeof tr.createdAtIso !== "string" ||
          typeof tr.updatedAtIso !== "string"
        ) {
          return null;
        }
        tagRows.push({
          name: tr.name,
          createdAtIso: tr.createdAtIso,
          updatedAtIso: tr.updatedAtIso,
        });
      }
      tags = tagRows;
    }
    let promotions: SubsystemSyncRevisionPayload["promotions"];
    if (r.promotions !== undefined) {
      if (!Array.isArray(r.promotions)) return null;
      const promoRows: Array<{
        id: number;
        kind: string;
        createdAtIso: string;
        detailJson: string;
      }> = [];
      for (const p of r.promotions) {
        if (p === null || typeof p !== "object") return null;
        const pr = p as Record<string, unknown>;
        if (
          typeof pr.id !== "number" ||
          !Number.isInteger(pr.id) ||
          pr.id < 1 ||
          typeof pr.kind !== "string" ||
          pr.kind === "" ||
          typeof pr.createdAtIso !== "string" ||
          typeof pr.detailJson !== "string"
        ) {
          return null;
        }
        promoRows.push({
          id: pr.id,
          kind: pr.kind,
          createdAtIso: pr.createdAtIso,
          detailJson: pr.detailJson,
        });
      }
      promotions = promoRows;
    }
    revisions.push({
      id: r.id,
      parentRevisionId,
      createdAtIso: r.createdAtIso,
      fileChanges,
      ...(tags !== undefined ? { tags } : {}),
      ...(promotions !== undefined ? { promotions } : {}),
    });
  }
  return {
    workspaceId,
    input: { clientHeadRevisionId: ch, revisions },
  };
}

export type SubsystemSyncApplied = {
  readonly status: "applied";
  readonly serverHeadRevisionId: number;
  readonly appliedRevisionIds: readonly number[];
  readonly clientBehindServer: false;
};

export type SubsystemSyncNoop = {
  readonly status: "noop";
  readonly serverHeadRevisionId: number;
  readonly appliedRevisionIds: readonly number[];
  readonly clientBehindServer: boolean;
};

export type SubsystemSyncFork = {
  readonly status: "fork";
  readonly serverHeadRevisionId: number;
  readonly message: string;
};

export type SubsystemSyncResult =
  | SubsystemSyncApplied
  | SubsystemSyncNoop
  | SubsystemSyncFork;

function readHeadRevisionId(db: Database): number {
  const row = db
    .prepare(`SELECT value FROM store_metadata WHERE key = ?`)
    .get(META_HEAD_KEY) as { readonly value: string } | undefined;
  if (row === undefined) {
    throw new Error("subsystemServerSync: missing head revision metadata");
  }
  return parseInt(row.value, 10);
}

function setHeadRevisionId(db: Database, id: number): void {
  db.prepare(
    `INSERT INTO store_metadata (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(META_HEAD_KEY, String(id));
}

function revisionExists(db: Database, revisionId: number): boolean {
  const row = db
    .prepare(`SELECT 1 AS ok FROM revisions WHERE id = ?`)
    .get(revisionId) as { readonly ok: number } | undefined;
  return row !== undefined;
}

function promotionEventsForLiveGate(
  db: Database,
  revisionId: number,
): readonly { readonly kind: string; readonly detail: unknown }[] {
  const rows = db
    .prepare(
      `SELECT kind, detail_json FROM promotion_records WHERE revision_id = ? ORDER BY id ASC`,
    )
    .all(revisionId) as ReadonlyArray<{
    readonly kind: string;
    readonly detail_json: string;
  }>;
  return rows.map((r) => ({
    kind: r.kind,
    detail: JSON.parse(r.detail_json) as unknown,
  }));
}

/**
 * Apply a client-originated subsystem sync batch to the server replica (idempotent).
 */
export function applySubsystemReplicaSync(
  db: Database,
  input: SubsystemSyncInput,
): SubsystemSyncResult {
  return db.transaction(() => {
    const serverHead = readHeadRevisionId(db);

    if (input.revisions.length === 0) {
      if (input.clientHeadRevisionId < serverHead) {
        return {
          status: "noop" as const,
          serverHeadRevisionId: serverHead,
          appliedRevisionIds: [],
          clientBehindServer: true,
        };
      }
      if (input.clientHeadRevisionId === serverHead) {
        return {
          status: "noop" as const,
          serverHeadRevisionId: serverHead,
          appliedRevisionIds: [],
          clientBehindServer: false,
        };
      }
      return {
        status: "fork" as const,
        serverHeadRevisionId: serverHead,
        message: "empty_batch_but_client_head_ahead",
      };
    }

    const sorted = [...input.revisions].sort((a, b) => a.id - b.id);
    const missing = sorted.filter((r) => !revisionExists(db, r.id));

    if (missing.length === 0) {
      if (input.clientHeadRevisionId !== serverHead) {
        return {
          status: "fork" as const,
          serverHeadRevisionId: serverHead,
          message: "idempotent_batch_head_mismatch",
        };
      }
      return {
        status: "noop" as const,
        serverHeadRevisionId: serverHead,
        appliedRevisionIds: sorted.map((r) => r.id),
        clientBehindServer: false,
      };
    }

    const first = missing[0]!;
    if (first.parentRevisionId !== serverHead) {
      return {
        status: "fork" as const,
        serverHeadRevisionId: serverHead,
        message: "non_linear_first_parent",
      };
    }
    for (let i = 1; i < missing.length; i++) {
      const prev = missing[i - 1]!;
      const cur = missing[i]!;
      if (cur.parentRevisionId !== prev.id) {
        return {
          status: "fork" as const,
          serverHeadRevisionId: serverHead,
          message: "non_linear_chain",
        };
      }
    }
    const tip = missing[missing.length - 1]!;
    if (tip.id !== input.clientHeadRevisionId) {
      return {
        status: "fork" as const,
        serverHeadRevisionId: serverHead,
        message: "client_head_not_tip",
      };
    }

    const appliedIds: number[] = [];
    const insRev = db.prepare(
      `INSERT INTO revisions (id, parent_revision_id, created_at_iso) VALUES (?, ?, ?)`,
    );
    const insFile = db.prepare(
      `INSERT INTO revision_file_changes (revision_id, path, content) VALUES (?, ?, ?)`,
    );
    const insTag = db.prepare(
      `INSERT INTO revision_tags (name, revision_id, created_at_iso, updated_at_iso)
       VALUES (@name, @revisionId, @createdAt, @updatedAt)
       ON CONFLICT(name) DO UPDATE SET
         revision_id = excluded.revision_id,
         updated_at_iso = excluded.updated_at_iso`,
    );
    const insPromo = db.prepare(
      `INSERT INTO promotion_records (id, revision_id, kind, created_at_iso, detail_json)
       VALUES (@id, @revisionId, @kind, @createdAt, @detailJson)`,
    );

    for (const rev of missing) {
      insRev.run(rev.id, rev.parentRevisionId, rev.createdAtIso);
      for (const ch of rev.fileChanges) {
        insFile.run(rev.id, ch.path, ch.content);
      }
      if (rev.promotions !== undefined) {
        for (const p of rev.promotions) {
          insPromo.run({
            id: p.id,
            revisionId: rev.id,
            kind: p.kind,
            createdAt: p.createdAtIso,
            detailJson: p.detailJson,
          });
        }
      }
      if (rev.tags !== undefined) {
        for (const t of rev.tags) {
          if (t.name === SUBSYSTEM_LIVE_REVISION_TAG_NAME) {
            assertRevisionEligibleForLiveTag(
              promotionEventsForLiveGate(db, rev.id),
            );
          }
          insTag.run({
            name: t.name,
            revisionId: rev.id,
            createdAt: t.createdAtIso,
            updatedAt: t.updatedAtIso,
          });
        }
      }
      appliedIds.push(rev.id);
    }

    setHeadRevisionId(db, input.clientHeadRevisionId);

    return {
      status: "applied" as const,
      serverHeadRevisionId: input.clientHeadRevisionId,
      appliedRevisionIds: appliedIds,
      clientBehindServer: false as const,
    };
  })();
}

/** Opened server replica: exposes the store API plus raw `Database` for sync apply. */
export class ServerSubsystemReplicaStore {
  constructor(
    private readonly store: SubsystemWalStore,
    private readonly db: Database,
  ) {}

  getDatabase(): Database {
    return this.db;
  }

  getHeadRevisionId(): number {
    return this.store.getHeadRevisionId();
  }

  getFilesAtRevision(revisionId: number): Map<string, string> {
    return this.store.getFilesAtRevision(revisionId);
  }

  getRevisionTag(name: string): number | undefined {
    return this.store.getRevisionTag(name);
  }

  close(): void {
    this.store.close();
  }
}

export function openServerSubsystemReplicaStore(
  dbPath: string,
): ServerSubsystemReplicaStore {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new BetterSqlite3(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrateSubsystemWalStore(db);
  return new ServerSubsystemReplicaStore(new SubsystemWalStore(db), db);
}

const replicaSingletonByWorkspace = new Map<
  string,
  ServerSubsystemReplicaStore
>();

export function getServerSubsystemReplicaStoreForWorkspace(
  packageRoot: string,
  workspaceId: string,
): ServerSubsystemReplicaStore {
  if (!isValidSubsystemWorkspaceId(workspaceId)) {
    throw new Error("subsystemServerSync: invalid workspace id");
  }
  let s = replicaSingletonByWorkspace.get(workspaceId);
  if (s !== undefined) return s;
  const p = resolveServerSubsystemReplicaDbPath(packageRoot, workspaceId);
  s = openServerSubsystemReplicaStore(p);
  replicaSingletonByWorkspace.set(workspaceId, s);
  return s;
}

/** Test helper: close cached replicas so the next open uses fresh files. */
export function resetServerSubsystemReplicaStoreSingletonForTests(): void {
  for (const s of replicaSingletonByWorkspace.values()) {
    s.close();
  }
  replicaSingletonByWorkspace.clear();
}
