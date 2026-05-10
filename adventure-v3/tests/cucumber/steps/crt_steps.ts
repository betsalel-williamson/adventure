import assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";
import type { SseWireEvent } from "../../../../adventure-v2/packages/contracts/src/index.js";
import { readSseUntilCount } from "../../../../adventure-v2/tests/helpers/httpWire.js";
import { createRunConfig } from "../../../../adventure-v2/tests/steps/runSteps.js";
import type { HttpWorld } from "../http_world.js";

Given("the adventure HTTP API is running for v3 shell", async function (this: HttpWorld) {
  assert.ok(this.baseUrl, "server should be up (Before hook)");
});

When("I request the health endpoint", async function (this: HttpWorld) {
  assert.ok(this.baseUrl);
  const res = await fetch(`${this.baseUrl}/health`);
  assert.ok(res.ok, `GET /health ${res.status}`);
  this.healthBody = (await res.json()) as Record<string, unknown>;
});

Then("the health JSON has oracleMode {string}", async function (this: HttpWorld, mode: string) {
  assert.ok(this.healthBody);
  assert.strictEqual(this.healthBody.oracleMode, mode);
});

When(
  "I start a run for SLM and stream ten events for input {string}",
  async function (this: HttpWorld, input: string) {
    assert.ok(this.baseUrl);
    const response = await fetch(`${this.baseUrl}/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: createRunConfig("SLM") })
    });
    assert.strictEqual(response.status, 201);
    const body = (await response.json()) as { runId: string };
    this.runId = body.runId;

    const sseRes = await fetch(`${this.baseUrl}/runs/${this.runId}/events`);
    assert.ok(sseRes.ok, `SSE ${sseRes.status}`);
    this.readPromise = readSseUntilCount(sseRes, 10);

    const turnsPath = `/runs/${this.runId}/turns`;
    const postTurnResponse = await fetch(`${this.baseUrl}${turnsPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input })
    });
    assert.strictEqual(postTurnResponse.status, 204);
    this.wire = await this.readPromise;
  }
);

Then("the stream includes oracle_observation with non-empty output", function (this: HttpWorld) {
  const wire = this.wire;
  assert.ok(wire && wire.length > 0);
  const oracle = wire.find(
    (w): w is Extract<SseWireEvent, { event: "turn" }> =>
      w.event === "turn" && w.envelope.kind === "oracle_observation"
  );
  assert.ok(oracle);
  const output = oracle.envelope.payload.output;
  assert.ok(typeof output === "string" && output.length > 0);
});

Then(
  "if the oracle is process mode the observation is longer than stub-only text",
  async function (this: HttpWorld) {
    assert.ok(this.baseUrl);
    const res = await fetch(`${this.baseUrl}/health`);
    assert.ok(res.ok);
    const health = (await res.json()) as { oracleMode?: string };
    if (health.oracleMode !== "process") {
      return;
    }
    const wire = this.wire;
    assert.ok(wire);
    const oracle = wire.find(
      (w): w is Extract<SseWireEvent, { event: "turn" }> =>
        w.event === "turn" && w.envelope.kind === "oracle_observation"
    );
    assert.ok(oracle);
    const output = oracle.envelope.payload.output as string;
    assert.ok(output.length > 4, `expected substantive Fortran text, got: ${output}`);
  }
);
