import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mergeHttpWebPresetsFromEnv } from "./httpWebPresets.js";
import { resetTextLlmWebPresetsCacheForTests } from "./textLlmWebPresetsConfig.js";

describe("mergeHttpWebPresetsFromEnv", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    delete process.env.ADVENTURE_LLM_HTTP_MODEL;
    delete process.env.ADVENTURE_LLM_HTTP_WEB_PRESETS;
    delete process.env.ADVENTURE_LLM_WEB_PRESETS_YAML;
    resetTextLlmWebPresetsCacheForTests();
  });

  afterEach(() => {
    process.env = { ...prev };
    resetTextLlmWebPresetsCacheForTests();
  });

  it("includes default model first and dedupes extras", () => {
    process.env.ADVENTURE_LLM_HTTP_MODEL = "a";
    process.env.ADVENTURE_LLM_HTTP_WEB_PRESETS = "b, a , c";
    expect(mergeHttpWebPresetsFromEnv()).toEqual(["a", "b", "c"]);
  });

  it("appends providers.http.models from YAML after env merge", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "adv-http-yaml-"));
    const yamlPath = path.join(dir, "presets.yaml");
    writeFileSync(
      yamlPath,
      [
        "version: 1",
        "providers:",
        "  http:",
        "    models:",
        "      - yaml-only",
        "  mlx:",
        "    models: []",
        "  google:",
        "    models: []",
        "",
      ].join("\n"),
      "utf8",
    );
    process.env.ADVENTURE_LLM_WEB_PRESETS_YAML = yamlPath;
    process.env.ADVENTURE_LLM_HTTP_MODEL = "a";
    resetTextLlmWebPresetsCacheForTests();
    expect(mergeHttpWebPresetsFromEnv()).toEqual(["a", "yaml-only"]);
    rmSync(dir, { recursive: true });
  });
});
