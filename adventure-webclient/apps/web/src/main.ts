/// <reference types="vite/client" />

import { formatBackendSummary, resolveWebclientBackends } from "./backends/config.js";
import { webclientFeatureFlags } from "./featureFlags.js";
import {
  applyWebclientChromeFromFlags,
  renderFeatureFlagDevPanel,
} from "./shell/applyChromeFromFlags.js";

const statusStripEl = document.querySelector<HTMLElement>("#status-strip");
const backendSummaryEl = document.querySelector<HTMLElement>("#backend-summary");
const devPanelEl = document.querySelector<HTMLElement>("#feature-flag-dev-panel-body");
const transcriptEl = document.querySelector<HTMLElement>("#crt-transcript");

const backends = resolveWebclientBackends();

applyWebclientChromeFromFlags();

if (statusStripEl) {
  statusStripEl.textContent = "Webclient shell — connect backends to play.";
}

if (backendSummaryEl) {
  backendSummaryEl.textContent = formatBackendSummary(backends);
}

if (devPanelEl && webclientFeatureFlags.featureFlagDevPanel) {
  renderFeatureFlagDevPanel(devPanelEl);
}

if (transcriptEl && webclientFeatureFlags.crtTranscript) {
  transcriptEl.textContent =
    "ADVENTURE WEBCLIENT\n\n" +
    "This shell preserves UI work from adventure-nl and adventure-langgraph.\n" +
    "Enable panels via feature flags, then wire backend adapters.\n\n" +
    `Backends: ${formatBackendSummary(backends)}\n`;
}
