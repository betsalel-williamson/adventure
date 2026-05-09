/**
 * Persist dev-shell console state in localStorage so a refresh can restore transcript panels.
 * Server runs are reattached when `GET /runs/:id/checkpoints` succeeds for the saved `runId`.
 */

export const SHELL_SESSION_STORAGE_KEY = "adventure-v2.shell.session.v1";

export type PersistedShellSessionV1 = {
  version: 1;
  savedAt: string;
  apiBase: string;
  runId: string;
  transcriptText: string;
  gameTerminalText: string;
  cognitionTraceText: string;
  phaseTimelineText: string;
  phaseCurrentText: string;
  reconcileText: string;
  checkpointsText: string;
  runMetaDisplay: string;
  cognitionProfileInput: string;
};

export const loadPersistedSession = (): PersistedShellSessionV1 | null => {
  if (typeof localStorage === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem(SHELL_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const rec = parsed as Record<string, unknown>;
    if (rec.version !== 1) {
      return null;
    }
    const strings = [
      "savedAt",
      "apiBase",
      "runId",
      "transcriptText",
      "gameTerminalText",
      "cognitionTraceText",
      "phaseTimelineText",
      "phaseCurrentText",
      "reconcileText",
      "checkpointsText",
      "runMetaDisplay",
      "cognitionProfileInput"
    ] as const;
    for (const k of strings) {
      if (typeof rec[k] !== "string") {
        return null;
      }
    }
    return rec as unknown as PersistedShellSessionV1;
  } catch {
    return null;
  }
};

export const savePersistedSession = (session: PersistedShellSessionV1): void => {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(SHELL_SESSION_STORAGE_KEY, JSON.stringify(session));
};

export const clearPersistedSession = (): void => {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.removeItem(SHELL_SESSION_STORAGE_KEY);
};
