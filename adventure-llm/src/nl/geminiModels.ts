/** Default text model for JSON / NL mapping. Override with `GEMINI_TEXT_MODEL`. */
export const DEFAULT_GEMINI_TEXT_MODEL = "gemini-2.5-flash";

/** Default image model for location imagery. Override with `GEMINI_IMAGE_MODEL`. */
export const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview";

export function resolvedGeminiTextModel(): string {
  return process.env.GEMINI_TEXT_MODEL?.trim() || DEFAULT_GEMINI_TEXT_MODEL;
}

export function resolvedGeminiImageModel(): string {
  return process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_GEMINI_IMAGE_MODEL;
}
