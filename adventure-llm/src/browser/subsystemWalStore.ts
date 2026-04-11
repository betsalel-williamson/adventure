import fs from "node:fs";
import path from "node:path";
import BetterSqlite3 from "better-sqlite3";
import type { Database } from "better-sqlite3";
import {
  assertRevisionEligibleForLiveTag,
  SUBSYSTEM_LIVE_REVISION_TAG_NAME,
} from "./subsystemPromoteGate.js";
import { SUBSYSTEM_WAL_STORE_MIGRATIONS } from "./subsystemWalStoreMigrations.js";

const META_HEAD_KEY = "head_revision_id" as const;

export type SubsystemFileChange = {
  readonly path: string;
  /** `null` removes the path in this revision (tombstone). */
  readonly content: string | null;
};

export type PromotionEventRow = {
  readonly id: number;
  readonly kind: string;
  readonly createdAtIso: string;
  readonly detail: unknown;
};

export type RevisionTagRow = {
  readonly name: string;
  readonly revisionId: number;
};

/**
 * Client-authoritative subsystem history in SQLite WAL mode (ADR0006).
 * Node/tests use better-sqlite3 on a temp file; the browser should run the same
 * migrations on WASM SQLite with a single writer (SharedWorker or workspace tab).
 */
export class SubsystemWalStore {
  /** Prefer {@link openSubsystemWalStore}; constructor accepts an already-migrated `Database`. */
  constructor(private readonly db: Database) {}

  close(): void {
    this.db.close();
  }

  getJournalMode(): string {
    const mode = this.db.pragma("journal_mode", { simple: true });
    return typeof mode === "string" ? mode : String(mode);
  }

  getHeadRevisionId(): number {
    const raw = this.getMetadataValue(META_HEAD_KEY);
    if (raw === undefined) {
      throw new Error("SubsystemWalStore: missing head revision metadata");
    }
    return parseInt(raw, 10);
  }

  getMetadata(key: string): string | undefined {
    return this.getMetadataValue(key);
  }

  setMetadata(key: string, value: string): void {
    this.setMetadataValue(key, value);
  }

  getFilesAtRevision(revisionId: number): Map<string, string> {
    const chain = this.revisionChainRootTo(revisionId);
    const files = new Map<string, string>();
    const select = this.db.prepare(
      `SELECT path, content FROM revision_file_changes WHERE revision_id = ?`,
    );
    for (const rev of chain) {
      const rows = select.all(rev) as ReadonlyArray<{
        readonly path: string;
        readonly content: string | null;
      }>;
      for (const r of rows) {
        if (r.content === null) {
          files.delete(r.path);
        } else {
          files.set(r.path, r.content);
        }
      }
    }
    return files;
  }

  appendRevision(input: {
    readonly expectedHeadRevisionId: number;
    readonly changes: readonly SubsystemFileChange[];
  }): number {
    return this.db.transaction(() => {
      const head = this.getHeadRevisionId();
      if (head !== input.expectedHeadRevisionId) {
        throw new Error(
          `SubsystemWalStore: head mismatch (expected ${input.expectedHeadRevisionId}, have ${head})`,
        );
      }
      const iso = new Date().toISOString();
      const inserted = this.db
        .prepare(
          `INSERT INTO revisions (parent_revision_id, created_at_iso) VALUES (?, ?)`,
        )
        .run(input.expectedHeadRevisionId, iso);
      const newId = Number(inserted.lastInsertRowid);
      const ins = this.db.prepare(
        `INSERT INTO revision_file_changes (revision_id, path, content) VALUES (?, ?, ?)`,
      );
      for (const c of input.changes) {
        ins.run(newId, c.path, c.content);
      }
      this.setMetadataValue(META_HEAD_KEY, String(newId));
      return newId;
    })();
  }

  recordPromotionEvent(input: {
    readonly revisionId: number;
    readonly kind: string;
    readonly detail: unknown;
  }): number {
    const row = this.db
      .prepare(
        `INSERT INTO promotion_records (revision_id, kind, created_at_iso, detail_json)
         VALUES (?, ?, ?, ?)`,
      )
      .run(
        input.revisionId,
        input.kind,
        new Date().toISOString(),
        JSON.stringify(input.detail ?? {}),
      );
    return Number(row.lastInsertRowid);
  }

  listPromotionEventsForRevision(
    revisionId: number,
  ): readonly PromotionEventRow[] {
    const rows = this.db
      .prepare(
        `SELECT id, kind, created_at_iso, detail_json FROM promotion_records
         WHERE revision_id = ? ORDER BY id ASC`,
      )
      .all(revisionId) as ReadonlyArray<{
      readonly id: number;
      readonly kind: string;
      readonly created_at_iso: string;
      readonly detail_json: string;
    }>;
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      createdAtIso: r.created_at_iso,
      detail: JSON.parse(r.detail_json) as unknown,
    }));
  }

  /**
   * ADR0007: Named pointer to a revision (e.g. release tag). Upserts by name.
   */
  putRevisionTag(input: {
    readonly name: string;
    readonly revisionId: number;
  }): void {
    this.assertRevisionExists(input.revisionId);
    if (input.name === SUBSYSTEM_LIVE_REVISION_TAG_NAME) {
      assertRevisionEligibleForLiveTag(
        this.listPromotionEventsForRevision(input.revisionId),
      );
    }
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO revision_tags (name, revision_id, created_at_iso, updated_at_iso)
         VALUES (@name, @revisionId, @now, @now)
         ON CONFLICT(name) DO UPDATE SET
           revision_id = excluded.revision_id,
           updated_at_iso = excluded.updated_at_iso`,
      )
      .run({
        name: input.name,
        revisionId: input.revisionId,
        now,
      });
  }

  /** ADR0007: Resolve a tag name to a revision id, if present. */
  getRevisionTag(name: string): number | undefined {
    const row = this.db
      .prepare(`SELECT revision_id FROM revision_tags WHERE name = ?`)
      .get(name) as { readonly revision_id: number } | undefined;
    return row?.revision_id;
  }

  /** ADR0007: List all tags (stable order by name). */
  listRevisionTags(): readonly RevisionTagRow[] {
    const rows = this.db
      .prepare(`SELECT name, revision_id FROM revision_tags ORDER BY name ASC`)
      .all() as ReadonlyArray<{
      readonly name: string;
      readonly revision_id: number;
    }>;
    return rows.map((r) => ({
      name: r.name,
      revisionId: r.revision_id,
    }));
  }

  /** ADR0007: Remove a tag. Returns whether a row was deleted. */
  deleteRevisionTag(name: string): boolean {
    const result = this.db
      .prepare(`DELETE FROM revision_tags WHERE name = ?`)
      .run(name);
    return result.changes > 0;
  }

  /**
   * ADR0007: Materialize the subsystem file tree at a revision for cognition replay
   * (same snapshot as {@link getFilesAtRevision}; explicit entry point for orchestration).
   */
  materializeReplayFiles(revisionId: number): Map<string, string> {
    return this.getFilesAtRevision(revisionId);
  }

  /**
   * ADR0007: Append a revision that restores every path touched in `revisionId` to its
   * state in the parent of `revisionId` (inverse of that revision's file delta), without
   * rewriting history.
   */
  appendRevisionReverting(input: {
    readonly expectedHeadRevisionId: number;
    readonly revisionId: number;
  }): number {
    const parentId = this.getParentRevisionId(input.revisionId);
    if (parentId === null) {
      throw new Error(
        "SubsystemWalStore: cannot revert the root revision (no parent)",
      );
    }
    const rows = this.db
      .prepare(
        `SELECT path FROM revision_file_changes WHERE revision_id = ? ORDER BY path ASC`,
      )
      .all(input.revisionId) as ReadonlyArray<{ readonly path: string }>;
    const filesAtParent = this.getFilesAtRevision(parentId);
    const changes: SubsystemFileChange[] = rows.map((r) => {
      const content = filesAtParent.get(r.path);
      return {
        path: r.path,
        content: content === undefined ? null : content,
      };
    });
    return this.appendRevision({
      expectedHeadRevisionId: input.expectedHeadRevisionId,
      changes,
    });
  }

  private assertRevisionExists(revisionId: number): void {
    const row = this.db
      .prepare(`SELECT 1 AS ok FROM revisions WHERE id = ?`)
      .get(revisionId) as { readonly ok: number } | undefined;
    if (!row) {
      throw new Error(`SubsystemWalStore: unknown revision ${revisionId}`);
    }
  }

  getParentRevisionId(revisionId: number): number | null {
    const row = this.db
      .prepare(`SELECT parent_revision_id FROM revisions WHERE id = ?`)
      .get(revisionId) as
      | { readonly parent_revision_id: number | null }
      | undefined;
    if (!row) {
      throw new Error(`SubsystemWalStore: unknown revision ${revisionId}`);
    }
    return row.parent_revision_id;
  }

  private revisionChainRootTo(revisionId: number): number[] {
    const backwards: number[] = [];
    let current: number | null = revisionId;
    while (current !== null) {
      backwards.push(current);
      const row = this.db
        .prepare(`SELECT parent_revision_id FROM revisions WHERE id = ?`)
        .get(current) as
        | { readonly parent_revision_id: number | null }
        | undefined;
      if (!row) {
        throw new Error(`SubsystemWalStore: unknown revision ${current}`);
      }
      current = row.parent_revision_id;
    }
    backwards.reverse();
    return backwards;
  }

  private getMetadataValue(key: string): string | undefined {
    const row = this.db
      .prepare(`SELECT value FROM store_metadata WHERE key = ?`)
      .get(key) as { readonly value: string } | undefined;
    return row?.value;
  }

  private setMetadataValue(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO store_metadata (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(key, value);
  }
}

export function migrateSubsystemWalStore(db: Database): void {
  db.transaction(() => {
    const rawVersion = db.pragma("user_version", { simple: true });
    let v =
      typeof rawVersion === "number"
        ? rawVersion
        : parseInt(String(rawVersion), 10);
    if (Number.isNaN(v)) v = 0;
    for (let i = v; i < SUBSYSTEM_WAL_STORE_MIGRATIONS.length; i++) {
      db.exec(SUBSYSTEM_WAL_STORE_MIGRATIONS[i]!);
      db.pragma(`user_version = ${i + 1}`);
    }
    ensureSubsystemWalBootstrap(db);
  })();
}

function ensureSubsystemWalBootstrap(db: Database): void {
  const row = db
    .prepare(`SELECT value FROM store_metadata WHERE key = ?`)
    .get(META_HEAD_KEY) as { readonly value: string } | undefined;
  if (row !== undefined) return;
  const iso = new Date().toISOString();
  const inserted = db
    .prepare(
      `INSERT INTO revisions (parent_revision_id, created_at_iso) VALUES (NULL, ?)`,
    )
    .run(iso);
  const id = Number(inserted.lastInsertRowid);
  db.prepare(`INSERT INTO store_metadata (key, value) VALUES (?, ?)`).run(
    META_HEAD_KEY,
    String(id),
  );
}

export function openSubsystemWalStore(dbPath: string): SubsystemWalStore {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new BetterSqlite3(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrateSubsystemWalStore(db);
  return new SubsystemWalStore(db);
}

/** Resolve a default path under the package (Node); browser code should pass an OPFS path. */
export function defaultSubsystemWalDbPath(packageRoot: string): string {
  return path.join(packageRoot, ".cache", "subsystem-wal.db");
}
