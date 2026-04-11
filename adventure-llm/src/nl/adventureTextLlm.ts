import type { AdventureDatabase } from "../dat/types.js";
import type {
  AutoplayPlannerResponse,
  InterpretedCommand,
} from "@adventure-llm/nl-glue";
import { GoogleGenerativeAiTextLlm } from "./providers/googleGenerativeAiTextLlm.js";
import { HttpOpenAiCompatibleTextLlm } from "./providers/httpOpenAiCompatibleTextLlm.js";
import {
  MlxLmStdioTextLlm,
  type MlxLmStdioTextLlmOptions,
} from "./providers/mlxLmStdioTextLlm.js";
import {
  resolveCompactPrompts,
  type InterpretPlayerInputOptions,
  type PlannerUserPromptInput,
  type TextLlm,
} from "@adventure-llm/nl-glue";

/** Default Ollama OpenAI-compatible base (`/v1` included). */
export const DEFAULT_HTTP_OPENAI_BASE_URL = "http://127.0.0.1:11434/v1";

/** Default Hugging Face MLX weights (Gemma 2 2B Instruct — small default for edge / low RAM). */
export const DEFAULT_MLX_MODEL_ID = "mlx-community/gemma-2-2b-it";

/**
 * Build {@link MlxLmStdioTextLlm} options from `process.env`, optionally overriding the model id
 * (e.g. web dashboard preset swap).
 */
export function mlxLmOptionsFromEnv(
  modelIdOverride?: string,
): MlxLmStdioTextLlmOptions {
  const mlxModel =
    modelIdOverride?.trim() ||
    process.env.ADVENTURE_LLM_MLX_MODEL?.trim() ||
    DEFAULT_MLX_MODEL_ID;
  const maxTok = process.env.ADVENTURE_LLM_MLX_MAX_TOKENS?.trim();
  const readyMs = process.env.ADVENTURE_LLM_MLX_READY_TIMEOUT_MS?.trim();
  let maxTokens: number | undefined;
  if (maxTok) {
    const n = Number(maxTok);
    if (Number.isFinite(n) && n >= 32) maxTokens = Math.floor(n);
  }
  let readyTimeoutMs: number | undefined;
  if (readyMs) {
    const n = Number(readyMs);
    if (Number.isFinite(n) && n >= 5000) readyTimeoutMs = Math.floor(n);
  }
  const uvEnv = process.env.ADVENTURE_LLM_MLX_USE_UV?.trim().toLowerCase();
  let useUv: boolean | undefined;
  if (uvEnv !== undefined && uvEnv !== "") {
    useUv = !(uvEnv === "0" || uvEnv === "false" || uvEnv === "no");
  }
  return {
    modelId: mlxModel,
    useUv,
    uvPath: process.env.ADVENTURE_LLM_MLX_UV?.trim(),
    packageRoot: process.env.ADVENTURE_LLM_MLX_PACKAGE_ROOT?.trim(),
    pythonPath: process.env.ADVENTURE_LLM_MLX_PYTHON?.trim(),
    scriptPath: process.env.ADVENTURE_LLM_MLX_SCRIPT?.trim(),
    maxTokens,
    readyTimeoutMs,
    compactPrompts: resolveCompactPrompts("mlx"),
  };
}

/** Construct an MLX client using env-derived paths and options. */
export function createMlxTextLlmFromEnv(
  modelIdOverride?: string,
  extras?: Partial<Pick<MlxLmStdioTextLlmOptions, "onWorkerStderr">>,
): MlxLmStdioTextLlm {
  return new MlxLmStdioTextLlm({
    ...mlxLmOptionsFromEnv(modelIdOverride),
    ...extras,
  });
}

/**
 * OpenAI-compatible HTTP client from env (base URL, API key) and an explicit `model` id
 * (web dashboard hot-swap).
 */
export function createHttpTextLlmFromEnv(
  modelId: string,
): HttpOpenAiCompatibleTextLlm | null {
  const mid = modelId.trim();
  if (mid === "") return null;
  const httpBase =
    process.env.ADVENTURE_LLM_HTTP_BASE_URL?.trim() ||
    DEFAULT_HTTP_OPENAI_BASE_URL;
  const httpApiKey = process.env.ADVENTURE_LLM_HTTP_API_KEY?.trim();
  return new HttpOpenAiCompatibleTextLlm({
    baseUrl: httpBase,
    model: mid,
    apiKey: httpApiKey,
  });
}

/**
 * Gemini client from env (`GEMINI_API_KEY`) and optional model id (defaults per {@link GoogleGenerativeAiTextLlm} when unset).
 * For web hot-swap, pass an allowlisted model id string.
 */
export function createGoogleTextLlmFromEnv(
  modelId?: string,
): GoogleGenerativeAiTextLlm | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  const mid = modelId?.trim();
  return new GoogleGenerativeAiTextLlm({
    apiKey: key,
    model: mid && mid !== "" ? mid : undefined,
  });
}

/**
 * Resolve which text model to use from `process.env`.
 *
 * - `ADVENTURE_LLM_TEXT_PROVIDER=google` — requires `GEMINI_API_KEY`
 * - `ADVENTURE_LLM_TEXT_PROVIDER=http` — requires `ADVENTURE_LLM_HTTP_MODEL` (base URL defaults to {@link DEFAULT_HTTP_OPENAI_BASE_URL})
 * - `ADVENTURE_LLM_TEXT_PROVIDER=mlx` — Apple Silicon native MLX via **uv** (`uv venv && uv sync` in adventure-llm); optional `ADVENTURE_LLM_MLX_MODEL` (defaults to {@link DEFAULT_MLX_MODEL_ID})
 * - Unset: Google if `GEMINI_API_KEY`; else HTTP if `ADVENTURE_LLM_HTTP_MODEL`; else MLX if `ADVENTURE_LLM_MLX_MODEL`
 */
export function resolveTextLlmFromEnv(): TextLlm | null {
  const rawProvider =
    process.env.ADVENTURE_LLM_TEXT_PROVIDER?.trim().toLowerCase();
  const hasGoogleKey = Boolean(process.env.GEMINI_API_KEY?.trim());
  const httpModel = process.env.ADVENTURE_LLM_HTTP_MODEL?.trim();
  if (rawProvider === "mlx") {
    return createMlxTextLlmFromEnv();
  }

  if (rawProvider === "http") {
    if (!httpModel) return null;
    return createHttpTextLlmFromEnv(httpModel);
  }

  if (rawProvider === "google") {
    if (!hasGoogleKey) return null;
    return createGoogleTextLlmFromEnv(process.env.GEMINI_TEXT_MODEL?.trim());
  }

  if (rawProvider === undefined || rawProvider === "") {
    if (hasGoogleKey) {
      return createGoogleTextLlmFromEnv(process.env.GEMINI_TEXT_MODEL?.trim());
    }
    if (httpModel) {
      return createHttpTextLlmFromEnv(httpModel);
    }
    if (process.env.ADVENTURE_LLM_MLX_MODEL?.trim()) {
      return createMlxTextLlmFromEnv();
    }
    return null;
  }

  return null;
}

/** @deprecated Prefer {@link resolveTextLlmFromEnv}. */
export const createTextLlmFromEnv = resolveTextLlmFromEnv;

export async function interpretWithTextLlm(
  userText: string,
  db: AdventureDatabase,
  client: TextLlm,
  options?: InterpretPlayerInputOptions,
): Promise<InterpretedCommand> {
  return client.interpretPlayerInput(userText, db, options ?? {});
}

export async function planAutoplayWithTextLlm(
  db: AdventureDatabase,
  client: TextLlm,
  options: {
    plannerUserPrompt: PlannerUserPromptInput;
    recentGameTextForRepair?: string;
    includeDatHelpInSystem?: boolean;
  },
): Promise<AutoplayPlannerResponse> {
  return client.planAutoplay(db, options);
}
