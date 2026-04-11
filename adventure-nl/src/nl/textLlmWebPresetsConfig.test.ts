import { describe, expect, it } from "vitest";
import {
  parseTextLlmWebPresetsYaml,
  DEFAULT_TEXT_LLM_WEB_PRESETS,
  sortWebDashboardModelIds,
} from "./textLlmWebPresetsConfig.js";

describe("parseTextLlmWebPresetsYaml", () => {
  it("accepts string models and { id } objects", () => {
    const n = parseTextLlmWebPresetsYaml(`
version: 1
providers:
  mlx:
    models:
      - mlx-community/a
      - id: mlx-community/b
  google:
    models:
      - id: gemini-x
  http:
    models:
      - extra-http
`);
    expect(n.mlx).toEqual(["mlx-community/a", "mlx-community/b"]);
    expect(n.google).toEqual(["gemini-x"]);
    expect(n.http).toEqual(["extra-http"]);
    expect(n.futureApiProviders).toEqual({});
  });

  it("uses providers.api.google when present", () => {
    const n = parseTextLlmWebPresetsYaml(`
version: 1
providers:
  api:
    google:
      models:
        - gemini-2.5-flash
    openai:
      models:
        - gpt-4o
`);
    expect(n.google).toEqual(["gemini-2.5-flash"]);
    expect(n.futureApiProviders).toEqual({ openai: ["gpt-4o"] });
  });

  it("prefers api.google over legacy providers.google when both set", () => {
    const n = parseTextLlmWebPresetsYaml(`
version: 1
providers:
  google:
    models:
      - legacy-id
  api:
    google:
      models:
        - from-api
`);
    expect(n.google).toEqual(["from-api"]);
  });

  it("falls back to legacy providers.google when api.google has no models", () => {
    const n = parseTextLlmWebPresetsYaml(`
version: 1
providers:
  google:
    models:
      - gemini-from-legacy
  api:
    google: {}
`);
    expect(n.google).toEqual(["gemini-from-legacy"]);
  });

  it("falls back to legacy when api.google has empty models array", () => {
    const n = parseTextLlmWebPresetsYaml(`
version: 1
providers:
  google:
    models:
      - gemini-from-legacy
  api:
    google:
      models: []
`);
    expect(n.google).toEqual(["gemini-from-legacy"]);
  });

  it("defaults missing provider blocks to empty lists", () => {
    const n = parseTextLlmWebPresetsYaml(
      `version: 1\nproviders:\n  mlx:\n    models: []\n`,
    );
    expect(n.mlx).toEqual([]);
    expect(n.http).toEqual([]);
    expect(n.google).toEqual([]);
    expect(n.futureApiProviders).toEqual({});
  });

  it("rejects invalid yaml shape", () => {
    expect(() =>
      parseTextLlmWebPresetsYaml(`providers:\n  mlx: "oops"\n`),
    ).toThrow(/invalid shape/i);
  });
});

describe("DEFAULT_TEXT_LLM_WEB_PRESETS", () => {
  it("has mlx and google entries for offline fallback", () => {
    expect(DEFAULT_TEXT_LLM_WEB_PRESETS.mlx.length).toBeGreaterThan(0);
    expect(DEFAULT_TEXT_LLM_WEB_PRESETS.google.length).toBeGreaterThan(0);
    expect(Array.isArray(DEFAULT_TEXT_LLM_WEB_PRESETS.http)).toBe(true);
    expect(typeof DEFAULT_TEXT_LLM_WEB_PRESETS.futureApiProviders).toBe(
      "object",
    );
  });
});

describe("sortWebDashboardModelIds", () => {
  it("orders lexically with numeric-aware segments", () => {
    expect(sortWebDashboardModelIds(["m10", "m2", "m1"])).toEqual([
      "m1",
      "m2",
      "m10",
    ]);
  });
});
