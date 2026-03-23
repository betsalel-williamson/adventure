import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveTextLlmFromEnv } from "./adventureTextLlm.js";
import { GoogleGenerativeAiTextLlm } from "./providers/googleGenerativeAiTextLlm.js";
import { HttpOpenAiCompatibleTextLlm } from "./providers/httpOpenAiCompatibleTextLlm.js";
import { MlxLmStdioTextLlm } from "./providers/mlxLmStdioTextLlm.js";

describe("resolveTextLlmFromEnv", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    for (const k of Object.keys(process.env)) {
      if (k.startsWith("ADVENTURE_LLM_") || k === "GEMINI_API_KEY") {
        delete process.env[k];
      }
    }
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("returns Google when GEMINI_API_KEY is set and provider unset", () => {
    process.env.GEMINI_API_KEY = "test-key";
    const llm = resolveTextLlmFromEnv();
    expect(llm).toBeInstanceOf(GoogleGenerativeAiTextLlm);
    expect(llm?.providerId).toBe("google");
  });

  it("returns HTTP when ADVENTURE_LLM_TEXT_PROVIDER=http and model set", () => {
    process.env.ADVENTURE_LLM_TEXT_PROVIDER = "http";
    process.env.ADVENTURE_LLM_HTTP_MODEL = "gemma2:2b";
    const llm = resolveTextLlmFromEnv();
    expect(llm).toBeInstanceOf(HttpOpenAiCompatibleTextLlm);
    expect(llm?.providerId).toBe("http");
    expect(llm?.modelId).toBe("gemma2:2b");
  });

  it("returns null when http provider without model", () => {
    process.env.ADVENTURE_LLM_TEXT_PROVIDER = "http";
    delete process.env.ADVENTURE_LLM_HTTP_MODEL;
    expect(resolveTextLlmFromEnv()).toBeNull();
  });

  it("returns null when google provider without API key", () => {
    process.env.ADVENTURE_LLM_TEXT_PROVIDER = "google";
    delete process.env.GEMINI_API_KEY;
    expect(resolveTextLlmFromEnv()).toBeNull();
  });

  it("prefers HTTP when only ADVENTURE_LLM_HTTP_MODEL is set (no Google key)", () => {
    process.env.ADVENTURE_LLM_HTTP_MODEL = "gemma2:2b";
    const llm = resolveTextLlmFromEnv();
    expect(llm).toBeInstanceOf(HttpOpenAiCompatibleTextLlm);
  });

  it("returns MLX when ADVENTURE_LLM_TEXT_PROVIDER=mlx (lazy subprocess)", () => {
    process.env.ADVENTURE_LLM_TEXT_PROVIDER = "mlx";
    delete process.env.GEMINI_API_KEY;
    delete process.env.ADVENTURE_LLM_HTTP_MODEL;
    const llm = resolveTextLlmFromEnv();
    expect(llm).toBeInstanceOf(MlxLmStdioTextLlm);
    expect(llm?.providerId).toBe("mlx");
  });

  it("uses MLX when only ADVENTURE_LLM_MLX_MODEL is set (no Google, no HTTP)", () => {
    process.env.ADVENTURE_LLM_MLX_MODEL = "mlx-community/gemma-2-2b-it";
    delete process.env.GEMINI_API_KEY;
    delete process.env.ADVENTURE_LLM_HTTP_MODEL;
    const llm = resolveTextLlmFromEnv();
    expect(llm).toBeInstanceOf(MlxLmStdioTextLlm);
  });
});
