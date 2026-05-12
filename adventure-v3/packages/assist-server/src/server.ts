import { fileURLToPath } from "node:url";
import express from "express";
import {
  createEmptyGraph,
  mergeGraphFromTranscript,
  directedGraphToMermaidFlowchart,
  graphToJson,
  type DirectedMapGraph,
} from "@adventure-v3/map-core";
import { z } from "zod";
import { buildAssistGraph, runAssistStep } from "./assistGraph.js";
import { createHeuristicSlmAdapter } from "./slm/heuristicSlmAdapter.js";
import { createOllamaSlmAdapter } from "./slm/ollamaSlmAdapter.js";

const assistStepBodySchema = z.object({
  runId: z.string(),
  transcript: z.string(),
  assistancePosture: z.enum(["quickAssist", "studyFirst"]).optional(),
  studyFirstConfirmed: z.boolean().optional(),
  /** When false, merge transcript into graph only (no LangGraph navigator / SLM move). */
  advance: z.boolean().optional(),
});

const PORT = Number(process.env.ASSIST_SERVER_PORT ?? "8790");
const OLLAMA_URL = process.env.OLLAMA_URL;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2";

/** Per adventure-v2 run — draft map is hypothetical assist state only. */
const graphsByRunId = new Map<string, DirectedMapGraph>();

const slm =
  OLLAMA_URL !== undefined && OLLAMA_URL !== ""
    ? createOllamaSlmAdapter({
        baseUrl: OLLAMA_URL,
        model: OLLAMA_MODEL,
      })
    : createHeuristicSlmAdapter();

const compiledGraph = buildAssistGraph(slm);

export const createAssistApp = (): express.Application => {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
    next();
  });

  /** Express 5 / path-to-regexp rejects `app.options('*', …)` — handle preflight explicitly. */
  app.use((req, res, next) => {
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.post("/assist/step", async (req, res): Promise<void> => {
    let body: z.infer<typeof assistStepBodySchema>;
    try {
      body = assistStepBodySchema.parse(req.body);
    } catch (e) {
      res.status(400).json({
        status: "error",
        errorMessage:
          e instanceof Error ? e.message : "Invalid JSON body for /assist/step",
      });
      return;
    }

    /** Study first: require explicit confirm flag before automating compass moves only. */
    const posture = body.assistancePosture ?? "quickAssist";
    const advancing = body.advance !== false;
    if (
      advancing &&
      posture === "studyFirst" &&
      body.studyFirstConfirmed !== true
    ) {
      res.json({
        status: "ok",
        nextMove: null,
        mapJson: null,
        mermaid: "",
        notice:
          "Study first: confirm automated navigation in the shell before each step.",
      });
      return;
    }

    const prev = graphsByRunId.get(body.runId) ?? createEmptyGraph();

    try {
      if (body.advance === false) {
        const merged = mergeGraphFromTranscript(prev, body.transcript);
        graphsByRunId.set(body.runId, merged);
        res.json({
          status: "ok",
          nextMove: null,
          mapJson: graphToJson(merged),
          mermaid: directedGraphToMermaidFlowchart(merged),
        });
        return;
      }

      const step = await runAssistStep(compiledGraph, {
        transcript: body.transcript,
        mapGraph: prev,
        nextMove: null,
      });
      graphsByRunId.set(body.runId, step.mapGraph);
      res.json({
        status: "ok",
        nextMove: step.nextMove,
        mapJson: step.mapJson,
        mermaid: step.mermaid,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({
        status: "error",
        errorMessage: msg,
      });
    }
  });

  app.get("/assist/health", (_req, res) => {
    res.json({
      status: "ok",
      adapter: OLLAMA_URL ? `ollama:${OLLAMA_MODEL}` : "heuristic",
    });
  });

  return app;
};

/** Entry point: `tsx packages/assist-server/src/server.ts` */
export const startAssistServer = (): void => {
  const app = createAssistApp();
  app.listen(PORT, () => {
    console.error(`assist server listening on http://127.0.0.1:${PORT}`);
  });
};

const isMainProcess =
  typeof process !== "undefined" &&
  process.argv[1] === fileURLToPath(import.meta.url);

if (isMainProcess) {
  startAssistServer();
}
