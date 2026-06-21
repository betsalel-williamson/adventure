import { v3FeatureFlags } from "../featureFlags.js";

export const applyV3ChromeFromFlags = (): void => {
  const explorationRoot = document.querySelector<HTMLElement>(
    "#exploration-map-panel",
  );
  const legacyAssistRoot = document.querySelector<HTMLElement>(
    "#v3-legacy-assist-panels",
  );
  const mapInspectors = document.querySelectorAll<HTMLElement>(
    "[data-v3-flag='mapInspectors']",
  );
  const mapProbeControls = document.querySelectorAll<HTMLElement>(
    "[data-v3-flag='mapProbe']",
  );

  if (explorationRoot) {
    explorationRoot.hidden = !v3FeatureFlags.explorationMap;
  }
  if (legacyAssistRoot) {
    legacyAssistRoot.hidden = !v3FeatureFlags.assistPanels;
  }

  for (const el of mapInspectors) {
    el.hidden = !v3FeatureFlags.mapInspectors;
  }
  for (const el of mapProbeControls) {
    el.hidden = !v3FeatureFlags.mapProbe;
  }
};
