import { describe, expect, it } from "vitest";
import { isAllowedGoogleWebModelId } from "./googleWebModelPresets.js";

describe("isAllowedGoogleWebModelId", () => {
  it("allows curated ids and rejects unknown", () => {
    expect(isAllowedGoogleWebModelId("gemini-2.5-flash")).toBe(true);
    expect(isAllowedGoogleWebModelId("unknown-model")).toBe(false);
  });
});
