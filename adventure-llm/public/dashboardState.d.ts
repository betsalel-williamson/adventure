export function createDashboardState(): {
  mapMermaidRenderGeneration: number;
  lastTextLlmOptionValue: string;
  mlxModelLoadingUi: boolean;
  sessionStatusBeforeMlxLoad: string;
  transcriptBlocks: { step: number; parts: string[] }[];
  terminalEchoQueue: {
    afterStep: number;
    line: string;
    seq: number;
    moveNumber?: number | null;
  }[];
  terminalEchoSeq: number;
  getinLineByStep: Record<number, string>;
  motionGridHintByStep: Record<number, string | null>;
  waitingForManual: boolean;
  autoplayTerminalPromptChain: Promise<void>;
  autoplayTranscriptHoldMove: number | null;
  autoplayTranscriptHoldBuffer: Map<number, string[]>;
  activeSessionAutoplayMeta: {
    paceMs: number;
    maxMoves: number;
    providerId: string;
  } | null;
  autoplaySettingsSaveTimer: ReturnType<typeof setTimeout> | null;
};

export const state: ReturnType<typeof createDashboardState>;
