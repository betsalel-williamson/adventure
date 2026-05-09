/**
 * Client-only UI toggles for the dev shell (orthogonal to persisted session transcript).
 */

export const SHELL_UI_PREFS_KEY = "adventure-v2.shell.ui.v1";

export type ShellUiPrefsV1 = {
  version: 1;
  /** Whether the raw SSE debug panel is visible */
  showRawSse: boolean;
};

export const DEFAULT_SHELL_UI_PREFS: ShellUiPrefsV1 = {
  version: 1,
  showRawSse: false
};

export const loadShellUiPreferences = (): ShellUiPrefsV1 => {
  if (typeof localStorage === "undefined") {
    return DEFAULT_SHELL_UI_PREFS;
  }
  try {
    const raw = localStorage.getItem(SHELL_UI_PREFS_KEY);
    if (!raw) {
      return DEFAULT_SHELL_UI_PREFS;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return DEFAULT_SHELL_UI_PREFS;
    }
    const rec = parsed as Record<string, unknown>;
    if (rec.version !== 1 || typeof rec.showRawSse !== "boolean") {
      return DEFAULT_SHELL_UI_PREFS;
    }
    return { version: 1, showRawSse: rec.showRawSse };
  } catch {
    return DEFAULT_SHELL_UI_PREFS;
  }
};

export const saveShellUiPreferences = (prefs: ShellUiPrefsV1): void => {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(SHELL_UI_PREFS_KEY, JSON.stringify(prefs));
};
