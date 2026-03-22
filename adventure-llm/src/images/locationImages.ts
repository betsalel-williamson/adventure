import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type LocationImageOptions = {
  /** Enable generation (otherwise returns null). */
  enabled: boolean;
  cacheDir: string;
};

/**
 * Stable cache key for a location + optional state fingerprint.
 */
export function locationImageCacheKey(loc: number, stateFingerprint: string): string {
  const h = createHash("sha256").update(`${loc}\n${stateFingerprint}`).digest("hex").slice(0, 16);
  return `loc-${loc}-${h}.png`;
}

/**
 * Placeholder for Gemini / Imagen integration: returns null unless enabled and file exists.
 * Real image generation should call the Google image API with a prompt derived from room text.
 */
export async function getOrCreateLocationImage(
  _prompt: string,
  options: LocationImageOptions,
): Promise<Buffer | null> {
  if (!options.enabled) return null;
  await mkdir(options.cacheDir, { recursive: true });
  const key = locationImageCacheKey(0, _prompt);
  const file = path.join(options.cacheDir, key);
  try {
    return await readFile(file);
  } catch {
    return null;
  }
}

/** Write image bytes to cache (used when an API returns bytes). */
export async function saveLocationImage(
  bytes: Buffer,
  prompt: string,
  options: LocationImageOptions,
): Promise<string> {
  await mkdir(options.cacheDir, { recursive: true });
  const key = locationImageCacheKey(0, prompt);
  const file = path.join(options.cacheDir, key);
  await writeFile(file, bytes);
  return file;
}
