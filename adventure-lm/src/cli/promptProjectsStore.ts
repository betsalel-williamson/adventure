import {
  mkdir,
  readdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import type { PromptExperimentPatch } from "@adventure-lm/lm-glue";

export const PROMPT_PROJECT_SCHEMA_LATEST = 2 as const;

export type PromptProjectSubsystemToggles = {
  readonly inventory?: boolean;
  readonly graph?: boolean;
  readonly xyz?: boolean;
  readonly reactionLedger?: boolean;
};

export type PromptProjectGenerationParams = {
  readonly mlx?: { readonly maxTokens?: number; readonly temperature?: number };
  readonly http?: {
    readonly temperature?: number;
    readonly maxTokens?: number;
  };
  readonly google?: {
    readonly temperature?: number;
    readonly maxOutputTokens?: number;
  };
};

export type PromptProjectStrategyRef = {
  readonly id: string;
  readonly notes?: string;
};

export type PromptProjectRecord = {
  readonly schemaVersion: 1 | typeof PROMPT_PROJECT_SCHEMA_LATEST;
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly promptExperiment: PromptExperimentPatch;
  readonly generationParams: PromptProjectGenerationParams;
  readonly subsystemToggles: PromptProjectSubsystemToggles;
  readonly maxMoves?: number;
  readonly tags?: readonly string[];
  readonly teamName?: string;
  readonly parentProjectId?: string;
  readonly strategy?: PromptProjectStrategyRef;
  readonly envAllowlist?: Readonly<Record<string, string>>;
};

export type PromptProjectListEntry = Pick<
  PromptProjectRecord,
  "id" | "name" | "updatedAt" | "description" | "tags" | "teamName"
>;

function safeId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

function projectPath(dir: string, id: string): string {
  return path.join(dir, `${id}.json`);
}

export function resolvePromptProjectsDir(packageRoot: string): string {
  const v = process.env.ADVENTURE_LM_PROMPT_PROJECTS_DIR?.trim();
  const base =
    v && v.length > 0
      ? path.resolve(v)
      : path.join(packageRoot, ".prompt-projects");
  return base;
}

export async function ensurePromptProjectsDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

function isSchemaVersion(v: unknown): v is 1 | 2 {
  return v === 1 || v === 2;
}

function normalizeMaxMoves(v: unknown): number | undefined {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1 || n > 1_000_000) return undefined;
  return Math.floor(n);
}

function normalizeTags(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string") continue;
    const t = x.trim().slice(0, 120);
    if (t.length > 0) out.push(t);
    if (out.length >= 64) break;
  }
  return out.length > 0 ? out : undefined;
}

/** Parse disk JSON into a valid record, or null. Accepts legacy schema v1. */
export function parsePromptProjectJson(
  raw: unknown,
  fileId: string,
): PromptProjectRecord | null {
  if (raw === null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || o.id !== fileId) return null;
  if (!isSchemaVersion(o.schemaVersion)) return null;
  if (
    typeof o.name !== "string" ||
    typeof o.createdAt !== "string" ||
    typeof o.updatedAt !== "string" ||
    typeof o.promptExperiment !== "object" ||
    o.promptExperiment === null ||
    typeof o.generationParams !== "object" ||
    o.generationParams === null ||
    typeof o.subsystemToggles !== "object" ||
    o.subsystemToggles === null
  ) {
    return null;
  }
  const maxMoves = normalizeMaxMoves(o.maxMoves);
  const tags = normalizeTags(o.tags);
  const teamName =
    typeof o.teamName === "string"
      ? o.teamName.trim().slice(0, 120)
      : undefined;
  const parentProjectId =
    typeof o.parentProjectId === "string" && safeId(o.parentProjectId)
      ? o.parentProjectId
      : undefined;
  let strategy: PromptProjectStrategyRef | undefined;
  if (o.strategy !== undefined && o.strategy !== null) {
    const s = o.strategy as Record<string, unknown>;
    if (typeof s.id === "string" && s.id.trim().length > 0) {
      strategy = {
        id: s.id.trim().slice(0, 64),
        ...(typeof s.notes === "string"
          ? { notes: s.notes.trim().slice(0, 2000) }
          : {}),
      };
    }
  }
  let envAllowlist: Record<string, string> | undefined;
  if (o.envAllowlist !== undefined && o.envAllowlist !== null) {
    const e = o.envAllowlist as Record<string, unknown>;
    envAllowlist = {};
    for (const [k, v] of Object.entries(e)) {
      if (typeof k !== "string" || typeof v !== "string") continue;
      envAllowlist[k] = v;
    }
    if (Object.keys(envAllowlist).length === 0) envAllowlist = undefined;
  }

  const base: PromptProjectRecord = {
    schemaVersion: o.schemaVersion,
    id: o.id,
    name: o.name,
    ...(typeof o.description === "string"
      ? { description: o.description.trim().slice(0, 2000) }
      : {}),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    promptExperiment: o.promptExperiment as PromptExperimentPatch,
    generationParams: o.generationParams as PromptProjectGenerationParams,
    subsystemToggles: o.subsystemToggles as PromptProjectSubsystemToggles,
    ...(maxMoves !== undefined ? { maxMoves } : {}),
    ...(tags ? { tags } : {}),
    ...(teamName ? { teamName } : {}),
    ...(parentProjectId ? { parentProjectId } : {}),
    ...(strategy ? { strategy } : {}),
    ...(envAllowlist ? { envAllowlist } : {}),
  };
  return base;
}

/** Upgrade to latest schema for new writes (preserves createdAt). */
export function upgradePromptProjectToLatest(
  rec: PromptProjectRecord,
): PromptProjectRecord {
  if (rec.schemaVersion === PROMPT_PROJECT_SCHEMA_LATEST) return rec;
  return {
    ...rec,
    schemaVersion: PROMPT_PROJECT_SCHEMA_LATEST,
  };
}

export async function listPromptProjects(
  dir: string,
): Promise<PromptProjectListEntry[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const out: PromptProjectListEntry[] = [];
  for (const f of names) {
    if (!f.endsWith(".json")) continue;
    const id = f.slice(0, -5);
    if (!safeId(id)) continue;
    try {
      const raw = JSON.parse(
        await readFile(path.join(dir, f), "utf8"),
      ) as unknown;
      const rec = parsePromptProjectJson(raw, id);
      if (!rec) continue;
      out.push({
        id: rec.id,
        name: rec.name,
        updatedAt: rec.updatedAt,
        description: rec.description,
        tags: rec.tags,
        teamName: rec.teamName,
      });
    } catch {
      /* skip corrupt */
    }
  }
  out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return out;
}

export async function readPromptProject(
  dir: string,
  id: string,
): Promise<PromptProjectRecord | null> {
  if (!safeId(id)) return null;
  try {
    const raw = JSON.parse(
      await readFile(projectPath(dir, id), "utf8"),
    ) as unknown;
    return parsePromptProjectJson(raw, id);
  } catch {
    return null;
  }
}

export async function writePromptProject(
  dir: string,
  record: PromptProjectRecord,
): Promise<void> {
  if (!safeId(record.id)) throw new Error("Invalid project id");
  await ensurePromptProjectsDir(dir);
  const toWrite = upgradePromptProjectToLatest(record);
  const tmp = projectPath(dir, `${record.id}.tmp`);
  const finalPath = projectPath(dir, record.id);
  await writeFile(tmp, `${JSON.stringify(toWrite, null, 2)}\n`, "utf8");
  await rename(tmp, finalPath);
}

export async function deletePromptProject(
  dir: string,
  id: string,
): Promise<boolean> {
  if (!safeId(id)) return false;
  try {
    await unlink(projectPath(dir, id));
    return true;
  } catch {
    return false;
  }
}

export function newPromptProjectId(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
