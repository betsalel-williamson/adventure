/**
 * Parse JSON from model output that may include markdown fences or prose.
 */
export function parseJsonObjectFromLlmText(text: string): unknown {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  const jsonStr = fence ? fence[1]!.trim() : trimmed;
  const objMatch = jsonStr.match(/\{[\s\S]*\}/);
  const toParse = objMatch ? objMatch[0]! : jsonStr;
  return JSON.parse(toParse) as unknown;
}
