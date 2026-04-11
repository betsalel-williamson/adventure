/**
 * Load web dashboard text-LLM provider/model allowlists from {@link ../../text-llm-web-presets.yaml}.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

const ModelEntrySchema = z.union([
  z.string().min(1),
  z.object({
    id: z.string().min(1),
    label: z.string().optional(),
  }),
]);

const ProviderBlockSchema = z.object({
  models: z.array(ModelEntrySchema).optional(),
});

const RootSchema = z.object({
  version: z.number().optional(),
  providers: z
    .object({
      mlx: ProviderBlockSchema.optional(),
      http: ProviderBlockSchema.optional(),
      /** @deprecated Prefer `providers.api.google`. */
      google: ProviderBlockSchema.optional(),
      /**
       * Hosted API vendors. `google` powers {@link TextLlmWebPresetsNormalized.google}.
       * Other keys (e.g. `openai`) are parsed into {@link TextLlmWebPresetsNormalized.futureApiProviders}
       * until a matching dashboard text-LLM provider is implemented.
       */
      api: z.record(ProviderBlockSchema).optional(),
    })
    .optional(),
});

export type TextLlmWebPresetsNormalized = {
  readonly mlx: readonly string[];
  readonly http: readonly string[];
  readonly google: readonly string[];
  /**
   * Model allowlists for API vendors besides `google` (e.g. `openai` for ChatGPT).
   * Inert in the dashboard until a first-class provider is implemented.
   */
  readonly futureApiProviders: Readonly<Record<string, readonly string[]>>;
};

export type ParsedWebPresetsYaml = {
  mlx: string[];
  http: string[];
  google: string[];
  futureApiProviders: Record<string, string[]>;
};

function entryId(e: z.infer<typeof ModelEntrySchema>): string {
  return (typeof e === "string" ? e : e.id).trim();
}

/**
 * A→Z ordering for dashboard model pickers (locale-aware; numeric substrings sort naturally).
 */
export function sortWebDashboardModelIds(ids: readonly string[]): string[] {
  return [...ids].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }),
  );
}

function modelsFromBlock(
  block: z.infer<typeof ProviderBlockSchema> | undefined,
): string[] {
  if (!block?.models) return [];
  return block.models.map(entryId).filter((s) => s.length > 0);
}

/** In-process snapshot; restart the web server (or tests call reset) to reload the YAML file. */
let cached: TextLlmWebPresetsNormalized | null = null;

function adventureLlmPackageRoot(): string {
  return path.join(fileURLToPath(new URL(".", import.meta.url)), "../..");
}

function defaultConfigPath(): string {
  return path.join(adventureLlmPackageRoot(), "text-llm-web-presets.yaml");
}

function resolveConfigPath(): string {
  const fromEnv = process.env.ADVENTURE_LM_WEB_PRESETS_YAML?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return defaultConfigPath();
}

/** Default Gemini text/chat ids; order mirrors `text-llm-web-presets.yaml` and the models index. @see https://ai.google.dev/gemini-api/docs/models */
const DEFAULT_GOOGLE_TEXT_MODELS: readonly string[] = [
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-flash-latest",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
];

/** Used when the YAML file is missing (same defaults as shipped `text-llm-web-presets.yaml`). */
export const DEFAULT_TEXT_LLM_WEB_PRESETS: TextLlmWebPresetsNormalized =
  Object.freeze({
    mlx: Object.freeze([
      "mlx-community/gemma-2-2b-it",
      "mlx-community/Qwen2.5-1.5B-Instruct-4bit",
      "mlx-community/Llama-3.2-3B-Instruct-4bit",
      "mlx-community/Qwen2.5-3B-Instruct-4bit",
      "mlx-community/Phi-4-mini-instruct-4bit",
      "mlx-community/Mistral-7B-Instruct-v0.3-4bit",
      "mlx-community/Qwen2.5-7B-Instruct-4bit",
      "mlx-community/gemma-2-9b-it-4bit",
    ]),
    http: Object.freeze([]),
    google: Object.freeze([...DEFAULT_GOOGLE_TEXT_MODELS]),
    futureApiProviders: Object.freeze({}),
  });

function futureApiProvidersFromApiSection(
  api: Record<string, z.infer<typeof ProviderBlockSchema>>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, block] of Object.entries(api)) {
    if (k === "google") continue;
    const ids = modelsFromBlock(block);
    if (ids.length > 0) out[k] = ids;
  }
  return out;
}

export function parseTextLlmWebPresetsYaml(
  rawYaml: string,
): ParsedWebPresetsYaml {
  const doc: unknown = parseYaml(rawYaml);
  const parsed = RootSchema.safeParse(doc);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    throw new Error(`text-llm-web-presets.yaml: invalid shape: ${msg}`);
  }
  const prov = parsed.data.providers ?? {};
  const apiRaw = prov.api ?? {};
  const apiGoogleBlock = apiRaw.google;
  const legacyGoogleBlock = prov.google;
  const apiGoogleIds = modelsFromBlock(apiGoogleBlock);
  const legacyGoogleIds = modelsFromBlock(legacyGoogleBlock);
  /**
   * If `providers.api.google` exists but has no `models` (empty object or `models: []`),
   * fall back to legacy `providers.google` instead of dropping the curated list.
   */
  const google =
    apiGoogleBlock !== undefined
      ? apiGoogleIds.length > 0
        ? apiGoogleIds
        : legacyGoogleIds
      : legacyGoogleIds;
  return {
    mlx: modelsFromBlock(prov.mlx),
    http: modelsFromBlock(prov.http),
    google,
    futureApiProviders: futureApiProvidersFromApiSection(apiRaw),
  };
}

function loadFromDisk(): TextLlmWebPresetsNormalized {
  const p = resolveConfigPath();
  if (!existsSync(p)) {
    return DEFAULT_TEXT_LLM_WEB_PRESETS;
  }
  const text = readFileSync(p, "utf8");
  try {
    const n = parseTextLlmWebPresetsYaml(text);
    return Object.freeze({
      mlx: Object.freeze([...n.mlx]),
      http: Object.freeze([...n.http]),
      google: Object.freeze([...n.google]),
      futureApiProviders: Object.freeze(
        Object.fromEntries(
          Object.entries(n.futureApiProviders).map(([k, v]) => [
            k,
            Object.freeze([...v]),
          ]),
        ),
      ),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`${p}: ${msg}`, { cause: e });
  }
}

export function getTextLlmWebPresets(): TextLlmWebPresetsNormalized {
  if (!cached) {
    cached = loadFromDisk();
  }
  return cached;
}

/** @internal Vitest only — clears cached presets so the next read reloads from disk or env path. */
export function resetTextLlmWebPresetsCacheForTests(): void {
  cached = null;
}

export function mlxModelsFromWebPresetsFile(): readonly string[] {
  return getTextLlmWebPresets().mlx;
}

export function googleModelsFromWebPresetsFile(): readonly string[] {
  return getTextLlmWebPresets().google;
}

/** HTTP models listed only in YAML; merged after env-based presets. */
export function httpExtraModelsFromWebPresetsFile(): readonly string[] {
  return getTextLlmWebPresets().http;
}

/**
 * Allowlisted model ids for hosted API vendors other than Google (inert until implemented).
 * Keys match `providers.api.*` in YAML (e.g. `openai`).
 */
export function futureApiProviderPresetsFromWebPresetsFile(): Readonly<
  Record<string, readonly string[]>
> {
  return getTextLlmWebPresets().futureApiProviders;
}
