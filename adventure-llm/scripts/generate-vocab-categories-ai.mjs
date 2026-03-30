#!/usr/bin/env node
/**
 * One-shot: call the configured text model to categorize adventure.dat vocabulary into JSON,
 * then write the cache file used by buildVocabHint (when present / env enables).
 *
 * From adventure-llm (after `npm run build`):
 *   node scripts/generate-vocab-categories-ai.mjs
 *   node scripts/generate-vocab-categories-ai.mjs /path/out.json
 *
 * Default out: .cache/vocab-categories-ai.json (under cwd; mkdir -p .cache as needed).
 */
import { config as loadEnv } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.join(__dirname, "..");
const repoRoot = path.join(packageRoot, "..");
const datPath = path.join(repoRoot, "adventure.dat");

loadEnv({ path: path.join(packageRoot, ".env") });

const outArg = process.argv[2]?.trim();
const outPath = outArg
  ? path.resolve(outArg)
  : path.resolve(process.cwd(), ".cache/vocab-categories-ai.json");

const { loadDatFile } = await import("../dist/dat/loadDat.js");
const { resolveTextLlmFromEnv } =
  await import("../dist/nl/adventureTextLlm.js");
const { generateAiVocabCategoriesWithLlm } =
  await import("../dist/nl/vocabCategoriesGenerate.js");

async function main() {
  const client = resolveTextLlmFromEnv();
  if (!client) {
    console.error(
      "generate-vocab-categories-ai: configure a text model (see .env.example).",
    );
    process.exitCode = 1;
    return;
  }

  const db = loadDatFile(datPath);
  console.error(
    `generate-vocab-categories-ai: model=${client.modelId} provider=${client.providerId} → ${outPath}\n`,
  );

  const t0 = Date.now();
  const file = await generateAiVocabCategoriesWithLlm(db, client);
  const body = {
    ...file,
    generatedAt: new Date().toISOString(),
    modelId: client.modelId,
    providerId: client.providerId,
  };
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  const ms = Date.now() - t0;
  console.error(
    `generate-vocab-categories-ai: wrote ${file.groups.length} groups in ${ms}ms`,
  );
}

await main();
