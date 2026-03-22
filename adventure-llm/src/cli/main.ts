#!/usr/bin/env node
/**
 * CLI: if GEMINI_API_KEY is set, the Fortran opening runs (you answer the instructions question), then
 * each `> ` line is mapped through help-intent shortcuts and Gemini into GETIN tokens until .quit/:q or
 * game exit. Otherwise the original Fortran binary runs in full TTY.
 * Pass --classic to force Fortran even when a key is present. Pass --debug to enable JSONL interaction
 * logging (see ADVENTURE_LLM_DEBUG* and ADVENTURE_LLM_CACHE_DIR in .env.example).
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import * as readline from "node:readline/promises";
import { stdin as input } from "node:process";
import { loadDatFile } from "../dat/loadDat.js";
import {
  runFortranOpenThenFirstCommand,
  type ScriptedGetinLine,
} from "../engine/subprocessEngine.js";
import {
  interpretWithGemini,
  shouldFallbackToClassicForGeminiError,
} from "../nl/gemini.js";
import {
  appendInteractionLog,
  resolveCacheDir,
  resolveDebugLogPath,
} from "../nl/llmDebug.js";
import { instructionIntentToHelpCommand } from "../nl/intent.js";
import { interpretedToGetinLine, swapInterpretedTokens } from "../nl/schema.js";

/** dist/cli -> adventure-llm */
const packageRoot = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../..",
);
const envPaths = [
  path.join(packageRoot, ".env.local"),
  path.join(packageRoot, ".env"),
].filter((p) => existsSync(p));
if (envPaths.length > 0) {
  // Prefer file values over inherited shell env so GEMINI_API_KEY in .env is honored.
  loadEnv({
    path: envPaths.length === 1 ? envPaths[0]! : envPaths,
    override: true,
    quiet: true,
  });
}

/** dist/cli -> adventure-llm -> repo root */
const repoRoot = path.join(packageRoot, "..");
const datPath = path.join(repoRoot, "adventure.dat");
const adventureBin = path.join(repoRoot, "adventure");

function printClassicBanner(
  hasGeminiKey: boolean,
  forceClassic: boolean,
): void {
  process.stderr.write("\n");
  process.stderr.write(
    "adventure-llm — classic mode uses the original Fortran Colossal Cave engine.\n",
  );
  if (!hasGeminiKey) {
    process.stderr.write(
      "Natural language needs GEMINI_API_KEY in adventure-llm/.env (omit --classic once it is set).\n",
    );
  } else if (forceClassic) {
    process.stderr.write(
      "Running Fortran only (--classic). Restart without --classic for natural language first.\n",
    );
  }
  process.stderr.write("\n");
}

function runClassicInteractive(): void {
  if (!existsSync(adventureBin)) {
    process.stderr.write(
      "Cannot find ./adventure next to adventure.dat. From the repository root run: make\n",
    );
    process.exitCode = 1;
    return;
  }

  const child = spawn(adventureBin, [], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });

  child.on("error", (err) => {
    process.stderr.write(`Failed to start adventure: ${String(err)}\n`);
    process.exitCode = 1;
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.exitCode = 1;
    } else {
      process.exit(code ?? 0);
    }
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--debug")) {
    process.env.ADVENTURE_LLM_DEBUG ??= "1";
  }
  const forceClassic = args.includes("--classic");
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY?.trim());
  const useNaturalLanguage = hasGeminiKey && !forceClassic;

  if (!useNaturalLanguage) {
    printClassicBanner(hasGeminiKey, forceClassic);
    runClassicInteractive();
    return;
  }

  const db = loadDatFile(datPath);

  process.stderr.write("adventure-llm: LLM-assisted input enabled.\n");
  process.stderr.write(
    "adventure-llm: type naturally at > ; input is translated to game vocabulary. .quit or :q ends the session.\n",
  );
  const logPath = resolveDebugLogPath();
  if (logPath) {
    process.stderr.write(`adventure-llm: interaction log → ${logPath}\n`);
  }
  const cacheDir = resolveCacheDir();
  if (cacheDir) {
    process.stderr.write(`adventure-llm: response cache → ${cacheDir}\n`);
  }

  const rl = readline.createInterface({ input, output: process.stderr });

  const interpretPlayerLineToGetin = async (
    user: string,
    recentGameText?: string,
  ): Promise<ScriptedGetinLine> => {
    const fromIntent = instructionIntentToHelpCommand(user);
    if (fromIntent) {
      await appendInteractionLog({
        event: "intent_resolution",
        userText: user,
        parsed: fromIntent,
      });
      return interpretedToGetinLine(fromIntent);
    }
    const interpreted = await interpretWithGemini(user, db, {
      apiKey: process.env.GEMINI_API_KEY!,
      recentGameText,
    });
    const firstLine = interpretedToGetinLine(interpreted);
    const swapped = swapInterpretedTokens(interpreted);
    const retryLine = swapped ? interpretedToGetinLine(swapped) : undefined;
    if (
      retryLine !== undefined &&
      retryLine.trimEnd() !== firstLine.trimEnd()
    ) {
      return { line: firstLine, retryIfRejected: retryLine };
    }
    return firstLine;
  };

  try {
    await runFortranOpenThenFirstCommand({
      cwd: repoRoot,
      getInstructionsAnswer: async () =>
        rl.question("Would you like instructions? (y/n) "),
      getFirstCommandLine: async () => {
        const user = await rl.question("> ");
        return interpretPlayerLineToGetin(user);
      },
      getContinueLine: async (ctx) => {
        const line = await rl.question("> ");
        const t = line.trim();
        if (t === ".quit" || t === ":q") {
          await appendInteractionLog({
            event: "session_end",
            userText: line,
          });
          return null;
        }
        if (t.length === 0) {
          return line;
        }
        return interpretPlayerLineToGetin(line, ctx.gameOutputSinceLastCommand);
      },
    });
  } catch (err) {
    if (shouldFallbackToClassicForGeminiError(err)) {
      process.stderr.write(
        "\nadventure-llm: Gemini is unavailable (quota, rate limit, or service error). Switching to classic mode: type parser words directly (e.g. EAST, TAKE LAMP).\n\n",
      );
      printClassicBanner(hasGeminiKey, forceClassic);
      runClassicInteractive();
      return;
    }
    throw err;
  } finally {
    rl.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
