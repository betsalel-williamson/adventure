/**
 * Schema migrations for the client-authoritative subsystem SQLite store (ADR0006).
 * Run the same SQL on browser WASM SQLite (wa-sqlite, sql.js, etc.) for parity with Node tests.
 */

/** Monotonic migration id; bump when adding a new `MIGRATION_SQL` entry. */
export const SUBSYSTEM_WAL_STORE_SCHEMA_VERSION = 2 as const;

/**
 * Ordered migrations: index i applies version i+1 (PRAGMA user_version becomes i+1).
 */
export const SUBSYSTEM_WAL_STORE_MIGRATIONS: readonly string[] = [
  `
    CREATE TABLE IF NOT EXISTS store_metadata (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_revision_id INTEGER NULL REFERENCES revisions(id),
      created_at_iso TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_revisions_parent ON revisions(parent_revision_id);

    CREATE TABLE IF NOT EXISTS revision_file_changes (
      revision_id INTEGER NOT NULL REFERENCES revisions(id),
      path TEXT NOT NULL,
      content TEXT NULL,
      PRIMARY KEY (revision_id, path)
    );

    CREATE INDEX IF NOT EXISTS idx_revision_file_changes_rev ON revision_file_changes(revision_id);

    CREATE TABLE IF NOT EXISTS promotion_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      revision_id INTEGER NOT NULL REFERENCES revisions(id),
      kind TEXT NOT NULL,
      created_at_iso TEXT NOT NULL,
      detail_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_promotion_records_revision ON promotion_records(revision_id);
  `,
  `
    CREATE TABLE IF NOT EXISTS revision_tags (
      name TEXT PRIMARY KEY NOT NULL,
      revision_id INTEGER NOT NULL REFERENCES revisions(id),
      created_at_iso TEXT NOT NULL,
      updated_at_iso TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_revision_tags_revision ON revision_tags(revision_id);
  `,
];

/** All migrations concatenated for one-shot bootstrap (e.g. wasm); name kept for callers. */
export const SUBSYSTEM_WAL_STORE_MIGRATION_SQL_V1 =
  SUBSYSTEM_WAL_STORE_MIGRATIONS.join("\n");
