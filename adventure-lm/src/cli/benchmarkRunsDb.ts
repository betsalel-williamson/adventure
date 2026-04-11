import fs from "node:fs";
import path from "node:path";
import BetterSqlite3 from "better-sqlite3";
import type { Database } from "better-sqlite3";
import type { HostRuntimeInfo } from "./hostRuntimeInfo.js";
import type { GitWorktreeMeta } from "./gitWorktreeMeta.js";

export type BenchmarkRunStatus = "completed" | "failed" | "aborted";

export type BenchmarkRunConfigJson = {
  readonly maxMoves: number;
  readonly paceMs: number;
  readonly contextChars: number;
  readonly providerId: string;
  readonly modelId: string;
  readonly projectId: string | null;
  readonly strategyId: string | null;
  readonly eventId: string | null;
  readonly teamName: string | null;
  readonly tags: readonly string[];
};

export type BenchmarkRunMetricsJson = {
  readonly moves: number;
  readonly cellsDiscovered: number;
  readonly wallTimeMs: number;
  readonly plannerMsTotal: number;
  readonly plannerCalls: number;
  readonly hitMaxMoves: boolean;
};

let dbSingleton: Database | null = null;

/** Test helper: close singleton so the next open uses a fresh path. */
export function resetBenchmarkRunsDbSingleton(): void {
  if (dbSingleton) {
    dbSingleton.close();
    dbSingleton = null;
  }
}

function benchmarkRunsDisabled(): boolean {
  const v = process.env.ADVENTURE_LM_BENCHMARK_RUNS?.trim().toLowerCase();
  return v === "0" || v === "false" || v === "no";
}

export function resolveBenchmarkRunsDbPath(packageRoot: string): string {
  const v = process.env.ADVENTURE_LM_BENCHMARK_DB?.trim();
  if (v && v.length > 0) return path.resolve(v);
  return path.join(packageRoot, ".cache", "benchmark-runs.db");
}

export function openBenchmarkRunsDb(packageRoot: string): Database | null {
  if (benchmarkRunsDisabled()) return null;
  if (dbSingleton !== null) return dbSingleton;

  const dbPath = resolveBenchmarkRunsDbPath(packageRoot);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new BetterSqlite3(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS benchmark_runs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      event_id TEXT,
      dashboard_session_id TEXT,
      team_name TEXT,
      project_id TEXT,
      strategy_id TEXT,
      git_sha TEXT,
      git_dirty INTEGER NOT NULL DEFAULT 0,
      host_json TEXT NOT NULL,
      config_json TEXT NOT NULL,
      metrics_json TEXT NOT NULL,
      status TEXT NOT NULL,
      failure_reason TEXT,
      llm_session_jsonl_path TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_benchmark_runs_event ON benchmark_runs(event_id);
    CREATE INDEX IF NOT EXISTS idx_benchmark_runs_status ON benchmark_runs(status);
    CREATE INDEX IF NOT EXISTS idx_benchmark_runs_created ON benchmark_runs(created_at);
  `);
  dbSingleton = db;
  return db;
}

export function insertBenchmarkRunRow(input: {
  readonly id: string;
  readonly createdAtIso: string;
  readonly eventId: string | null;
  readonly dashboardSessionId: string;
  readonly teamName: string | null;
  readonly projectId: string | null;
  readonly strategyId: string | null;
  readonly git: GitWorktreeMeta;
  readonly host: HostRuntimeInfo;
  readonly config: BenchmarkRunConfigJson;
  readonly metrics: BenchmarkRunMetricsJson;
  readonly status: BenchmarkRunStatus;
  readonly failureReason: string | null;
  readonly llmSessionJsonlPath: string | null;
}): void {
  const db = dbSingleton;
  if (!db) return;
  const stmt = db.prepare(`
    INSERT INTO benchmark_runs (
      id, created_at, event_id, dashboard_session_id, team_name, project_id, strategy_id,
      git_sha, git_dirty, host_json, config_json, metrics_json, status, failure_reason,
      llm_session_jsonl_path
    ) VALUES (
      @id, @created_at, @event_id, @dashboard_session_id, @team_name, @project_id, @strategy_id,
      @git_sha, @git_dirty, @host_json, @config_json, @metrics_json, @status, @failure_reason,
      @llm_session_jsonl_path
    )
  `);
  stmt.run({
    id: input.id,
    created_at: input.createdAtIso,
    event_id: input.eventId,
    dashboard_session_id: input.dashboardSessionId,
    team_name: input.teamName,
    project_id: input.projectId,
    strategy_id: input.strategyId,
    git_sha: input.git.commitSha,
    git_dirty: input.git.dirty ? 1 : 0,
    host_json: JSON.stringify(input.host),
    config_json: JSON.stringify(input.config),
    metrics_json: JSON.stringify(input.metrics),
    status: input.status,
    failure_reason: input.failureReason,
    llm_session_jsonl_path: input.llmSessionJsonlPath,
  });
}

export type LeaderboardRow = {
  readonly id: string;
  readonly created_at: string;
  readonly team_name: string | null;
  readonly project_id: string | null;
  readonly strategy_id: string | null;
  readonly status: string;
  readonly cellsDiscovered: number;
  readonly moves: number;
  readonly wallTimeMs: number;
  readonly plannerMsTotal: number;
  readonly hitMaxMoves: boolean;
};

export function queryBenchmarkLeaderboard(
  db: Database,
  opts: {
    readonly eventId?: string | null;
    readonly includeFailed: boolean;
    readonly sort:
      | "cellsDiscovered"
      | "moves"
      | "wallTimeMs"
      | "plannerMsTotal";
    readonly limit: number;
  },
): LeaderboardRow[] {
  const sortCol =
    opts.sort === "cellsDiscovered"
      ? "json_extract(metrics_json, '$.cellsDiscovered')"
      : opts.sort === "moves"
        ? "json_extract(metrics_json, '$.moves')"
        : opts.sort === "wallTimeMs"
          ? "json_extract(metrics_json, '$.wallTimeMs')"
          : "json_extract(metrics_json, '$.plannerMsTotal')";

  const statusClause = opts.includeFailed ? "" : `AND status = 'completed'`;
  const eventClause =
    opts.eventId !== undefined && opts.eventId !== null && opts.eventId !== ""
      ? "AND event_id = @event_id"
      : "";

  const sql = `
    SELECT id, created_at, team_name, project_id, strategy_id, status, metrics_json
    FROM benchmark_runs
    WHERE 1=1 ${statusClause} ${eventClause}
    ORDER BY ${sortCol} DESC, created_at DESC
    LIMIT @limit
  `;
  const stmt = db.prepare(sql);
  const rows = stmt.all({
    ...(opts.eventId ? { event_id: opts.eventId } : {}),
    limit: opts.limit,
  }) as Array<{
    id: string;
    created_at: string;
    team_name: string | null;
    project_id: string | null;
    strategy_id: string | null;
    status: string;
    metrics_json: string;
  }>;

  return rows.map((r) => {
    const m = JSON.parse(r.metrics_json) as BenchmarkRunMetricsJson;
    return {
      id: r.id,
      created_at: r.created_at,
      team_name: r.team_name,
      project_id: r.project_id,
      strategy_id: r.strategy_id,
      status: r.status,
      cellsDiscovered: m.cellsDiscovered,
      moves: m.moves,
      wallTimeMs: m.wallTimeMs,
      plannerMsTotal: m.plannerMsTotal,
      hitMaxMoves: m.hitMaxMoves,
    };
  });
}
