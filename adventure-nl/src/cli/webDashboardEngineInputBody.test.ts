import { describe, expect, it } from "vitest";
import {
  parseScriptedLineFromEngineJsonBody,
  scriptedPrimaryLine,
} from "./webDashboardEngineInputBody.js";

/**
 * TDD contract for POST /api/engine/input JSON body parsing (shared with legacy aliases).
 */
describe("parseScriptedLineFromEngineJsonBody", () => {
  it("returns undefined when neither scripted nor getinLine is usable", () => {
    expect(parseScriptedLineFromEngineJsonBody({})).toBeUndefined();
    expect(
      parseScriptedLineFromEngineJsonBody({ getinLine: "" }),
    ).toBeUndefined();
    expect(
      parseScriptedLineFromEngineJsonBody({ getinLine: "   " }),
    ).toBeUndefined();
  });

  it("uses getinLine with trimEnd when scripted is absent", () => {
    expect(parseScriptedLineFromEngineJsonBody({ getinLine: "east    " })).toBe(
      "east",
    );
  });

  it("prefers scripted string over getinLine", () => {
    expect(
      parseScriptedLineFromEngineJsonBody({
        scripted: "NORTH   ",
        getinLine: "EAST    ",
      }),
    ).toBe("NORTH   ");
  });

  it("accepts scripted object with line (retry shape)", () => {
    const s = parseScriptedLineFromEngineJsonBody({
      scripted: { line: "TAKE    ", retryIfRejected: "TAKE KEYS" },
    });
    expect(s).toEqual({
      line: "TAKE    ",
      retryIfRejected: "TAKE KEYS",
    });
  });

  it("ignores scripted when it is an object without string line", () => {
    expect(
      parseScriptedLineFromEngineJsonBody({
        scripted: { foo: "bar" },
        getinLine: "LOOK    ",
      }),
    ).toBe("LOOK");
  });
});

describe("scriptedPrimaryLine", () => {
  it("returns plain string as-is", () => {
    expect(scriptedPrimaryLine("EAST    ")).toBe("EAST    ");
  });

  it("returns line for structured scripted", () => {
    expect(
      scriptedPrimaryLine({
        line: "Y",
        retryIfRejected: "N",
      }),
    ).toBe("Y");
  });
});
