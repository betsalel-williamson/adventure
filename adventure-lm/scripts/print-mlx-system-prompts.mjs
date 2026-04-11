#!/usr/bin/env node
/**
 * Prints character counts and previews for each MLX system prompt variant (compact rules).
 * Run from adventure-lm: `npm run build && node scripts/print-mlx-system-prompts.mjs`
 *
 * For live model comparison (one MLX load, four planner calls): `npm run experiment:mlx-system-smoke`
 * Or per-run autoplay: `ADVENTURE_LM_MLX_SYSTEM_VARIANT=compact npm start -- --autoplay`
 */
import {
  MLX_SYSTEM_PROMPT_VARIANTS,
  mlxAutoplaySystemPromptForVariant,
} from "@adventure-lm/lm-glue";

const previewLen = 320;

for (const variant of MLX_SYSTEM_PROMPT_VARIANTS) {
  const text = mlxAutoplaySystemPromptForVariant(true, variant);
  const lines = text.split("\n").length;
  console.log("---");
  console.log(`variant=${variant}  chars=${text.length}  lines=${lines}`);
  console.log(text.slice(0, previewLen));
  if (text.length > previewLen) console.log("…");
  console.log("");
}
