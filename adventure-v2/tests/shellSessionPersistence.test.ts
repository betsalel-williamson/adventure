import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPersistedSession,
  loadPersistedSession,
  savePersistedSession,
  SHELL_SESSION_STORAGE_KEY,
  type PersistedShellSessionV1
} from "../apps/web/src/shellSessionPersistence.js";

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

const minimalSession = (): PersistedShellSessionV1 => ({
  version: 1,
  savedAt: "2026-01-01T00:00:00.000Z",
  apiBase: "http://127.0.0.1:8787",
  runId: "run-1",
  transcriptText: "a",
  gameTerminalText: "b",
  cognitionTraceText: "c",
  phaseTimelineText: "d",
  phaseCurrentText: "current: act",
  reconcileText: "e",
  checkpointsText: "f",
  runMetaDisplay: "meta",
  cognitionProfileInput: "default"
});

describe("shellSessionPersistence", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips save and load", () => {
    const s = minimalSession();
    savePersistedSession(s);
    expect(loadPersistedSession()).toEqual(s);
  });

  it("clearPersistedSession removes the key", () => {
    savePersistedSession(minimalSession());
    clearPersistedSession();
    expect(globalThis.localStorage.getItem(SHELL_SESSION_STORAGE_KEY)).toBeNull();
    expect(loadPersistedSession()).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    globalThis.localStorage.setItem(SHELL_SESSION_STORAGE_KEY, "{not-json");
    expect(loadPersistedSession()).toBeNull();
  });

  it("returns null when version is not 1", () => {
    globalThis.localStorage.setItem(
      SHELL_SESSION_STORAGE_KEY,
      JSON.stringify({ ...minimalSession(), version: 2 })
    );
    expect(loadPersistedSession()).toBeNull();
  });

  it("returns null when a required string field is missing", () => {
    const raw: Record<string, unknown> = { ...minimalSession() };
    delete raw.runId;
    globalThis.localStorage.setItem(SHELL_SESSION_STORAGE_KEY, JSON.stringify(raw));
    expect(loadPersistedSession()).toBeNull();
  });

  it("returns null when localStorage is unavailable", () => {
    vi.unstubAllGlobals();
    expect(loadPersistedSession()).toBeNull();
    savePersistedSession(minimalSession());
    // no throw
  });
});
