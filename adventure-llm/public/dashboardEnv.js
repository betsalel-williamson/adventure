/**
 * Browser / test harness ports (fetch, EventSource, storage, timers).
 * @returns {{
 *   fetch: typeof fetch;
 *   EventSource: typeof EventSource;
 *   localStorage: Storage;
 *   location: Location;
 *   requestAnimationFrame: typeof requestAnimationFrame;
 * }}
 */
export function defaultPorts() {
  const g = globalThis;
  return {
    fetch: g.fetch.bind(g),
    EventSource: g.EventSource,
    localStorage: g.localStorage,
    location: g.location,
    requestAnimationFrame: g.requestAnimationFrame.bind(g),
  };
}

/**
 * Resolve dashboard DOM nodes from a document (tests pass a happy-dom document).
 * @param {Document} doc
 */
export function resolveDashboardElements(doc) {
  return {
    transcriptEl: doc.getElementById("transcript"),
    autoplayLogEl: doc.getElementById("autoplay-log"),
    sessionStatusEl: doc.getElementById("session-status"),
    spinnerEl: doc.getElementById("planner-spinner"),
    lastPlanEl: doc.getElementById("last-plan"),
    locationHintEl: doc.getElementById("location-hint"),
    inventoryEl: doc.getElementById("inventory"),
    stagnationEl: doc.getElementById("stagnation"),
    tryNextEl: doc.getElementById("try-next"),
    mapGridEl: doc.getElementById("map-grid"),
    mapCoordsEl: doc.getElementById("map-coords"),
    mapRoomKindEl: doc.getElementById("map-room-kind"),
    mapLegendEl: doc.getElementById("map-legend"),
    mapZInput: doc.getElementById("map-z"),
    mapMermaidEl: doc.getElementById("map-mermaid"),
    mapViewportEl: doc.querySelector(".map-viewport"),
    mapMermaidSrcEl: doc.getElementById("map-mermaid-src"),
    mapDotSrcEl: doc.getElementById("map-dot-src"),
    mapNullKeysEl: doc.getElementById("map-null-keys"),
    copyMermaidBtn: doc.getElementById("copy-mermaid"),
    copyDotBtn: doc.getElementById("copy-dot"),
    mermaidFullscreenDialog: doc.getElementById("mermaid-fullscreen-dialog"),
    mermaidFullscreenBody: doc.getElementById("mermaid-fullscreen-body"),
    mermaidFullscreenOpenBtn: doc.getElementById("mermaid-fullscreen-open"),
    mermaidFullscreenCloseBtn: doc.getElementById("mermaid-fullscreen-close"),
    promptUserEl: doc.getElementById("prompt-user"),
    promptSystemEl: doc.getElementById("prompt-system"),
    promptSystemWrap: doc.getElementById("prompt-system-wrap"),
    copyPromptUserBtn: doc.getElementById("copy-prompt-user"),
    copyPromptSystemBtn: doc.getElementById("copy-prompt-system"),
    autoplayToggle: doc.getElementById("autoplay-toggle"),
    autoplayPaceMsEl: doc.getElementById("autoplay-pace-ms"),
    autoplayMaxMovesEl: doc.getElementById("autoplay-max-moves"),
    manualBanner: doc.getElementById("manual-banner"),
    manualInput: doc.getElementById("manual-input"),
    manualInterpretToggle: doc.getElementById("manual-interpret-toggle"),
    manualSend: doc.getElementById("manual-send"),
    manualEndSession: doc.getElementById("manual-end-session"),
    manualError: doc.getElementById("manual-error"),
    transcriptLayoutToggle: doc.getElementById("transcript-layout-toggle"),
    textLlmWrap: doc.getElementById("text-llm-wrap"),
    textLlmSelect: doc.getElementById("text-llm-select"),
    mlxLoadOverlay: doc.getElementById("mlx-load-overlay"),
    mlxLoadTitleEl: doc.getElementById("mlx-load-title"),
    mlxLoadProgressEl: doc.getElementById("mlx-load-progress"),
    mlxLoadCancelBtn: doc.getElementById("mlx-load-cancel"),
  };
}
