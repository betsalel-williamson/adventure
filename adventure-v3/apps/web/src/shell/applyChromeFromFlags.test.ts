import { describe, expect, it } from "vitest";
import { v3FeatureFlags } from "../featureFlags.js";
import { applyV3ChromeFromFlags } from "./applyChromeFromFlags.js";

describe("applyV3ChromeFromFlags", () => {
  it("hides legacy assist panels when assistPanels is off", () => {
    document.body.innerHTML = `
      <section id="exploration-map-panel"></section>
      <div id="v3-legacy-assist-panels"></div>
      <details data-v3-flag="mapInspectors"></details>
      <div data-v3-flag="mapProbe"></div>
    `;

    applyV3ChromeFromFlags();

    const exploration = document.querySelector<HTMLElement>(
      "#exploration-map-panel",
    );
    const legacy = document.querySelector<HTMLElement>(
      "#v3-legacy-assist-panels",
    );
    expect(exploration?.hidden).toBe(!v3FeatureFlags.explorationMap);
    expect(legacy?.hidden).toBe(!v3FeatureFlags.assistPanels);
  });
});
