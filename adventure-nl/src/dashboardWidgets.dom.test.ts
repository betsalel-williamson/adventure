import { describe, expect, it } from "vitest";
import { bindDashboardElements } from "../public/dashboardElementRefs.js";
import { resolveDashboardElements } from "../public/dashboardEnv.js";
import { wireMapVisualTabs } from "../public/dashboardWidgets.js";

function minimalMapTabsDoc() {
  const doc = document.implementation.createHTMLDocument("map-tabs");
  doc.body.innerHTML = `
    <button type="button" id="tab-btn-mermaid" class="map-visual-tab active"></button>
    <button type="button" id="tab-btn-xstate" class="map-visual-tab"></button>
    <div id="tab-panel-mermaid" class="map-tab-panel active"></div>
    <div id="tab-panel-xstate" class="map-tab-panel"></div>
  `;
  return doc;
}

describe("wireMapVisualTabs", () => {
  it("activates XState panel and tab when Cognition tab is clicked", () => {
    const doc = minimalMapTabsDoc();
    bindDashboardElements(resolveDashboardElements(doc));
    wireMapVisualTabs();

    doc.getElementById("tab-btn-xstate")?.click();

    expect(
      doc.getElementById("tab-btn-xstate")?.classList.contains("active"),
    ).toBe(true);
    expect(
      doc.getElementById("tab-btn-mermaid")?.classList.contains("active"),
    ).toBe(false);
    expect(
      doc.getElementById("tab-panel-xstate")?.classList.contains("active"),
    ).toBe(true);
    expect(
      doc.getElementById("tab-panel-mermaid")?.classList.contains("active"),
    ).toBe(false);
  });

  it("restores Mermaid panel and tab when Game Map tab is clicked", () => {
    const doc = minimalMapTabsDoc();
    bindDashboardElements(resolveDashboardElements(doc));
    wireMapVisualTabs();

    doc.getElementById("tab-btn-xstate")?.click();
    doc.getElementById("tab-btn-mermaid")?.click();

    expect(
      doc.getElementById("tab-btn-mermaid")?.classList.contains("active"),
    ).toBe(true);
    expect(
      doc.getElementById("tab-btn-xstate")?.classList.contains("active"),
    ).toBe(false);
    expect(
      doc.getElementById("tab-panel-mermaid")?.classList.contains("active"),
    ).toBe(true);
    expect(
      doc.getElementById("tab-panel-xstate")?.classList.contains("active"),
    ).toBe(false);
  });
});
