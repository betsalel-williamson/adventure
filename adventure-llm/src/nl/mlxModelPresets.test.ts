import { describe, expect, it } from "vitest";
import {
  isAllowedMlxWebModelId,
  MLX_WEB_MODEL_PRESETS,
} from "./mlxModelPresets.js";

describe("mlxModelPresets", () => {
  it("allows preset ids and rejects unknown ids", () => {
    expect(MLX_WEB_MODEL_PRESETS.length).toBeGreaterThan(0);
    for (const id of MLX_WEB_MODEL_PRESETS) {
      expect(isAllowedMlxWebModelId(id)).toBe(true);
    }
    expect(isAllowedMlxWebModelId("unknown/model")).toBe(false);
    expect(isAllowedMlxWebModelId("")).toBe(false);
  });
});
