/**
 * Curated Hugging Face repo ids for MLX-converted weights (`mlx_lm.load`).
 * Not every HF transformers checkpoint has an MLX build; these are known mlx-community instruct variants.
 *
 * The list is for local MLX on Apple Silicon: small-to-mid instruct models, ordered roughly by typical
 * resource cost. It is inspired by common open-source families (Gemma, Qwen, Phi, Llama, Mistral)—not
 * an exhaustive or ranked “top N” list from any third-party article.
 */
export const MLX_WEB_MODEL_PRESETS = [
  "mlx-community/gemma-2-2b-it",
  "mlx-community/Qwen2.5-1.5B-Instruct-4bit",
  "mlx-community/Llama-3.2-3B-Instruct-4bit",
  "mlx-community/Qwen2.5-3B-Instruct-4bit",
  "mlx-community/Phi-4-mini-instruct-4bit",
  "mlx-community/Mistral-7B-Instruct-v0.3-4bit",
  "mlx-community/Qwen2.5-7B-Instruct-4bit",
  "mlx-community/gemma-2-9b-it-4bit",
] as const;

const presetSet = new Set<string>(MLX_WEB_MODEL_PRESETS);

export function isAllowedMlxWebModelId(modelId: string): boolean {
  const t = modelId.trim();
  return t.length > 0 && presetSet.has(t);
}
