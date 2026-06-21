import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";
import {
  inferenceCapabilitiesResponseSchema,
  inferenceRequestSchema,
  inferenceResponseSchema,
} from "../packages/contracts/src/inference/contract.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const openapiPath = join(repoRoot, "openapi.yaml");

describe("inference contract (I1)", () => {
  it("parses logical request aligned with PlannerUserPromptInput system/user split", () => {
    const parsed = inferenceRequestSchema.parse({
      requestId: "550e8400-e29b-41d4-a716-446655440000",
      mode: "planner",
      system: "You are the Adventure autoplay planner.",
      user: "Turn input:\nlook",
      schemaMode: "planner",
    });
    expect(parsed.system).toContain("planner");
    expect(parsed.user).toContain("look");
  });

  it("parses success and error inference responses", () => {
    const ok = inferenceResponseSchema.parse({
      requestId: "550e8400-e29b-41d4-a716-446655440000",
      ok: true,
      json: { action: "look" },
      providerId: "http",
      modelId: "llama3.2",
      durationMs: 1200,
    });
    expect(ok.ok).toBe(true);

    const err = inferenceResponseSchema.parse({
      requestId: "550e8400-e29b-41d4-a716-446655440000",
      ok: false,
      code: "provider_unavailable",
      message: "No paired desktop agent online.",
    });
    expect(err.ok).toBe(false);
  });

  it("parses capabilities response", () => {
    const parsed = inferenceCapabilitiesResponseSchema.parse({
      capabilities: [
        {
          providerId: "google",
          modelId: "gemini-2.0-flash",
          source: "hosted",
          label: "Hosted Gemini",
        },
      ],
    });
    expect(parsed.capabilities).toHaveLength(1);
  });

  it("documents required inference paths in generated OpenAPI", () => {
    const doc = parseYaml(readFileSync(openapiPath, "utf8")) as {
      paths?: Record<string, unknown>;
    };
    expect(doc.paths).toMatchObject({
      "/inference/plan": expect.any(Object),
      "/inference/navigator": expect.any(Object),
      "/inference/capabilities": expect.any(Object),
    });
  });
});
