#!/usr/bin/env node
/**
 * Post-deploy functional API smoke against a live C1 container (public VM URLs).
 *
 * Env:
 *   ADV_V2_BASE / ADV_ASSIST_BASE — e.g. http://141.148.173.150:8787 and :8790
 *   OCI_DEPLOY_HOST — host only; ports 8787/8790 appended when bases unset
 *   ADV_EXPECTED_IMAGE_TAG — optional semver tag asserted on /health
 */
import type { SseWireEvent } from "../../adventure-v2/packages/contracts/src/index.js";
import { readSseUntilCount } from "../../adventure-v2/tests/helpers/httpWire.js";
import { createRunConfig } from "../../adventure-v2/tests/steps/runSteps.js";

const host = process.env.OCI_DEPLOY_HOST?.trim();
const v2Base =
  process.env.ADV_V2_BASE?.trim() ??
  (host ? `http://${host}:8787` : "http://127.0.0.1:8787");
const assistBase =
  process.env.ADV_ASSIST_BASE?.trim() ??
  (host ? `http://${host}:8790` : "http://127.0.0.1:8790");
const expectedTag = process.env.ADV_EXPECTED_IMAGE_TAG?.trim() ?? "";

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const assertHealthMetadata = (
  json: Record<string, unknown>,
  label: string,
): void => {
  if (json.oracleMode !== undefined && json.oracleMode !== "process") {
    fail(`${label}: expected oracleMode=process, got ${String(json.oracleMode)}`);
  }
  if (expectedTag) {
    if (json.imageTag !== expectedTag) {
      fail(`${label}: imageTag ${String(json.imageTag)} != expected ${expectedTag}`);
    }
  }
};

const checkV2Health = async (): Promise<void> => {
  const res = await fetch(`${v2Base}/health`);
  if (!res.ok) {
    fail(`GET /health failed: ${res.status}`);
  }
  const json = (await res.json()) as Record<string, unknown>;
  assertHealthMetadata(json, "v2");
  console.log(`v2 health OK · ${String(json.version)}@${String(json.imageTag)}`);
};

const checkAssistHealth = async (): Promise<void> => {
  const res = await fetch(`${assistBase}/assist/health`);
  if (!res.ok) {
    fail(`GET /assist/health failed: ${res.status}`);
  }
  const json = (await res.json()) as Record<string, unknown>;
  if (json.status !== "ok") {
    fail(`assist status ${String(json.status)}`);
  }
  if (expectedTag && json.imageTag !== expectedTag) {
    fail(`assist imageTag ${String(json.imageTag)} != expected ${expectedTag}`);
  }
  console.log(
    `assist health OK · ${String(json.version)}@${String(json.imageTag)} · probeEnabled=${String(json.probeEnabled)}`,
  );
};

const checkOneGameTurn = async (): Promise<void> => {
  const runRes = await fetch(`${v2Base}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config: createRunConfig("SLM") }),
  });
  if (runRes.status !== 201) {
    fail(`POST /runs failed: ${runRes.status}`);
  }
  const { runId } = (await runRes.json()) as { runId: string };

  const sseRes = await fetch(`${v2Base}/runs/${runId}/events`);
  if (!sseRes.ok) {
    fail(`GET /runs/${runId}/events failed: ${sseRes.status}`);
  }
  const readPromise = readSseUntilCount(sseRes, 10, 60_000);

  const turnRes = await fetch(`${v2Base}/runs/${runId}/turns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: "look" }),
  });
  if (turnRes.status !== 204) {
    fail(`POST /runs/${runId}/turns failed: ${turnRes.status}`);
  }

  const wire = await readPromise;
  const oracle = wire.find(
    (w): w is Extract<SseWireEvent, { event: "turn" }> =>
      w.event === "turn" && w.envelope.kind === "oracle_observation",
  );
  if (!oracle) {
    fail("SSE stream missing oracle_observation envelope");
  }
  const output = oracle.envelope.payload.output;
  if (typeof output !== "string" || output.length === 0) {
    fail("oracle_observation output empty");
  }
  console.log(`game turn OK · oracle_observation length=${output.length}`);
};

const checkAssistIngest = async (): Promise<void> => {
  const transcript = "YOU ARE IN A HALLWAY.";
  const res = await fetch(`${assistBase}/assist/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      runId: "remote-api-smoke-1",
      transcript,
      line: transcript,
      context: { priorLines: [], currentPlaceId: null },
    }),
  });
  if (!res.ok) {
    fail(`POST /assist/ingest failed: ${res.status}`);
  }
  const json = (await res.json()) as Record<string, unknown>;
  if (json.status !== "ok") {
    fail(`assist ingest status ${String(json.status)}`);
  }
  const mermaid = json.mermaid;
  if (typeof mermaid !== "string" || !mermaid.includes("flowchart LR")) {
    fail("assist ingest mermaid missing flowchart LR");
  }
  console.log("assist ingest OK · mermaid draft returned");
};

await checkV2Health();
await checkAssistHealth();
await checkOneGameTurn();
await checkAssistIngest();
console.log(`Remote API smoke OK · v2=${v2Base} assist=${assistBase}`);
