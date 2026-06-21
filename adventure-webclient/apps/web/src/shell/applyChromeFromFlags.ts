import {
  listEnabledWebclientFeatures,
  webclientFeatureFlags,
  type WebclientFeatureFlagName,
} from "../featureFlags.js";

const PANEL_SELECTORS: Partial<Record<WebclientFeatureFlagName, string>> = {
  crtTranscript: "#crt-transcript-panel",
  statusStrip: "#status-strip",
  explorationMapMermaid: "#exploration-map-mermaid-panel",
  explorationMapGrid: "#exploration-map-grid-panel",
  assistPanels: "#legacy-assist-panels",
  mapProbe: "[data-panel=map-probe]",
  mapInspectors: "[data-panel=map-inspectors]",
  sessionSignals: "#session-signals-panel",
  assistancePosture: "#assistance-posture-panel",
  promptLab: "#prompt-lab-panel",
  autoplayControls: "#autoplay-controls-panel",
  sessionFsmMermaid: "#session-fsm-panel",
  cognitionOrchestration: "#cognition-orchestration-panel",
  statelyInspect: "#stately-inspect-panel",
  leaderboard: "#leaderboard-panel",
  featureFlagDevPanel: "#feature-flag-dev-panel",
};

export const applyWebclientChromeFromFlags = (): void => {
  for (const [name, selector] of Object.entries(PANEL_SELECTORS)) {
    const flag = name as WebclientFeatureFlagName;
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) {
      continue;
    }
    const enabled = webclientFeatureFlags[flag];
    el.hidden = !enabled;
    el.setAttribute("aria-hidden", enabled ? "false" : "true");
  }
};

export const renderFeatureFlagDevPanel = (
  root: HTMLElement,
  enabled: readonly WebclientFeatureFlagName[] = listEnabledWebclientFeatures(),
): void => {
  root.replaceChildren();
  const heading = document.createElement("h2");
  heading.textContent = "Enabled features";
  root.append(heading);

  const list = document.createElement("ul");
  for (const name of enabled) {
    const item = document.createElement("li");
    item.textContent = name;
    list.append(item);
  }
  root.append(list);

  const hint = document.createElement("p");
  hint.className = "webclient-muted";
  hint.textContent =
    "Toggle with ?flag=true query params or sessionStorage adventure-webclient-flag-<name>. See docs/features/webclient/feature-catalog.md.";
  root.append(hint);
};
