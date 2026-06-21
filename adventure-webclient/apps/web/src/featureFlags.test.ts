import { describe, expect, it } from "vitest";
import featureFlagConfig from "../webclient-feature-flags.json";
import {
  isWebclientFeatureEnabled,
  webclientFeatureFlags,
} from "./featureFlags.js";

describe("webclientFeatureFlags", () => {
  it("matches defaults from webclient-feature-flags.json", () => {
    for (const [name, expected] of Object.entries(
      featureFlagConfig.defaults,
    )) {
      expect(webclientFeatureFlags[name as keyof typeof featureFlagConfig.defaults]).toBe(
        expected,
      );
    }
  });

  it("exposes isWebclientFeatureEnabled for named flags", () => {
    expect(isWebclientFeatureEnabled("crtTranscript")).toBe(
      webclientFeatureFlags.crtTranscript,
    );
    expect(isWebclientFeatureEnabled("featureFlagDevPanel")).toBe(
      webclientFeatureFlags.featureFlagDevPanel,
    );
  });
});
