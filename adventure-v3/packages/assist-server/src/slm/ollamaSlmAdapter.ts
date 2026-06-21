import {
  type NavigatorHintRequest,
  navigatorMoveSchema,
  type NavigatorMoveJson,
  type SlmAdapter,
} from "./slmAdapter.js";

export type OllamaSlmAdapterOptions = {
  readonly baseUrl: string;
  readonly model: string;
  readonly fetchFn?: typeof fetch;
};

/**
 * Minimal Ollama JSON completion for Gemma/Llama local SLMs (`format: json`).
 * Falls back is not handled here — use `createHeuristicSlmAdapter` when Ollama is down.
 */
export const createOllamaSlmAdapter = (
  opts: OllamaSlmAdapterOptions,
): SlmAdapter => {
  const fetchImpl = opts.fetchFn ?? fetch;
  const url = `${opts.baseUrl.replace(/\/$/, "")}/api/generate`;

  return {
    completeNavigatorMove: async (
      req: NavigatorHintRequest,
    ): Promise<{ nextMoveUpper: string | null }> => {
      const prompt = [
        "You help explore a text adventure. Output ONLY valid JSON with key move:",
        "move is one of N,E,S,W,U,D or null if exploration should stop.",
        "Prefer moves that extend an unknown exit. Do not invent room names.",
        "Transcript (last lines matter most):",
        req.transcript.slice(-8000),
        "Current draft map JSON:",
        JSON.stringify(req.mapJson).slice(0, 4000),
      ].join("\n");

      const res = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: opts.model,
          prompt,
          stream: false,
          format: "json",
        }),
      });

      if (!res.ok) {
        throw new Error(`Ollama HTTP ${res.status}`);
      }
      const body = (await res.json()) as { response?: string };
      const raw = body.response;
      if (typeof raw !== "string") {
        throw new Error("Ollama response missing string");
      }
      let parsed: NavigatorMoveJson;
      try {
        parsed = navigatorMoveSchema.parse(JSON.parse(raw));
      } catch {
        throw new Error(`Ollama JSON parse failed: ${raw.slice(0, 200)}`);
      }
      const m = parsed.move;
      if (m === null) {
        return { nextMoveUpper: null };
      }
      return { nextMoveUpper: m.toUpperCase() };
    },
  };
};
