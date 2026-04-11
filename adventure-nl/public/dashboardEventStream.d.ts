export type DashboardEventRegistry = {
  renderParserVerbHintGroups: (
    groups: string[][],
    meta?: { datAvailable?: boolean },
  ) => void;
  setManualUiState: () => void;
  applyLiveAutoplaySessionStatusFromPaceAndMax: (
    paceMs: number,
    maxMoves: number,
  ) => void;
  setAutoplayPaceSelectValue: (ms: number) => void;
  clearManualError: () => void;
  setSessionStatus: (text: string) => void;
  clearMlxLoadProgressText: () => void;
  setMlxLoadOverlayVisible: (show: boolean) => void;
  setPlannerThinking: (on: boolean) => void;
  appendMlxLoadProgress: (chunk: string) => void;
  formatAutoplaySessionStatusLine: (meta: {
    paceMs: number;
    maxMoves: number;
    providerId: string;
  }) => string;
  refreshModeFromServer: () => Promise<void>;
  initTextLlmPicker: () => Promise<void>;
  typingTimingFromPaceSelect: () => {
    charDelayMs: number;
    finalPauseMs: number;
  };
};

export function registerDashboardEventHandlers(
  es: EventSource,
  reg: DashboardEventRegistry,
): void;
