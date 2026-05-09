import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SHELL_UI_PREFS,
  loadShellUiPreferences,
  saveShellUiPreferences,
  SHELL_UI_PREFS_KEY,
  type ShellUiPrefsV1
} from "../apps/web/src/shellUiPreferences.js";

const createMemoryStorage = (): Storage => {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear(): void {
      map.clear();
    },
    getItem(key: string): string | null {
      return map.get(key) ?? null;
    },
    key(index: number): string | null {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string): void {
      map.delete(key);
    },
    setItem(key: string, value: string): void {
      map.set(key, value);
    }
  } as Storage;
};

describe("shellUiPreferences", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults showRawSse to false when unset", () => {
    expect(loadShellUiPreferences()).toEqual(DEFAULT_SHELL_UI_PREFS);
  });

  it("round-trips save and load", () => {
    const prefs: ShellUiPrefsV1 = { version: 1, showRawSse: true };
    saveShellUiPreferences(prefs);
    expect(loadShellUiPreferences()).toEqual(prefs);
    expect(globalThis.localStorage.getItem(SHELL_UI_PREFS_KEY)).toContain("showRawSse");
  });

  it("returns defaults for invalid JSON", () => {
    globalThis.localStorage.setItem(SHELL_UI_PREFS_KEY, "{");
    expect(loadShellUiPreferences()).toEqual(DEFAULT_SHELL_UI_PREFS);
  });

  it("returns defaults when version mismatch", () => {
    globalThis.localStorage.setItem(SHELL_UI_PREFS_KEY, JSON.stringify({ version: 2, showRawSse: true }));
    expect(loadShellUiPreferences()).toEqual(DEFAULT_SHELL_UI_PREFS);
  });
});
