import { afterEach, describe, expect, it } from "vitest";
import {
  poolKey,
  resolveWebMaxLoadedModels,
} from "./webDashboardTextLlmPool.js";

describe("webDashboardTextLlmPool helpers", () => {
  afterEach(() => {
    delete process.env.ADVENTURE_LM_WEB_MAX_LOADED_MODELS;
  });

  it("resolveWebMaxLoadedModels defaults to 2", () => {
    expect(resolveWebMaxLoadedModels()).toBe(2);
  });

  it("resolveWebMaxLoadedModels parses valid integer in range", () => {
    process.env.ADVENTURE_LM_WEB_MAX_LOADED_MODELS = "5";
    expect(resolveWebMaxLoadedModels()).toBe(5);
  });

  it("resolveWebMaxLoadedModels falls back for invalid values", () => {
    process.env.ADVENTURE_LM_WEB_MAX_LOADED_MODELS = "0";
    expect(resolveWebMaxLoadedModels()).toBe(2);
    process.env.ADVENTURE_LM_WEB_MAX_LOADED_MODELS = "99";
    expect(resolveWebMaxLoadedModels()).toBe(2);
  });

  it("poolKey joins provider and model", () => {
    expect(poolKey("mlx", "m1")).toBe("mlx:m1");
  });
});
