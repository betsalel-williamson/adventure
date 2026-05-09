import { describe, expect, it } from "vitest";
import { createControlMachineLogic } from "../packages/control/src/machine/controlMachine.js";
import { createActor } from "xstate";

describe("xstate control machine", () => {
  it("mirrors nominal oracle path: act → disorder → reconcile continue → act", () => {
    const actor = createActor(createControlMachineLogic(2));
    actor.start();
    expect(actor.getSnapshot().value).toBe("act");
    actor.send({ type: "ORACLE_DISPATCHED", sequence: 1 });
    expect(actor.getSnapshot().value).toBe("disorder");
    actor.send({ type: "RECONCILE", nextPolicy: "continue", sequence: 1 });
    expect(actor.getSnapshot().value).toBe("act");
  });

  it("routes INVALID to test then chaos when threshold exceeded", () => {
    const actor = createActor(createControlMachineLogic(2));
    actor.start();
    actor.send({ type: "ORACLE_DISPATCHED", sequence: 1 });
    expect(actor.getSnapshot().value).toBe("disorder");
    actor.send({ type: "INVALID", sequence: 1 });
    expect(actor.getSnapshot().value).toBe("test");
    actor.send({ type: "ORACLE_DISPATCHED", sequence: 2 });
    expect(actor.getSnapshot().value).toBe("disorder");
    actor.send({ type: "INVALID", sequence: 2 });
    expect(actor.getSnapshot().value).toBe("test");
    actor.send({ type: "ORACLE_DISPATCHED", sequence: 3 });
    expect(actor.getSnapshot().value).toBe("disorder");
    actor.send({ type: "INVALID", sequence: 3 });
    expect(actor.getSnapshot().value).toBe("chaos");
  });
});
