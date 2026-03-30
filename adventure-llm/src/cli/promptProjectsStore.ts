import {
  mkdir,
  readdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import type { PromptExperimentPatch } from "../nl/promptExperiment.js";

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

export type PromptProjectRecord = {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly promptExperiment: PromptExperimentPatch;
  readonly generationParams: PromptProjectGenerationParams;
  readonly subsystemToggles: PromptProjectSubsystemToggles;
};

function safeId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

function projectPath(dir: string, id: string): string {
  return path.join(dir, `${id}.json`);
}

export function resolvePromptProjectsDir(packageRoot: string): string {
  const v = process.env.ADVENTURE_LLM_PROMPT_PROJECTS_DIR?.trim();
  const base =
    v && v.length > 0
      ? path.resolve(v)
      : path.join(packageRoot, ".prompt-projects");
  return base;
}

export async function ensurePromptProjectsDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function listPromptProjects(
  dir: string,
): Promise<
  Pick<PromptProjectRecord, "id" | "name" | "updatedAt" | "description">[]
> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const out: Pick<
    PromptProjectRecord,
    "id" | "name" | "updatedAt" | "description"
  >[] = [];
  for (const f of names) {
    if (!f.endsWith(".json")) continue;
    const id = f.slice(0, -5);
    if (!safeId(id)) continue;
    try {
      const raw = JSON.parse(
        await readFile(path.join(dir, f), "utf8"),
      ) as PromptProjectRecord;
      if (raw?.schemaVersion !== 1 || raw.id !== id) continue;
      out.push({
        id: raw.id,
        name: raw.name,
        updatedAt: raw.updatedAt,
        description: raw.description,
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
    ) as PromptProjectRecord;
    if (raw?.schemaVersion !== 1 || raw.id !== id) return null;
    return raw;
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
  const tmp = projectPath(dir, `${record.id}.tmp`);
  const finalPath = projectPath(dir, record.id);
  await writeFile(tmp, `${JSON.stringify(record, null, 2)}\n`, "utf8");
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
