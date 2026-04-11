import { AsyncLocalStorage } from "node:async_hooks";
import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import type { InterpretedCommand } from "@adventure-llm/nl-glue";
import {
  DEFAULT_INTERPRET_CACHE_SCHEMA_VERSION,
  interpretCacheKeyMaterialHash,
  interpretCacheSchemaVersion,
} from "./interpretCacheKeyMaterial.js";

function isWebDashboardLogSessionId(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s,
  );
}

/** When set (web dashboard LLM queue), JSONL goes under `.cache/llm-sessions/<id>.jsonl` unless `ADVENTURE_LLM_DEBUG_LOG` is set. */
const webDashboardLlmLogContext = new AsyncLocalStorage<{
  sessionId: string;
}>();

export function runWithWebDashboardLlmLogContext<T>(
  sessionId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return webDashboardLlmLogContext.run({ sessionId }, fn);
}

/** JSONL log path; set explicitly or enable with `ADVENTURE_LLM_DEBUG=1` (defaults under cwd `.cache/`). */
export function resolveDebugLogPath(): string | null {
  const explicit = process.env.ADVENTURE_LLM_DEBUG_LOG?.trim();
  if (explicit) return path.resolve(explicit);
  const on = process.env.ADVENTURE_LLM_DEBUG?.trim();
  if (on === "1" || on?.toLowerCase() === "true") {
    const store = webDashboardLlmLogContext.getStore();
    if (store?.sessionId && isWebDashboardLogSessionId(store.sessionId)) {
      return path.resolve(
        process.cwd(),
        ".cache",
        "llm-sessions",
        `${store.sessionId}.jsonl`,
      );
    }
    return path.resolve(process.cwd(), ".cache", "llm-interactions.jsonl");
  }
  return null;
}

/** Directory for cached `InterpretedCommand` JSON files (`ADVENTURE_LLM_CACHE_DIR`). */
export function resolveCacheDir(): string | null {
  const d = process.env.ADVENTURE_LLM_CACHE_DIR?.trim();
  return d ? path.resolve(d) : null;
}

export {
  DEFAULT_INTERPRET_CACHE_SCHEMA_VERSION,
  interpretCacheKeyMaterialHash,
  interpretCacheSchemaVersion,
};

/**
 * @deprecated Prefer {@link interpretCacheKeyFromBuildOptions} in `interpretCacheKey.js` — includes
 * recent game text and layout. This legacy key omits context (empty slice); used for tests only.
 */
export function cacheKeyFor(
  userText: string,
  model: string,
  providerId?: string,
): string {
  return interpretCacheKeyMaterialHash([
    providerId ?? "",
    model,
    userText,
    "compact=false;structured=false",
    "",
  ]);
}

export function cacheFilePath(cacheDir: string, key: string): string {
  return path.join(cacheDir, `${key}.json`);
}

export async function readCachedInterpreted(
  cacheDir: string,
  key: string,
): Promise<InterpretedCommand | null> {
  const p = cacheFilePath(cacheDir, key);
  try {
    const raw = await readFile(p, "utf8");
    return JSON.parse(raw) as InterpretedCommand;
  } catch {
    return null;
  }
}

export async function writeCachedInterpreted(
  cacheDir: string,
  key: string,
  cmd: InterpretedCommand,
): Promise<void> {
  await mkdir(cacheDir, { recursive: true });
  const p = cacheFilePath(cacheDir, key);
  await writeFile(p, `${JSON.stringify(cmd, null, 2)}\n`, "utf8");
}

function resolveDebugMaxPromptChars(): number {
  const v = process.env.ADVENTURE_LLM_DEBUG_MAX_PROMPT_CHARS?.trim();
  if (v === undefined || v === "") return 50_000;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 50_000;
}

function truncateLogString(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…[truncated ${s.length - max} chars]`;
}

/**
 * Truncate long prompt fields before writing JSONL (`ADVENTURE_LLM_DEBUG_MAX_PROMPT_CHARS`, default 50000).
 */
export function sanitizeInteractionLogRecord(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const max = resolveDebugMaxPromptChars();
  if (max <= 0) return record;
  const out: Record<string, unknown> = { ...record };
  for (const key of ["prompt", "system", "user", "rawJson"] as const) {
    const v = out[key];
    if (typeof v === "string") out[key] = truncateLogString(v, max);
  }
  return out;
}

/**
 * Append one JSON object per line (JSONL). No-op if debug logging is not configured.
 */
export async function appendInteractionLog(
  record: Record<string, unknown>,
): Promise<void> {
  const logPath = resolveDebugLogPath();
  if (!logPath) return;
  await mkdir(path.dirname(logPath), { recursive: true });
  const store = webDashboardLlmLogContext.getStore();
  const extra =
    store?.sessionId !== undefined
      ? { sessionId: store.sessionId }
      : ({} as Record<string, unknown>);
  const safe = sanitizeInteractionLogRecord(record);
  const line =
    JSON.stringify({
      ts: new Date().toISOString(),
      ...extra,
      ...safe,
    }) + "\n";
  await appendFile(logPath, line, "utf8");
}
