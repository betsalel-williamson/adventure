import { describe, expect, it } from "vitest";
import { createOracleTurnWaitGate } from "./oracleTurnWait.js";

describe("createOracleTurnWaitGate", () => {
  it("resolves beginWait promise when notifyOraclePainted runs", async () => {
    const gate = createOracleTurnWaitGate();
    const { promise } = gate.beginWait();
    gate.notifyOraclePainted();
    await expect(promise).resolves.toBeUndefined();
  });

  it("resolves beginWait promise when cancel runs (HTTP error path)", async () => {
    const gate = createOracleTurnWaitGate();
    const { promise, cancel } = gate.beginWait();
    cancel();
    await expect(promise).resolves.toBeUndefined();
  });

  it("notifyOraclePainted without beginWait is a no-op", () => {
    const gate = createOracleTurnWaitGate();
    expect(() => gate.notifyOraclePainted()).not.toThrow();
  });

  it("second notify after resolve does nothing", async () => {
    const gate = createOracleTurnWaitGate();
    const { promise } = gate.beginWait();
    gate.notifyOraclePainted();
    await promise;
    gate.notifyOraclePainted();
  });

  it("cancel clears pending so notify does not double-resolve", async () => {
    const gate = createOracleTurnWaitGate();
    const { promise, cancel } = gate.beginWait();
    cancel();
    await promise;
    gate.notifyOraclePainted();
  });
});
