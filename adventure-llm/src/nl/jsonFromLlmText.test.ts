import { describe, expect, it } from "vitest";
import { parseJsonObjectFromLlmText } from "./jsonFromLlmText.js";

describe("parseJsonObjectFromLlmText", () => {
  it("parses raw JSON object", () => {
    const o = parseJsonObjectFromLlmText(
      '{"primaryToken":"TAKE","secondaryToken":"LAMP"}',
    );
    expect(o).toEqual({ primaryToken: "TAKE", secondaryToken: "LAMP" });
  });

  it("strips markdown json fence", () => {
    const o = parseJsonObjectFromLlmText(
      '```json\n{"primaryToken":"EAST"}\n```',
    );
    expect(o).toEqual({ primaryToken: "EAST" });
  });

  it("extracts first object from surrounding text", () => {
    const o = parseJsonObjectFromLlmText(
      'Here is the result: {"primaryToken":"NORTH"} thanks',
    );
    expect(o).toEqual({ primaryToken: "NORTH" });
  });
});
