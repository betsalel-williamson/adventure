import { fileURLToPath } from "node:url";
import express from "express";
import { buildMetadataWireFields } from "./buildMetadata.js";
import {
  createEmptyGraph,
  mergeGraphFromTranscript,
  directedGraphToMermaidFlowchart,
  graphToJson,
  applyLocationGraphPatch,
  parseLocationGraphPatch,
  type DirectedMapGraph,
} from "@adventure-langgraph/map-core";
import { z } from "zod";
import { buildAssistGraph, runAssistStep } from "./assistGraph.js";
import { assistIngestBodySchema, assistStepBodySchema } from "./schemas.js";
import { createHeuristicSlmAdapter } from "./slm/heuristicSlmAdapter.js";
import { createOllamaSlmAdapter } from "./slm/ollamaSlmAdapter.js";

const PORT = Number(process.env.ASSIST_SERVER_PORT ?? "8790");
const OLLAMA_URL = process.env.OLLAMA_URL;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2";

const parseEnvTruthy = (
  raw: string | undefined,
  fallback: boolean,
): boolean => {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
};

const ASSIST_PROBE_ENABLED = parseEnvTruthy(
  process.env.ASSIST_PROBE_ENABLED,
  false,
);

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
    const prev = graphsByRunId.get(body.runId) ?? createEmptyGraph();
    const posture = body.assistancePosture ?? "quickAssist";
    const advancing = body.advance !== false;
    if (advancing && !ASSIST_PROBE_ENABLED) {
      const merged = mergeGraphFromTranscript(prev, body.transcript);
      graphsByRunId.set(body.runId, merged);
      res.json({
        status: "ok",
        nextMove: null,
        mapJson: graphToJson(merged),
        mermaid: directedGraphToMermaidFlowchart(merged),
        notice: "Map probe disabled on assist server.",
      });
      return;
    }
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

  app.post("/assist/ingest", (req, res): void => {
    let body: z.infer<typeof assistIngestBodySchema>;
    try {
      body = assistIngestBodySchema.parse(req.body);
    } catch (e) {
      res.status(400).json({
        status: "error",
        errorMessage:
          e instanceof Error
            ? e.message
            : "Invalid JSON body for /assist/ingest",
      });
      return;
    }

    const prev = graphsByRunId.get(body.runId) ?? createEmptyGraph();
    let merged = mergeGraphFromTranscript(prev, body.transcript);
    const patch = parseLocationGraphPatch(body.patch);
    if (patch !== null) {
      merged = applyLocationGraphPatch(merged, patch);
    }
    graphsByRunId.set(body.runId, merged);
    res.json({
      status: "ok",
      mapJson: graphToJson(merged),
      mermaid: directedGraphToMermaidFlowchart(merged),
    });
  });

  app.get("/assist/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "assist-server",
      ...buildMetadataWireFields(),
      adapter: OLLAMA_URL ? `ollama:${OLLAMA_MODEL}` : "heuristic",
      probeEnabled: ASSIST_PROBE_ENABLED,
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
