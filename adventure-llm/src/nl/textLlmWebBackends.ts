import { mlxWebModelPresetsList } from "./mlxModelPresets.js";
import { mergeGoogleWebPresetsFromEnv } from "./googleWebModelPresets.js";
import { mergeHttpWebPresetsFromEnv } from "./httpWebPresets.js";
import type { TextLlmProviderId } from "@adventure-llm/nl-glue";

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
      presets: mlxAv ? [...mlxWebModelPresetsList()] : [],
    },
    {
      providerId: "http",
      available: httpAv,
      presets: httpAv ? mergeHttpWebPresetsFromEnv() : [],
    },
    {
      providerId: "google",
      available: googleAv,
      presets: googleAv ? mergeGoogleWebPresetsFromEnv() : [],
    },
  ];
}

export function canSwapTextLlmFromBackends(
  backends: readonly TextLlmBackendSnapshot[],
): boolean {
  return backends.some((b) => b.available && b.presets.length > 0);
}
