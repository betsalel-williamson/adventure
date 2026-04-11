import { createActor } from "xstate";
import { describe, expect, it } from "vitest";
import { browserAutoplayCognitionMachine } from "./autoplayCognitionMachine.js";

describe("browserAutoplayCognitionMachine", () => {
  it("steps through prompt → plan → submit", () => {
    const actor = createActor(browserAutoplayCognitionMachine).start();
    expect(actor.getSnapshot().value).toBe("idle");
    actor.send({ type: "PROMPT_READY" });
    expect(actor.getSnapshot().value).toBe("awaitingPlan");
    actor.send({ type: "PLAN_START" });
    expect(actor.getSnapshot().value).toBe("planning");
    actor.send({ type: "PLAN_DONE" });
    expect(actor.getSnapshot().value).toBe("submitting");
    actor.send({ type: "GETIN_SENT" });
    expect(actor.getSnapshot().value).toBe("idle");
  });
});
