import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import type { InterpretedCommand } from "./schema.js";

/** JSONL log path; set explicitly or enable with `ADVENTURE_LLM_DEBUG=1` (defaults under cwd `.cache/`). */
export function resolveDebugLogPath(): string | null {
  const explicit = process.env.ADVENTURE_LLM_DEBUG_LOG?.trim();
  if (explicit) return path.resolve(explicit);
  const on = process.env.ADVENTURE_LLM_DEBUG?.trim();
  if (on === "1" || on?.toLowerCase() === "true") {
    return path.resolve(process.cwd(), ".cache", "llm-interactions.jsonl");
  }
  return null;
}

/** Directory for cached `InterpretedCommand` JSON files (`ADVENTURE_LLM_CACHE_DIR`). */
export function resolveCacheDir(): string | null {
  const d = process.env.ADVENTURE_LLM_CACHE_DIR?.trim();
  return d ? path.resolve(d) : null;
}

export function cacheKeyFor(userText: string, model: string): string {
  return createHash("sha256")
    .update(`${model}\n${userText}`, "utf8")
    .digest("hex");
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

/**
 * Append one JSON object per line (JSONL). No-op if debug logging is not configured.
 */
export async function appendInteractionLog(
  record: Record<string, unknown>,
): Promise<void> {
  const logPath = resolveDebugLogPath();
  if (!logPath) return;
  await mkdir(path.dirname(logPath), { recursive: true });
  const line =
    JSON.stringify({ ts: new Date().toISOString(), ...record }) + "\n";
  await appendFile(logPath, line, "utf8");
}
