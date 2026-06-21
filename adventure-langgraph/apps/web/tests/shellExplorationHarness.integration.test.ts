import { afterEach, describe, expect, it } from "vitest";
import { v3FeatureFlags } from "../src/featureFlags.js";
import { resetShellDomWithFlags } from "./harness/resetShellDom.js";

describe("exploration shell harness (jsdom + real index.html)", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("applies default flags: exploration map visible, legacy assist hidden", () => {
    resetShellDomWithFlags();

    const exploration = document.querySelector<HTMLElement>(
      "#exploration-map-panel",
    );
    const legacy = document.querySelector<HTMLElement>(
      "#v3-legacy-assist-panels",
    );

    expect(exploration?.hidden).toBe(!v3FeatureFlags.explorationMap);
    expect(legacy?.hidden).toBe(!v3FeatureFlags.assistPanels);
  });

  it("keeps probe and inspector controls in DOM with data-v3-flag for toggling", () => {
    resetShellDomWithFlags();

    const probeBlocks = document.querySelectorAll("[data-v3-flag='mapProbe']");
    const inspectorBlocks = document.querySelectorAll(
      "[data-v3-flag='mapInspectors']",
    );

    expect(probeBlocks.length).toBeGreaterThan(0);
    expect(inspectorBlocks.length).toBeGreaterThan(0);
  });
});
