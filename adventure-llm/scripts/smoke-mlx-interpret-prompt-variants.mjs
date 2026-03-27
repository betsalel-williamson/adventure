#!/usr/bin/env node
/**
 * One MLX worker session: run interpret eval fixtures across Gemma-friendly prompt layouts.
 *
 * Varies compact + structured dashboard + optional EXAMPLES (fixtures JSON), like local
 * grid search without restarting the model.
 *
 * From adventure-llm (after `npm run build`):
 *   node scripts/smoke-mlx-interpret-prompt-variants.mjs
 *
 * Requires: Apple Silicon MLX, `uv sync`, adventure.dat at repo root.
 * Clears ADVENTURE_LLM_CACHE_DIR for the process so prompt shape does not hit stale cache.
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

delete process.env.ADVENTURE_LLM_CACHE_DIR;
process.env.ADVENTURE_LLM_TEXT_PROVIDER ??= "mlx";
process.env.ADVENTURE_LLM_DEBUG = process.env.ADVENTURE_LLM_DEBUG ?? "0";

/** @type {readonly { id: string; compact: boolean; structuredDashboard: boolean; promptExamples: boolean }[]} */
const PROMPT_VARIANTS = [
  {
    id: "full_flat",
    compact: false,
    structuredDashboard: false,
    promptExamples: false,
  },
  {
    id: "full_struct",
    compact: false,
    structuredDashboard: true,
    promptExamples: false,
  },
  {
    id: "compact_flat",
    compact: true,
    structuredDashboard: false,
    promptExamples: false,
  },
  {
    id: "compact_struct",
    compact: true,
    structuredDashboard: true,
    promptExamples: false,
  },
  {
    id: "compact_struct_examples",
    compact: true,
    structuredDashboard: true,
    promptExamples: true,
  },
];

const { loadDatFile } = await import("../dist/dat/loadDat.js");
const { loadInterpretEvalFixtures } =
  await import("../dist/nl/interpretEvalFixtures.js");
const { compareInterpretEval } =
  await import("../dist/nl/interpretEvalMatch.js");
const { interpretWithTextLlm, resolveTextLlmFromEnv } =
  await import("../dist/nl/adventureTextLlm.js");

async function main() {
  const client = resolveTextLlmFromEnv();
  if (!client || client.providerId !== "mlx") {
    console.error(
      "smoke-mlx-interpret-prompt-variants: set ADVENTURE_LLM_TEXT_PROVIDER=mlx and a working MLX setup (uv sync).",
    );
    process.exitCode = 1;
    return;
  }

  const db = loadDatFile(datPath);
  const fixtures = loadInterpretEvalFixtures(fixturesPath);

  console.error(
    `smoke-mlx-interpret-prompt-variants: model=${client.modelId}, ${fixtures.length} cases × ${PROMPT_VARIANTS.length} layouts (one MLX load)…\n`,
  );

  for (const variant of PROMPT_VARIANTS) {
    process.env.ADVENTURE_LLM_INTERPRET_PROMPT_EXAMPLES = variant.promptExamples
      ? "1"
      : "0";
    let pass = 0;
    let fail = 0;
    let msTotal = 0;

    for (const f of fixtures) {
      const t0 = Date.now();
      try {
        const cmd = await interpretWithTextLlm(f.userText, db, client, {
          recentGameText: f.recentGameText,
          promptStyle: {
            compact: variant.compact,
            structuredDashboard: variant.structuredDashboard,
          },
        });
        const ms = Date.now() - t0;
        msTotal += ms;
        const cmp = compareInterpretEval(cmd, f.expect);
        if (cmp.ok) pass += 1;
        else fail += 1;
        console.log(
          JSON.stringify({
            promptVariant: variant.id,
            id: f.id,
            ok: cmp.ok,
            ms,
            primaryToken: cmd.primaryToken,
            secondaryToken: cmd.secondaryToken ?? null,
            ...(cmp.ok
              ? {}
              : {
                  diff: {
                    primaryMatch: cmp.primaryMatch,
                    secondaryMatch: cmp.secondaryMatch,
                    got: cmp.got,
                    want: cmp.want,
                  },
                }),
          }),
        );
      } catch (e) {
        const ms = Date.now() - t0;
        msTotal += ms;
        fail += 1;
        console.log(
          JSON.stringify({
            promptVariant: variant.id,
            id: f.id,
            ok: false,
            ms,
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      }
    }

    console.log(
      JSON.stringify({
        summary: true,
        promptVariant: variant.id,
        pass,
        fail,
        total: fixtures.length,
        msTotal,
        compact: variant.compact,
        structuredDashboard: variant.structuredDashboard,
        promptExamples: variant.promptExamples,
      }),
    );
  }
}

await main();
