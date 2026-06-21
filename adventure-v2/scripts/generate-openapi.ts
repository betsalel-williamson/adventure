import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { stringify } from "yaml";
import { z } from "zod";
import {
  createRunRequestSchema,
  createRunResponseSchema,
  inferenceCapabilitiesResponseSchema,
  inferenceRequestSchema,
  inferenceResponseSchema,
  listCheckpointsResponseSchema,
  postReplayRequestSchema,
  postReplayResponseSchema,
  postTurnRequestSchema,
  sseWireEventSchema,
} from "../packages/contracts/src/index.js";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const healthResponseSchema = registry.register(
  "HealthResponse",
  z.object({
    status: z.literal("ok"),
    service: z.literal("adventure-v2"),
    oracleMode: z.enum(["synthetic", "process"]),
    processOracleScript: z.string().nullable(),
  }),
);

const payloadTooLargeSchema = registry.register(
  "PayloadTooLarge",
  z.object({ error: z.literal("payload_too_large") }),
);

const runIdParam = z.object({
  runId: z.string().min(1).openapi({ param: { name: "runId", in: "path" } }),
});

registry.registerPath({
  method: "get",
  path: "/health",
  summary: "Liveness and oracle mode",
  responses: {
    200: {
      description: "Service health with oracle wiring summary",
      content: { "application/json": { schema: healthResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/runs",
  summary: "Start a run",
  request: {
    body: {
      content: { "application/json": { schema: createRunRequestSchema } },
    },
  },
  responses: {
    201: {
      description: "Run created",
      content: { "application/json": { schema: createRunResponseSchema } },
    },
    413: {
      description: "JSON body exceeds 256 KiB",
      content: { "application/json": { schema: payloadTooLargeSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/runs/{runId}/turns",
  summary: "Submit a parser command",
  request: {
    params: runIdParam,
    body: {
      content: { "application/json": { schema: postTurnRequestSchema } },
    },
  },
  responses: {
    204: { description: "Turn accepted" },
    413: {
      description: "JSON body exceeds 256 KiB",
      content: { "application/json": { schema: payloadTooLargeSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/runs/{runId}/events",
  summary: "Subscribe to run events (SSE)",
  request: { params: runIdParam },
  responses: {
    200: {
      description:
        "Server-Sent Events stream. Each event is JSON in `data:` with `event` turn | phase | trace. See SseWireEvent schema.",
      content: {
        "text/event-stream": {
          schema: sseWireEventSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/runs/{runId}/checkpoints",
  summary: "List checkpoints for a run",
  request: { params: runIdParam },
  responses: {
    200: {
      description: "Checkpoint references",
      content: {
        "application/json": { schema: listCheckpointsResponseSchema },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/runs/{runId}/replay",
  summary: "Restore from a checkpoint",
  request: {
    params: runIdParam,
    body: {
      content: { "application/json": { schema: postReplayRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Replay payload",
      content: { "application/json": { schema: postReplayResponseSchema } },
    },
    404: { description: "Unknown run or checkpoint" },
    413: {
      description: "JSON body exceeds 256 KiB",
      content: { "application/json": { schema: payloadTooLargeSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/inference/plan",
  summary: "Planner inference (stateless system + user)",
  request: {
    body: {
      content: { "application/json": { schema: inferenceRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Planner JSON result",
      content: { "application/json": { schema: inferenceResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/inference/navigator",
  summary: "Assist navigator inference (stateless system + user)",
  request: {
    body: {
      content: { "application/json": { schema: inferenceRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Navigator JSON result",
      content: { "application/json": { schema: inferenceResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/inference/capabilities",
  summary: "List inference providers available for the session",
  responses: {
    200: {
      description: "Hosted, server-local, and paired-desktop capabilities",
      content: {
        "application/json": { schema: inferenceCapabilitiesResponseSchema },
      },
    },
  },
});

const generator = new OpenApiGeneratorV3(registry.definitions);
const document = generator.generateDocument({
  openapi: "3.1.0",
  info: {
    title: "adventure-v2 HTTP API",
    version: "0.1.0",
    description:
      "Game run lifecycle, turns, SSE fanout, checkpoints, replay, and unified inference relay. Generated from Zod contracts in packages/contracts.",
  },
  servers: [{ url: "http://127.0.0.1:8787" }],
});

const outPath = join(dirname(fileURLToPath(import.meta.url)), "..", "openapi.yaml");
writeFileSync(outPath, stringify(document, { lineWidth: 0 }), "utf8");
console.log(`Wrote ${outPath}`);
