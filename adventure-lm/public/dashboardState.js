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
    /**
     * True while the feed's scroll position is being updated by layout/render (not the user).
     * Suppresses the transcript scroll listener so replaceChildren / pin-to-bottom does not
     * clear "following tail" by accident.
     */
    transcriptScrollIsProgrammatic: false,
    /**
     * Terminal layout: viewer is following live output (scroll viewport pinned to the last line),
     * like a normal terminal. Updated from scroll position; defaults true. When false, new
     * output preserves scrollback position (delta from height change).
     */
    transcriptStickToBottom: true,
  };
}

/** Live singleton for the browser dashboard. */
export const state = createDashboardState();
