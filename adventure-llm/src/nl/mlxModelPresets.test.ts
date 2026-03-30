import { describe, expect, it } from "vitest";
import {
  isAllowedMlxWebModelId,
  mlxWebModelPresetsList,
} from "./mlxModelPresets.js";

describe("mlxModelPresets", () => {
  it("allows preset ids and rejects unknown ids", () => {
    const presets = mlxWebModelPresetsList();
    expect(presets.length).toBeGreaterThan(0);
    for (const id of presets) {
      expect(isAllowedMlxWebModelId(id)).toBe(true);
    }
    expect(isAllowedMlxWebModelId("unknown/model")).toBe(false);
    expect(isAllowedMlxWebModelId("")).toBe(false);
  });
});
