#!/usr/bin/env node
/**
 * CLI: classic mode pipes typed lines to the Fortran binary; --nl uses Gemini when GEMINI_API_KEY is set.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadDatFile } from "../dat/loadDat.js";
import { createOracleEngine } from "../engine/nativeEngine.js";
import { interpretWithGemini } from "../nl/gemini.js";
import { interpretedToGetinLine } from "../nl/schema.js";

const repoRoot = path.join(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const datPath = path.join(repoRoot, "adventure.dat");

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const nl = args.includes("--nl");
  const db = loadDatFile(datPath);
  const engine = createOracleEngine(repoRoot);

  if (!nl) {
    // Interactive passthrough is complex because Fortran does blocking READ per line.
    // For a full TTY experience, run ./adventure directly; this mode runs a short demo.
    const demo = await new Promise<string>((resolve) => {
      resolve(engine.runScript(["n", "east", "west"]));
    });
    process.stdout.write(demo);
    return;
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    process.stderr.write("Set GEMINI_API_KEY for --nl mode.\n");
    process.exitCode = 1;
    return;
  }

  const rl = readline.createInterface({ input, output });
  const user = await rl.question("> ");
  rl.close();
  const interpreted = await interpretWithGemini(user, db, { apiKey: key });
  const line = interpretedToGetinLine(interpreted);
  process.stdout.write(engine.runScript(["n", line]));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
