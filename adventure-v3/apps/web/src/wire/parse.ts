import { sseWireEventSchema, type SseWireEvent } from "@contracts";

/** Parse one SSE `data:` JSON line into a wire event, or null if invalid. */
export const parseSseWirePayload = (raw: string): SseWireEvent | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  const r = sseWireEventSchema.safeParse(parsed);
  return r.success ? r.data : null;
};
