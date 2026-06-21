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
  assistHealthResponseSchema,
  assistIngestBodySchema,
  assistIngestResponseSchema,
  assistIngestResponseUnionSchema,
  assistStepBodySchema,
  assistStepResponseSchema,
} from "../src/schemas.js";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

registry.registerPath({
  method: "get",
  path: "/assist/health",
  summary: "Liveness and adapter summary",
  responses: {
    200: {
      description: "Assist server health",
      content: { "application/json": { schema: assistHealthResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/assist/ingest",
  summary: "Merge transcript into draft exploration graph",
  request: {
    body: {
      content: { "application/json": { schema: assistIngestBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Updated mapJson and Mermaid flowchart",
      content: {
        "application/json": { schema: assistIngestResponseSchema },
      },
    },
    400: {
      description: "Invalid request body",
      content: {
        "application/json": { schema: assistIngestResponseUnionSchema },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/assist/step",
  summary: "Merge transcript and optionally run LangGraph navigator",
  request: {
    body: {
      content: { "application/json": { schema: assistStepBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Step result (merge-only or navigator move)",
      content: {
        "application/json": { schema: assistStepResponseSchema },
      },
    },
    400: {
      description: "Invalid request body",
      content: {
        "application/json": { schema: assistStepResponseSchema },
      },
    },
    500: {
      description: "Assist step failure",
      content: {
        "application/json": { schema: assistStepResponseSchema },
      },
    },
  },
});

const generator = new OpenApiGeneratorV3(registry.definitions);
const document = generator.generateDocument({
  openapi: "3.1.0",
  info: {
    title: "adventure-langgraph assist-server API",
    version: "0.1.0",
    description:
      "Draft exploration map assist HTTP API. Generated from Zod schemas in packages/assist-server/src/schemas.ts.",
  },
  servers: [{ url: "http://127.0.0.1:8790" }],
});

const outPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "openapi.yaml",
);
writeFileSync(outPath, stringify(document, { lineWidth: 0 }), "utf8");
console.log(`Wrote ${outPath}`);
