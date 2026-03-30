import {
  mlxModelsFromWebPresetsFile,
  sortWebDashboardModelIds,
} from "./textLlmWebPresetsConfig.js";

/** Allowlisted MLX Hugging Face repo ids for the web dashboard (from `text-llm-web-presets.yaml`). */
export function mlxWebModelPresetsList(): readonly string[] {
  return sortWebDashboardModelIds(mlxModelsFromWebPresetsFile());
}

export function isAllowedMlxWebModelId(modelId: string): boolean {
  const t = modelId.trim();
  if (t.length === 0) return false;
  return new Set(mlxWebModelPresetsList()).has(t);
}
