import { describe, expect, it } from "vitest";
import { parseSseJson } from "../public/sseJson.js";

describe("parseSseJson", () => {
  it("returns null for non-string input", () => {
    expect(parseSseJson(null)).toBeNull();
    expect(parseSseJson(1)).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseSseJson("")).toBeNull();
    expect(parseSseJson("{")).toBeNull();
  });

  it("parses valid JSON", () => {
    expect(parseSseJson('{"a":1}')).toEqual({ a: 1 });
  });
});
