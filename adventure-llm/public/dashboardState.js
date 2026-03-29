/** Mutable dashboard session state (single bag for testing and orchestration). */
export function createDashboardState() {
  return {
    mapMermaidRenderGeneration: 0,
    lastTextLlmOptionValue: "",
    mlxModelLoadingUi: false,
    sessionStatusBeforeMlxLoad: "",
    transcriptBlocks: [],
    terminalEchoQueue: [],
    terminalEchoSeq: 0,
    getinLineByStep: {},
    motionGridHintByStep: {},
    waitingForManual: false,
    autoplayTerminalPromptChain: Promise.resolve(),
    autoplayTranscriptHoldMove: null,
    autoplayTranscriptHoldBuffer: new Map(),
    activeSessionAutoplayMeta: null,
    autoplaySettingsSaveTimer: null,
  };
}

/** Live singleton for the browser dashboard. */
export const state = createDashboardState();
