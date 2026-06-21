import { describe, expect, it } from "vitest";
import featureFlagConfig from "../v3-feature-flags.json";
import { isV3FeatureEnabled, v3FeatureFlags } from "./featureFlags.js";

describe("v3FeatureFlags", () => {
  it("matches defaults from v3-feature-flags.json", () => {
    expect(v3FeatureFlags.explorationMap).toBe(
      featureFlagConfig.defaults.explorationMap,
    );
    expect(v3FeatureFlags.assistPanels).toBe(
      featureFlagConfig.defaults.assistPanels,
    );
    expect(v3FeatureFlags.mapProbe).toBe(featureFlagConfig.defaults.mapProbe);
    expect(v3FeatureFlags.mapInspectors).toBe(
      featureFlagConfig.defaults.mapInspectors,
    );
  });

  it("exposes isV3FeatureEnabled for named flags", () => {
    expect(isV3FeatureEnabled("explorationMap")).toBe(
      v3FeatureFlags.explorationMap,
    );
    expect(isV3FeatureEnabled("assistPanels")).toBe(
      v3FeatureFlags.assistPanels,
    );
  });
});
