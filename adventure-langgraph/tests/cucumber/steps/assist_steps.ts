import assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";
import type { HttpWorld } from "../http_world.js";

When("I request the assist health endpoint", async function (this: HttpWorld) {
  assert.ok(this.assistBaseUrl, "assist server should be up (@assist hook)");
  const res = await fetch(`${this.assistBaseUrl}/assist/health`);
  assert.ok(res.ok, `GET /assist/health ${res.status}`);
  this.assistHealthBody = (await res.json()) as Record<string, unknown>;
});

Then(
  "the assist health JSON has status {string}",
  function (this: HttpWorld, status: string) {
    assert.ok(this.assistHealthBody);
    assert.strictEqual(this.assistHealthBody.status, status);
  },
);

Then(
  "the assist health JSON has probeEnabled {word}",
  function (this: HttpWorld, word: string) {
    assert.ok(this.assistHealthBody);
    const expected = word === "true";
    assert.strictEqual(this.assistHealthBody.probeEnabled, expected);
  },
);

When(
  "I POST assist ingest with transcript {string} for run {string}",
  async function (this: HttpWorld, transcript: string, runId: string) {
    assert.ok(this.assistBaseUrl);
    const res = await fetch(`${this.assistBaseUrl}/assist/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId,
        transcript,
        line: transcript.split(/\r?\n/).filter(Boolean).at(-1) ?? transcript,
        context: { priorLines: [], currentPlaceId: null },
      }),
    });
    assert.ok(res.ok, `POST /assist/ingest ${res.status}`);
    this.assistIngestBody = (await res.json()) as Record<string, unknown>;
  },
);

Then("the assist ingest response status is ok", function (this: HttpWorld) {
  assert.ok(this.assistIngestBody);
  assert.strictEqual(this.assistIngestBody.status, "ok");
});

Then(
  "the assist ingest mermaid source contains {string}",
  function (this: HttpWorld, fragment: string) {
    assert.ok(this.assistIngestBody);
    const mermaid = this.assistIngestBody.mermaid;
    assert.ok(typeof mermaid === "string" && mermaid.includes(fragment));
  },
);
