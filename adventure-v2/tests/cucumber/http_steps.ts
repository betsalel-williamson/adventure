import assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";
import type { ModelCategory, SseWireEvent } from "../../packages/contracts/src/index.js";
import { readSseUntilCount } from "../helpers/httpWire.js";
import { createRunConfig } from "../steps/runSteps.js";
import type { HttpWorld } from "./http_world.js";

Given("the adventure HTTP API is running with the default oracle", async function (this: HttpWorld) {
  assert.ok(this.baseUrl, "server should be up (Before hook)");
});

When("I start a run configured for model category {string}", async function (this: HttpWorld, category: string) {
  const response = await fetch(`${this.baseUrl}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config: createRunConfig(category as ModelCategory) })
  });
  assert.strictEqual(response.status, 201);
  const body = (await response.json()) as { runId: string };
  this.runId = body.runId;
});

When("I open the run event stream before submitting input", async function (this: HttpWorld) {
  assert.ok(this.runId, "run must be started first");
  const sseRes = await fetch(`${this.baseUrl}/runs/${this.runId}/events`);
  assert.ok(sseRes.ok, `expected SSE connection, got ${sseRes.status}`);
  this.readPromise = readSseUntilCount(sseRes, 10);
});

When("I open the run event stream for three rejected proposals", async function (this: HttpWorld) {
  assert.ok(this.runId, "run must be started first");
  const sseRes = await fetch(`${this.baseUrl}/runs/${this.runId}/events`);
  assert.ok(sseRes.ok, `expected SSE connection, got ${sseRes.status}`);
  const eventsPerTurn = 10;
  const turns = 3;
  this.readPromise = readSseUntilCount(sseRes, eventsPerTurn * turns, 15_000);
});

When("I submit three sequential rejected proposals", async function (this: HttpWorld) {
  assert.ok(this.runId && this.readPromise, "stream must be open before submitting input");
  const turnsPath = `/runs/${this.runId}/turns`;
  for (const input of ["bad-action-1", "bad-action-2", "bad-action-3"]) {
    const postTurnResponse: globalThis.Response = await fetch(`${this.baseUrl}${turnsPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, forceReject: true })
    });
    assert.strictEqual(postTurnResponse.status, 204);
  }
  this.wire = await this.readPromise;
});

When("I submit player input {string} for that run", async function (this: HttpWorld, input: string) {
  assert.ok(this.runId && this.readPromise, "stream must be open before submitting input");
  const turnsPath = `/runs/${this.runId}/turns`;
  const postTurnResponse: globalThis.Response = await fetch(`${this.baseUrl}${turnsPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input })
  });
  assert.strictEqual(postTurnResponse.status, 204);
  this.wire = await this.readPromise;
});

Then(
  "I receive ten wire events with ordered turn kinds proposal, oracle_observation, reconcile, checkpoint",
  async function (this: HttpWorld) {
    const wire = this.wire;
    assert.ok(wire, "wire events required");
    assert.strictEqual(wire.length, 10);
    const turnKinds = wire
      .filter((w): w is Extract<SseWireEvent, { event: "turn" }> => w.event === "turn")
      .map((w) => w.envelope.kind);
    assert.deepStrictEqual(turnKinds, ["proposal", "oracle_observation", "reconcile", "checkpoint"]);
  }
);

Then("phase transitions end as disorder then act", async function (this: HttpWorld) {
  const wire = this.wire;
  assert.ok(wire);
  const phases = wire
    .filter((w): w is Extract<SseWireEvent, { event: "phase" }> => w.event === "phase")
    .map((w) => w.transition.to);
  assert.deepStrictEqual(phases, ["disorder", "act"]);
});

Then("phase transitions on the stream include test and chaos", async function (this: HttpWorld) {
  const wire = this.wire;
  assert.ok(wire, "wire events required");
  const phaseTos = wire
    .filter((w): w is Extract<SseWireEvent, { event: "phase" }> => w.event === "phase")
    .map((w) => w.transition.to);
  assert.ok(phaseTos.includes("test"), `expected test phase, got ${phaseTos.join(",")}`);
  assert.ok(phaseTos.includes("chaos"), `expected chaos phase, got ${phaseTos.join(",")}`);
});

Then(
  "the cognition trace lists LangGraph nodes perceive, plan, act, reconcile for input {string}",
  async function (this: HttpWorld, input: string) {
    const wire = this.wire;
    assert.ok(wire && this.runId);
    const traces = wire.filter(
      (w): w is Extract<SseWireEvent, { event: "trace" }> => w.event === "trace"
    );
    assert.strictEqual(traces.length, 4);
    assert.deepStrictEqual(
      traces.map((w) => w.trace.nodeId),
      ["perceive", "plan", "act", "reconcile"]
    );
    const act = traces.find((w) => w.trace.nodeId === "act");
    assert.ok(act);
    assert.deepStrictEqual(act.trace.payload, { action: input });
  }
);

Then("the reconcile envelope correlates to the first turn of this run", async function (this: HttpWorld) {
  assert.ok(this.wire && this.runId);
  const reconcileEv = this.wire.find(
    (w): w is Extract<SseWireEvent, { event: "turn" }> =>
      w.event === "turn" && w.envelope.kind === "reconcile"
  );
  assert.ok(reconcileEv, "expected reconcile turn event");
  const payload = reconcileEv.envelope.payload as { correlationId?: string };
  assert.strictEqual(payload.correlationId, `${this.runId}:turn:1`);
});

Then("the reconcile envelope reports oracle outcome {string}", async function (this: HttpWorld, outcome: string) {
  assert.ok(this.wire);
  const reconcileEv = this.wire.find(
    (w): w is Extract<SseWireEvent, { event: "turn" }> =>
      w.event === "turn" && w.envelope.kind === "reconcile"
  );
  assert.ok(reconcileEv);
  const payload = reconcileEv.envelope.payload as { evidence?: { oracleOutcome?: string } };
  assert.strictEqual(payload.evidence?.oracleOutcome, outcome);
});

Then("the reconcile envelope has no drift summary", async function (this: HttpWorld) {
  assert.ok(this.wire);
  const reconcileEv = this.wire.find(
    (w): w is Extract<SseWireEvent, { event: "turn" }> =>
      w.event === "turn" && w.envelope.kind === "reconcile"
  );
  assert.ok(reconcileEv);
  const payload = reconcileEv.envelope.payload as { driftSummary?: string };
  assert.strictEqual(payload.driftSummary, undefined);
});
