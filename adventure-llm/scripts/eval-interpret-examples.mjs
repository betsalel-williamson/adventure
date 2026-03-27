#!/usr/bin/env node
/**
 * Run NL interpret against `scripts/interpret-eval-fixtures.json`; print JSONL per case.
 *
 * From adventure-llm (after `npm run build`):
 *   node scripts/eval-interpret-examples.mjs
 *
 * Requires: adventure.dat at repo root, configured text LLM (see .env.example).
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.join(__dirname, "..");
const repoRoot = path.join(packageRoot, "..");
const datPath = path.join(repoRoot, "adventure.dat");
const fixturesPath = path.join(
  packageRoot,
  "scripts/interpret-eval-fixtures.json",
);

loadEnv({ path: path.join(packageRoot, ".env") });

const { loadDatFile } = await import("../dist/dat/loadDat.js");
const { loadInterpretEvalFixtures } =
  await import("../dist/nl/interpretEvalFixtures.js");
const { compareInterpretEval } =
  await import("../dist/nl/interpretEvalMatch.js");
const { interpretWithTextLlm, resolveTextLlmFromEnv } =
  await import("../dist/nl/adventureTextLlm.js");

async function main() {
  const client = resolveTextLlmFromEnv();
  if (!client) {
    console.error(
      "eval-interpret-examples: configure a text LLM (GEMINI_API_KEY, ADVENTURE_LLM_HTTP_MODEL, or ADVENTURE_LLM_MLX_MODEL). See .env.example.",
    );
    process.exitCode = 1;
    return;
  }

  const db = loadDatFile(datPath);
  const fixtures = loadInterpretEvalFixtures(fixturesPath);
  let failed = 0;

  console.error(
    `eval-interpret-examples: ${fixtures.length} cases, provider=${client.providerId}, model=${client.modelId}\n`,
  );

  for (const f of fixtures) {
    const t0 = Date.now();
    try {
      const cmd = await interpretWithTextLlm(f.userText, db, client, {
        recentGameText: f.recentGameText,
      });
      const ms = Date.now() - t0;
      const cmp = compareInterpretEval(cmd, f.expect);
      const row = {
        id: f.id,
        ok: cmp.ok,
        ms,
        ...(cmp.ok
          ? {
              primaryToken: cmd.primaryToken,
              secondaryToken: cmd.secondaryToken ?? null,
            }
          : {
              primaryToken: cmd.primaryToken,
              secondaryToken: cmd.secondaryToken ?? null,
              diff: {
                primaryMatch: cmp.primaryMatch,
                secondaryMatch: cmp.secondaryMatch,
                got: cmp.got,
                want: cmp.want,
              },
            }),
      };
      console.log(JSON.stringify(row));
      if (!cmp.ok) failed += 1;
    } catch (e) {
      const ms = Date.now() - t0;
      console.log(
        JSON.stringify({
          id: f.id,
          ok: false,
          ms,
          error: e instanceof Error ? e.message : String(e),
        }),
      );
      failed += 1;
    }
  }

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\neval-interpret-examples: ${failed} case(s) failed.`);
  }
}

await main();
