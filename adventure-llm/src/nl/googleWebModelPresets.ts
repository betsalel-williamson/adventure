import {
  googleModelsFromWebPresetsFile,
  sortWebDashboardModelIds,
} from "./textLlmWebPresetsConfig.js";

/**
 * Curated Gemini model ids from `text-llm-web-presets.yaml`, plus optional `GEMINI_TEXT_MODEL`
 * when set and not already listed. Sorted A→Z for the picker.
 */
export function mergeGoogleWebPresetsFromEnv(): string[] {
  const curated = [...googleModelsFromWebPresetsFile()];
  const envModel = process.env.GEMINI_TEXT_MODEL?.trim();
  const seen = new Set(curated);
  if (!envModel || seen.has(envModel)) {
    return sortWebDashboardModelIds(curated);
  }
  return sortWebDashboardModelIds([envModel, ...curated]);
}

export function isAllowedGoogleWebModelId(modelId: string): boolean {
  const t = modelId.trim();
  if (t.length === 0) return false;
  return mergeGoogleWebPresetsFromEnv().includes(t);
}
