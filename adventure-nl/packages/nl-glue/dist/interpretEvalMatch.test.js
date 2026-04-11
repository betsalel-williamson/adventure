import { describe, expect, it } from "vitest";
import { compareInterpretEval, normalizeInterpretEvalToken, } from "./interpretEvalMatch.js";
describe("normalizeInterpretEvalToken", () => {
    it("uppercases and trims to five letters", () => {
        expect(normalizeInterpretEvalToken("  east  ")).toBe("EAST");
        expect(normalizeInterpretEvalToken("eastward")).toBe("EASTW");
    });
});
describe("compareInterpretEval", () => {
    it("passes on matching primary only", () => {
        const actual = { primaryToken: "EAST" };
        expect(compareInterpretEval(actual, { primaryToken: "east" })).toEqual({
            ok: true,
        });
    });
    it("passes on matching primary and secondary", () => {
        const actual = {
            primaryToken: "TAKE",
            secondaryToken: "keys",
        };
        expect(compareInterpretEval(actual, {
            primaryToken: "TAKE",
            secondaryToken: "KEYS",
        })).toEqual({ ok: true });
    });
    it("requires no secondary when expect omits it", () => {
        const actual = {
            primaryToken: "EAST",
            secondaryToken: "KEYS",
        };
        const r = compareInterpretEval(actual, { primaryToken: "EAST" });
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.primaryMatch).toBe(true);
            expect(r.secondaryMatch).toBe(false);
        }
    });
    it("accepts undefined secondary when expect omits it", () => {
        const actual = { primaryToken: "HELP" };
        expect(compareInterpretEval(actual, { primaryToken: "HELP" })).toEqual({
            ok: true,
        });
    });
    it("fails on primary mismatch", () => {
        const actual = { primaryToken: "WEST" };
        const r = compareInterpretEval(actual, { primaryToken: "EAST" });
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.primaryMatch).toBe(false);
            expect(r.got.primaryToken).toBe("WEST");
        }
    });
    it("fails on secondary mismatch", () => {
        const actual = {
            primaryToken: "TAKE",
            secondaryToken: "LAMP",
        };
        const r = compareInterpretEval(actual, {
            primaryToken: "TAKE",
            secondaryToken: "KEYS",
        });
        expect(r.ok).toBe(false);
        if (!r.ok)
            expect(r.secondaryMatch).toBe(false);
    });
    it("accepts primaryAlternates when primary matches an alternate", () => {
        const actual = {
            primaryToken: "GET",
            secondaryToken: "KEYS",
        };
        expect(compareInterpretEval(actual, {
            primaryToken: "TAKE",
            secondaryToken: "KEYS",
            primaryAlternates: ["GET"],
        })).toEqual({ ok: true });
    });
});
//# sourceMappingURL=interpretEvalMatch.test.js.map