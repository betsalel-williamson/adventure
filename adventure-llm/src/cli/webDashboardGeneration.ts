import type { TextLlm } from "@adventure-llm/nl-glue";
import { GoogleGenerativeAiTextLlm } from "../nl/providers/googleGenerativeAiTextLlm.js";
import { HttpOpenAiCompatibleTextLlm } from "../nl/providers/httpOpenAiCompatibleTextLlm.js";
import { MlxLmStdioTextLlm } from "../nl/providers/mlxLmStdioTextLlm.js";
import type { PromptProjectGenerationParams } from "./promptProjectsStore.js";

export type GenerationFieldMeta = {
  readonly key: string;
  readonly type: "number";
  readonly min: number;
  readonly max: number;
  readonly step: number;
};

export function snapshotGenerationMeta(client: TextLlm): {
  readonly providerId: string;
  readonly values: Record<string, number>;
  readonly fields: readonly GenerationFieldMeta[];
} {
  if (client instanceof MlxLmStdioTextLlm) {
    const v = client.getDashboardGenerationOptions();
    return {
      providerId: "mlx",
      values: { maxTokens: v.maxTokens, temperature: v.temperature },
      fields: [
        { key: "maxTokens", type: "number", min: 32, max: 32768, step: 32 },
        { key: "temperature", type: "number", min: 0, max: 2, step: 0.05 },
      ],
    };
  }
  if (client instanceof HttpOpenAiCompatibleTextLlm) {
    const v = client.getDashboardGenerationOptions();
    const values: Record<string, number> = {
      temperature: v.temperature,
    };
    if (v.maxTokens !== undefined) values.maxTokens = v.maxTokens;
    return {
      providerId: "http",
      values,
      fields: [
        { key: "temperature", type: "number", min: 0, max: 2, step: 0.05 },
        { key: "maxTokens", type: "number", min: 1, max: 128_000, step: 1 },
      ],
    };
  }
  if (client instanceof GoogleGenerativeAiTextLlm) {
    const v = client.getDashboardGenerationOptions();
    const values: Record<string, number> = {};
    if (v.temperature !== undefined) values.temperature = v.temperature;
    if (v.maxOutputTokens !== undefined)
      values.maxOutputTokens = v.maxOutputTokens;
    return {
      providerId: "google",
      values,
      fields: [
        { key: "temperature", type: "number", min: 0, max: 2, step: 0.05 },
        { key: "maxOutputTokens", type: "number", min: 1, max: 8192, step: 1 },
      ],
    };
  }
  return { providerId: client.providerId, values: {}, fields: [] };
}

/** Returns an error message or null on success. */
export function applyGenerationParamsPatch(
  client: TextLlm,
  body: Record<string, unknown>,
): string | null {
  if (client instanceof MlxLmStdioTextLlm) {
    const maxTokens =
      body.maxTokens !== undefined ? Number(body.maxTokens) : undefined;
    const temperature =
      body.temperature !== undefined ? Number(body.temperature) : undefined;
    const o: { maxTokens?: number; temperature?: number } = {};
    if (maxTokens !== undefined && Number.isFinite(maxTokens))
      o.maxTokens = maxTokens;
    if (temperature !== undefined && Number.isFinite(temperature))
      o.temperature = temperature;
    if (Object.keys(o).length > 0) client.setDashboardGenerationOptions(o);
    return null;
  }
  if (client instanceof HttpOpenAiCompatibleTextLlm) {
    const maxTokens =
      body.maxTokens !== undefined ? Number(body.maxTokens) : undefined;
    const temperature =
      body.temperature !== undefined ? Number(body.temperature) : undefined;
    const o: { maxTokens?: number; temperature?: number } = {};
    if (maxTokens !== undefined && Number.isFinite(maxTokens))
      o.maxTokens = maxTokens;
    if (temperature !== undefined && Number.isFinite(temperature))
      o.temperature = temperature;
    if (Object.keys(o).length > 0) client.setDashboardGenerationOptions(o);
    return null;
  }
  if (client instanceof GoogleGenerativeAiTextLlm) {
    const maxOutputTokens =
      body.maxOutputTokens !== undefined
        ? Number(body.maxOutputTokens)
        : undefined;
    const temperature =
      body.temperature !== undefined ? Number(body.temperature) : undefined;
    const o: { maxOutputTokens?: number; temperature?: number } = {};
    if (maxOutputTokens !== undefined && Number.isFinite(maxOutputTokens))
      o.maxOutputTokens = maxOutputTokens;
    if (temperature !== undefined && Number.isFinite(temperature))
      o.temperature = temperature;
    if (Object.keys(o).length > 0) client.setDashboardGenerationOptions(o);
    return null;
  }
  return "Generation overrides are not available for this provider";
}

export function buildGenerationParamsSnapshot(
  client: TextLlm | null,
): PromptProjectGenerationParams {
  if (!client) return {};
  if (client instanceof MlxLmStdioTextLlm) {
    const o = client.getDashboardGenerationOptions();
    return { mlx: { maxTokens: o.maxTokens, temperature: o.temperature } };
  }
  if (client instanceof HttpOpenAiCompatibleTextLlm) {
    const o = client.getDashboardGenerationOptions();
    return {
      http: {
        temperature: o.temperature,
        ...(o.maxTokens !== undefined ? { maxTokens: o.maxTokens } : {}),
      },
    };
  }
  if (client instanceof GoogleGenerativeAiTextLlm) {
    const o = client.getDashboardGenerationOptions();
    return {
      google: {
        ...(o.temperature !== undefined ? { temperature: o.temperature } : {}),
        ...(o.maxOutputTokens !== undefined
          ? { maxOutputTokens: o.maxOutputTokens }
          : {}),
      },
    };
  }
  return {};
}
