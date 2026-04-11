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
    promptPatchSystemEl: doc.getElementById("prompt-patch-system"),
    promptPatchUserPrefixEl: doc.getElementById("prompt-patch-user-prefix"),
    promptPatchUserSuffixEl: doc.getElementById("prompt-patch-user-suffix"),
    promptPatchModelNotesEl: doc.getElementById("prompt-patch-model-notes"),
    promptSystemModeEl: doc.getElementById("prompt-system-mode"),
    promptIncludeDatHelpEl: doc.getElementById("prompt-include-dat-help"),
    promptModelNotesTargetEl: doc.getElementById("prompt-model-notes-target"),
    promptExperimentApplyBtn: doc.getElementById("prompt-experiment-apply"),
    promptExperimentResetBtn: doc.getElementById("prompt-experiment-reset"),
    promptLastSystemEl: doc.getElementById("prompt-last-system"),
    promptLastUserEl: doc.getElementById("prompt-last-user"),
    promptLastMergedEl: doc.getElementById("prompt-last-merged"),
    promptLastMergedWrap: doc.getElementById("prompt-last-merged-wrap"),
    promptLastSplitWrap: doc.getElementById("prompt-last-split"),
    copyPromptLastSystemBtn: doc.getElementById("copy-prompt-last-system"),
    copyPromptLastUserBtn: doc.getElementById("copy-prompt-last-user"),
    copyPromptLastMergedBtn: doc.getElementById("copy-prompt-last-merged"),
    promptActiveProjectEl: doc.getElementById("prompt-active-project"),
    promptProjectSelectEl: doc.getElementById("prompt-project-select"),
    promptProjectNewBtn: doc.getElementById("prompt-project-new"),
    promptProjectActivateBtn: doc.getElementById("prompt-project-activate"),
    promptProjectSaveDiskBtn: doc.getElementById("prompt-project-save-disk"),
    promptProjectDuplicateBtn: doc.getElementById("prompt-project-duplicate"),
    promptProjectDeleteBtn: doc.getElementById("prompt-project-delete"),
    promptProjectStatusEl: doc.getElementById("prompt-project-status"),
    benchmarkLeaderboardRefreshBtn: doc.getElementById(
      "benchmark-leaderboard-refresh",
    ),
    benchmarkLeaderboardPreEl: doc.getElementById("benchmark-leaderboard-pre"),
    llmGenProviderEl: doc.getElementById("llm-gen-provider"),
    llmGenFieldsEl: doc.getElementById("llm-gen-fields"),
    llmGenApplyBtn: doc.getElementById("llm-gen-apply"),
    llmGenStatusEl: doc.getElementById("llm-gen-status"),
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
