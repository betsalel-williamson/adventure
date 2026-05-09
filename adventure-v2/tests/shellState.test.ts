import { describe, expect, it } from "vitest";
import { appendTranscriptLine } from "../apps/web/src/shellState.js";

describe("shellState", () => {
  it("appendTranscriptLine joins with newline", () => {
    expect(appendTranscriptLine("", "a")).toBe("a");
    expect(appendTranscriptLine("a", "b")).toBe("a\nb");
  });
});
