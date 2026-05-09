import { sseWireEventSchema, type SseWireEvent } from "../../packages/contracts/src/index.js";

/**
 * Reads SSE `data:` JSON lines from a fetch Response until `count` schema-valid
 * wire events are collected (same parsing as HTTP acceptance tests).
 */
export const readSseUntilCount = async (
  res: globalThis.Response,
  count: number,
  timeMs: number = 5000
): Promise<SseWireEvent[]> => {
  if (!res.body) {
    throw new Error("No response body");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const out: SseWireEvent[] = [];
  const deadline = Date.now() + timeMs;
  while (out.length < count && Date.now() < deadline) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      for (const line of block.split("\n")) {
        if (line.startsWith("data: ")) {
          const raw = line.slice(6);
          const parsed = JSON.parse(raw) as unknown;
          out.push(sseWireEventSchema.parse(parsed));
        }
      }
    }
  }
  await reader.cancel();
  return out;
};
