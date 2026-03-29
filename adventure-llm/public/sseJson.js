/**
 * Parse Server-Sent Event `data` payload as JSON. Returns null on failure.
 * @param {unknown} data
 * @returns {unknown}
 */
export function parseSseJson(data) {
  if (typeof data !== "string") return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}
