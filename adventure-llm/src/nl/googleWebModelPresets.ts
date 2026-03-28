/**
 * Curated Gemini model ids allowed for web dashboard hot-swap (matches common `GEMINI_TEXT_MODEL` values).
 */
export const GOOGLE_WEB_MODEL_PRESETS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.5-pro",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
] as const;

const presetSet = new Set<string>(GOOGLE_WEB_MODEL_PRESETS);

export function isAllowedGoogleWebModelId(modelId: string): boolean {
  const t = modelId.trim();
  return t.length > 0 && presetSet.has(t);
}
