import { httpExtraModelsFromWebPresetsFile } from "./textLlmWebPresetsConfig.js";

/**
 * HTTP (OpenAI-compatible) model ids for the web dashboard: env default plus optional
 * `ADVENTURE_LLM_HTTP_WEB_PRESETS` (comma-separated), then extras from
 * `text-llm-web-presets.yaml` `providers.http.models`. Deduped; default model is first when set.
 */
export function mergeHttpWebPresetsFromEnv(): string[] {
  const defaultModel = process.env.ADVENTURE_LLM_HTTP_MODEL?.trim();
  const raw = process.env.ADVENTURE_LLM_HTTP_WEB_PRESETS?.trim();
  const extra = raw
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const seen = new Set<string>();
  const out: string[] = [];
  if (defaultModel) {
    seen.add(defaultModel);
    out.push(defaultModel);
  }
  for (const x of extra) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  for (const x of httpExtraModelsFromWebPresetsFile()) {
    const t = x.trim();
    if (t.length === 0 || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export function isAllowedHttpWebModelId(modelId: string): boolean {
  const t = modelId.trim();
  if (t.length === 0) return false;
  return mergeHttpWebPresetsFromEnv().includes(t);
}
