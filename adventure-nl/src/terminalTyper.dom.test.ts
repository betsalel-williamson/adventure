/// <reference lib="dom" />

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { typeTextIntoInput, typeTextIntoPre } from "../public/terminalTyper.js";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "Audio",
    class FakeAudio {
      src = "";
      currentTime = 0;
      play() {
        return Promise.resolve();
      }
      constructor(src?: string) {
        if (src !== undefined) this.src = src;
      }
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("terminalTyper (DOM)", () => {
  it("typeTextIntoPre appends characters in order", async () => {
    const pre = document.createElement("pre");
    const done = typeTextIntoPre(null, pre, "ab", {
      charDelayMs: 0,
      finalPauseMs: 0,
    });
    await vi.runAllTimersAsync();
    await done;
    expect(pre.textContent).toBe("ab");
  });

  it("typeTextIntoInput with null input resolves", async () => {
    const done = typeTextIntoInput(null, "x", {
      charDelayMs: 0,
      finalPauseMs: 0,
    });
    await vi.runAllTimersAsync();
    await done;
  });

  it("typeTextIntoInput uppercases and fills value", async () => {
    const input = document.createElement("input");
    const done = typeTextIntoInput(input, "ab", {
      charDelayMs: 0,
      finalPauseMs: 0,
    });
    await vi.runAllTimersAsync();
    await done;
    expect(input.value).toBe("AB");
  });
});
