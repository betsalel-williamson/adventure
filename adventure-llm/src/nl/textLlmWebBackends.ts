import { MLX_WEB_MODEL_PRESETS } from "./mlxModelPresets.js";
import { GOOGLE_WEB_MODEL_PRESETS } from "./googleWebModelPresets.js";
import { mergeHttpWebPresetsFromEnv } from "./httpWebPresets.js";
import type { TextLlmProviderId } from "./textLlmContract.js";

export type TextLlmBackendSnapshot = {
  readonly providerId: TextLlmProviderId;
  readonly available: boolean;
  readonly presets: readonly string[];
};

/** MLX is swappable when explicitly selected or `ADVENTURE_LLM_MLX_MODEL` pins the auto path to MLX-capable config. */
export function mlxBackendAvailableFromEnv(): boolean {
  const raw = process.env.ADVENTURE_LLM_TEXT_PROVIDER?.trim().toLowerCase();
  return raw === "mlx" || Boolean(process.env.ADVENTURE_LLM_MLX_MODEL?.trim());
}

export function httpBackendAvailableFromEnv(): boolean {
  return Boolean(process.env.ADVENTURE_LLM_HTTP_MODEL?.trim());
}

export function googleBackendAvailableFromEnv(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function buildTextLlmBackendSnapshots(): TextLlmBackendSnapshot[] {
  const mlxAv = mlxBackendAvailableFromEnv();
  const httpAv = httpBackendAvailableFromEnv();
  const googleAv = googleBackendAvailableFromEnv();
  return [
    {
      providerId: "mlx",
      available: mlxAv,
      presets: mlxAv ? [...MLX_WEB_MODEL_PRESETS] : [],
    },
    {
      providerId: "http",
      available: httpAv,
      presets: httpAv ? mergeHttpWebPresetsFromEnv() : [],
    },
    {
      providerId: "google",
      available: googleAv,
      presets: googleAv ? [...GOOGLE_WEB_MODEL_PRESETS] : [],
    },
  ];
}

export function canSwapTextLlmFromBackends(
  backends: readonly TextLlmBackendSnapshot[],
): boolean {
  return backends.some((b) => b.available && b.presets.length > 0);
}
