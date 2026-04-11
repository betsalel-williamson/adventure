import { describe, expect, it } from "vitest";
import { parseJsonObjectFromLlmText } from "@adventure-llm/nl-glue";
describe("parseJsonObjectFromLlmText", () => {
    it("parses raw JSON object", () => {
        const o = parseJsonObjectFromLlmText('{"primaryToken":"TAKE","secondaryToken":"LAMP"}');
        expect(o).toEqual({ primaryToken: "TAKE", secondaryToken: "LAMP" });
    });
    it("strips markdown json fence", () => {
        const o = parseJsonObjectFromLlmText('```json\n{"primaryToken":"EAST"}\n```');
        expect(o).toEqual({ primaryToken: "EAST" });
    });
    it("extracts first object from surrounding text", () => {
        const o = parseJsonObjectFromLlmText('Here is the result: {"primaryToken":"NORTH"} thanks');
        expect(o).toEqual({ primaryToken: "NORTH" });
    });
    it("uses only the first object when the model emits two JSON objects", () => {
        const o = parseJsonObjectFromLlmText('{"primaryToken":"NORTH","confidence":0.9}\n{"primaryToken":"EAST"}');
        expect(o).toEqual({ primaryToken: "NORTH", confidence: 0.9 });
    });
    it("accepts Python None/True/False outside strings (MLX-style output)", () => {
        const o = parseJsonObjectFromLlmText('{"primaryToken":"SMASH","secondaryToken":None,"confidence":1}');
        expect(o).toEqual({
            primaryToken: "SMASH",
            secondaryToken: null,
            confidence: 1,
        });
    });
    it("does not rewrite None inside JSON string values", () => {
        const o = parseJsonObjectFromLlmText('{"primaryToken":"None","secondaryToken":null}');
        expect(o).toEqual({
            primaryToken: "None",
            secondaryToken: null,
        });
    });
    it("repairs missing colon before boolean (common small-model mistake)", () => {
        const o = parseJsonObjectFromLlmText('{"primaryToken":"EAST","continuePlaying" true}');
        expect(o).toEqual({ primaryToken: "EAST", continuePlaying: true });
    });
    it("repairs missing colon before boolean without space", () => {
        const o = parseJsonObjectFromLlmText('{"primaryToken":"EAST","continuePlaying"false}');
        expect(o).toEqual({ primaryToken: "EAST", continuePlaying: false });
    });
    it("repairs missing colon before quoted string value", () => {
        const o = parseJsonObjectFromLlmText('{"primaryToken" "NORTH","continuePlaying":true}');
        expect(o).toEqual({ primaryToken: "NORTH", continuePlaying: true });
    });
});
//# sourceMappingURL=jsonFromLlmText.test.js.map