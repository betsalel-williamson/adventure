import { describe, expect, it } from "vitest";
import { parseSseWirePayload } from "./parse.js";

describe("parseSseWirePayload", () => {
  it("parses turn event", () => {
    const raw = JSON.stringify({
      event: "turn",
      envelope: {
        runId: "r1",
        turnId: "t1",
        sequence: 0,
        source: "oracle",
        kind: "oracle_observation",
        ts: "2020-01-01T00:00:00.000Z",
        payload: { outcome: "accepted", rejected: false, output: "OK." },
      },
    });
    const ev = parseSseWirePayload(raw);
    expect(ev?.event).toBe("turn");
    if (ev?.event === "turn") {
      expect(ev.envelope.kind).toBe("oracle_observation");
    }
  });

  it("returns null on garbage", () => {
    expect(parseSseWirePayload("not json")).toBeNull();
  });
});
