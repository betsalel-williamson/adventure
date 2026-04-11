#!/usr/bin/env node
/**
 * One MLX worker session: run the autoplay planner once per ADVENTURE_LM_MLX_SYSTEM_VARIANT value.
 * Avoids restarting `npm start` for each variant (single model load).
 *
 * Usage (from adventure-lm, after `npm run build`):
 *   node scripts/smoke-mlx-system-variants.mjs
 *
 * Requires: Apple Silicon MLX, `uv sync`, adventure.dat at repo root (parent of adventure-lm).
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.join(__dirname, "..");
const repoRoot = path.join(packageRoot, "..");
const datPath = path.join(repoRoot, "adventure.dat");

loadEnv({ path: path.join(packageRoot, ".env") });

process.env.ADVENTURE_LM_TEXT_PROVIDER ??= "mlx";
process.env.ADVENTURE_LM_AUTOPLAY_TWO_STEP = "0";
process.env.ADVENTURE_LM_DEBUG = process.env.ADVENTURE_LM_DEBUG ?? "0";

const {
  AutoplaySessionMemory,
  MLX_SYSTEM_PROMPT_VARIANTS,
  resolveCompactPrompts,
  resolveStructuredDashboardPrompts,
} = await import("@adventure-lm/lm-glue");
const { loadDatFile } = await import("../dist/dat/loadDat.js");
const { planAutoplayWithTextLlm, resolveTextLlmFromEnv } =
  await import("../dist/nl/adventureTextLlm.js");
const { buildSituationalCandidateTokens, formatSituationalCandidatesSection } =
  await import("@adventure-lm/lm-glue");
const contextChars = Number(
  process.env.ADVENTURE_LM_AUTOPLAY_CONTEXT_CHARS ?? "6000",
);

function buildSyntheticMemory() {
  const memory = new AutoplaySessionMemory();
  memory.seedOpening(
    "WELCOME TO ADVENTURE!!\n\nYOU ARE STANDING AT THE END OF A ROAD BEFORE A SMALL BRICK  \nBUILDING. AROUND YOU IS A FOREST.\n",
  );
  memory.recordCommandOutcome(
    "EAST    ",
    "YOU ARE INSIDE A BUILDING, A WELL HOUSE FOR A LARGE SPRING.\nTHERE ARE SOME KEYS ON THE GROUND HERE.\n",
  );
  return memory;
}

async function main() {
  const client = resolveTextLlmFromEnv();
  if (!client || client.providerId !== "mlx") {
    console.error(
      "smoke-mlx-system-variants: need ADVENTURE_LM_TEXT_PROVIDER=mlx and a working MLX setup (uv sync).",
    );
    process.exitCode = 1;
    return;
  }

  const db = loadDatFile(datPath);
  const compact = resolveCompactPrompts("mlx");
  const structuredDashboard = resolveStructuredDashboardPrompts("mlx");
  if (!structuredDashboard) {
    console.error(
      "smoke-mlx-system-variants: set ADVENTURE_LM_STRUCTURED_PROMPTS=1 for MLX structured prompts (default).",
    );
    process.exitCode = 1;
    return;
  }

  console.error(
    "smoke-mlx-system-variants: one model load, then one planner call per variant…\n",
  );

  for (const variant of MLX_SYSTEM_PROMPT_VARIANTS) {
    process.env.ADVENTURE_LM_MLX_SYSTEM_VARIANT = variant;
    const memory = buildSyntheticMemory();
    const situationalSection = formatSituationalCandidatesSection(
      db,
      buildSituationalCandidateTokens(db, memory.getRecentRawTail()),
      undefined,
      { flatList: !compact, slmGrouped: compact },
    );
    const plannerUserPrompt = memory.buildPlannerMxStructuredPrompt(
      contextChars,
      {
        compact,
        situationalSection,
      },
    );
    const sysLen = plannerUserPrompt.system?.length ?? 0;
    const usrLen = plannerUserPrompt.user?.length ?? 0;
    const t0 = Date.now();
    try {
      const plan = await planAutoplayWithTextLlm(db, client, {
        plannerUserPrompt,
        recentGameTextForRepair: memory.getRecentRawTail().slice(-1200),
      });
      const ms = Date.now() - t0;
      const row = {
        variant,
        ok: true,
        ms,
        systemChars: sysLen,
        userChars: usrLen,
        primaryToken: plan.primaryToken,
        secondaryToken: plan.secondaryToken ?? null,
        confidence: plan.confidence ?? null,
      };
      console.log(JSON.stringify(row));
    } catch (e) {
      const ms = Date.now() - t0;
      console.log(
        JSON.stringify({
          variant,
          ok: false,
          ms,
          systemChars: sysLen,
          userChars: usrLen,
          error: e instanceof Error ? e.message : String(e),
        }),
      );
    }
  }
}

await main();
