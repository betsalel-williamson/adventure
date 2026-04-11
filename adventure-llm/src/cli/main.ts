#!/usr/bin/env node
/**
 * CLI: with a configured text model (Google Generative AI or OpenAI-compatible HTTP), the Fortran opening runs
 * (you answer the instructions question), then each `> ` line is mapped through help-intent shortcuts and the text
 * model into GETIN tokens until .quit/:q or game exit. Otherwise the original Fortran binary runs in full TTY.
 * Pass --classic to force Fortran even when a language model is configured. Pass --debug to enable JSONL interaction
 * logging (see ADVENTURE_LLM_DEBUG* and ADVENTURE_LLM_CACHE_DIR in .env.example).
 * Pass --autoplay for self-acting mode (model-driven moves; see ADVENTURE_LLM_AUTOPLAY_* in .env.example).
 * For a browser dashboard (transcript, inferred map, prompts), run `npm run web` after build (see README).
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
import { AutoplaySessionMemory } from "@adventure-llm/nl-glue";
import {
  interpretWithTextLlm,
  resolveTextLlmFromEnv,
} from "../nl/adventureTextLlm.js";
import { resolveInterpretPromptBuildOptions } from "@adventure-llm/nl-glue";
import { shouldFallbackToClassicForLlmError } from "../nl/llmErrors.js";
import {
  appendInteractionLog,
  resolveCacheDir,
  resolveDebugLogPath,
} from "../nl/llmDebug.js";
import { instructionIntentToHelpCommand } from "@adventure-llm/nl-glue";
import {
  interpretedToGetinLine,
  swapInterpretedTokens,
} from "@adventure-llm/nl-glue";
import type { TextLlm } from "@adventure-llm/nl-glue";
import { MlxLmStdioTextLlm } from "../nl/providers/mlxLmStdioTextLlm.js";
import { runAutoplaySessionWithTextLlm } from "./autoplayRunner.js";

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
  hasTextLlmConfigured: boolean,
  forceClassic: boolean,
): void {
  process.stderr.write("\n");
  process.stderr.write(
    "adventure-llm — classic mode uses the original Fortran Colossal Cave engine.\n",
  );
  if (!hasTextLlmConfigured) {
    process.stderr.write(
      "Natural language needs a text model: set GEMINI_API_KEY and/or ADVENTURE_LLM_HTTP_* (see adventure-llm/.env.example). Omit --classic once configured.\n",
    );
  } else if (forceClassic) {
    process.stderr.write(
      "Running Fortran only (--classic). Restart without --classic for natural language first.\n",
    );
  }
  process.stderr.write("\n");
}

async function ensureMlxWorkerReady(client: TextLlm): Promise<void> {
  if (!(client instanceof MlxLmStdioTextLlm)) return;
  process.stderr.write("adventure-llm: loading MLX model (one-time)…\n");
  await client.preloadWorker();
}

/** Default on: heuristic session block + situational tokens for interactive NL (set ADVENTURE_LLM_INTERACTIVE_SESSION=0 to disable). */
function resolveInteractiveSessionMemoryEnabled(): boolean {
  const v = process.env.ADVENTURE_LLM_INTERACTIVE_SESSION?.trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "no";
}

function scriptedGetinLineString(scripted: ScriptedGetinLine): string {
  if (typeof scripted === "string") return scripted;
  return scripted.line;
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
  const autoplay = args.includes("--autoplay");
  const textLlm = resolveTextLlmFromEnv();
  const hasTextLlm = textLlm !== null;

  if (autoplay && !hasTextLlm) {
    process.stderr.write(
      "adventure-llm: --autoplay requires a text model (GEMINI_API_KEY and/or ADVENTURE_LLM_HTTP_MODEL; see .env.example).\n",
    );
    process.exitCode = 1;
    return;
  }
  if (autoplay && forceClassic) {
    process.stderr.write(
      "adventure-llm: --autoplay cannot be used with --classic.\n",
    );
    process.exitCode = 1;
    return;
  }

  if (autoplay && textLlm) {
    if (!existsSync(adventureBin)) {
      process.stderr.write(
        "Cannot find ./adventure next to adventure.dat. From the repository root run: make\n",
      );
      process.exitCode = 1;
      return;
    }
    try {
      await ensureMlxWorkerReady(textLlm);
      await runAutoplaySessionWithTextLlm(textLlm, {
        repoRoot,
        datPath,
      });
    } catch (err) {
      if (shouldFallbackToClassicForLlmError(err, textLlm.providerId)) {
        process.stderr.write(
          "\nadventure-llm: text model unavailable (quota, rate limit, network, or service error). Autoplay stopped.\n",
        );
        process.exitCode = 1;
        return;
      }
      throw err;
    }
    return;
  }

  const useNaturalLanguage = hasTextLlm && !forceClassic;

  if (!useNaturalLanguage) {
    printClassicBanner(hasTextLlm, forceClassic);
    runClassicInteractive();
    return;
  }

  const db = loadDatFile(datPath);

  process.stderr.write(
    "adventure-llm: language-model-assisted input enabled.\n",
  );
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

  const useInteractiveSession = resolveInteractiveSessionMemoryEnabled();
  const interactiveMemory = new AutoplaySessionMemory();
  let lastSentGetin = "";

  const buildInteractiveRecentForLlm = (
    baseRecent: string | undefined,
  ): string | undefined => {
    if (!useInteractiveSession) return baseRecent;
    const { compact } = resolveInterpretPromptBuildOptions(
      textLlm!.providerId,
      undefined,
    );
    const prefix = interactiveMemory.buildInteractiveInterpretPrefix(db, {
      compact,
    });
    if (!prefix) return baseRecent;
    return `${prefix}\n\n---\n\n${baseRecent ?? ""}`;
  };

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
      const scripted = interpretedToGetinLine(fromIntent);
      lastSentGetin = scripted;
      return scripted;
    }
    const interpreted = await interpretWithTextLlm(user, db, textLlm!, {
      recentGameText,
    });
    const firstLine = interpretedToGetinLine(interpreted);
    const swapped = swapInterpretedTokens(interpreted);
    const retryLine = swapped ? interpretedToGetinLine(swapped) : undefined;
    let out: ScriptedGetinLine;
    if (
      retryLine !== undefined &&
      retryLine.trimEnd() !== firstLine.trimEnd()
    ) {
      out = { line: firstLine, retryIfRejected: retryLine };
    } else {
      out = firstLine;
    }
    lastSentGetin = scriptedGetinLineString(out);
    return out;
  };

  try {
    await ensureMlxWorkerReady(textLlm!);
    await runFortranOpenThenFirstCommand({
      cwd: repoRoot,
      getInstructionsAnswer: async () =>
        rl.question("Would you like instructions? (y/n) "),
      getFirstCommandLine: async (ctx) => {
        if (useInteractiveSession) {
          interactiveMemory.seedOpening(ctx.transcriptSoFar, {
            adventureDb: db,
          });
        }
        const user = await rl.question("> ");
        return interpretPlayerLineToGetin(
          user,
          buildInteractiveRecentForLlm(ctx.transcriptSoFar),
        );
      },
      getContinueLine: async (ctx) => {
        if (useInteractiveSession && lastSentGetin.length > 0) {
          interactiveMemory.recordCommandOutcome(
            lastSentGetin,
            ctx.gameOutputSinceLastCommand,
            { adventureDb: db },
          );
        }
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
        return interpretPlayerLineToGetin(
          line,
          buildInteractiveRecentForLlm(ctx.gameOutputSinceLastCommand),
        );
      },
    });
  } catch (err) {
    if (shouldFallbackToClassicForLlmError(err, textLlm!.providerId)) {
      process.stderr.write(
        "\nadventure-llm: text model is unavailable (quota, rate limit, or service error). Switching to classic mode: type parser words directly (e.g. EAST, TAKE LAMP).\n\n",
      );
      printClassicBanner(hasTextLlm, forceClassic);
      runClassicInteractive();
      return;
    }
    throw err;
  } finally {
    rl.close();
  }
}

function isReadlineUserAbort(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "ABORT_ERR"
  );
}

main().catch((e) => {
  if (isReadlineUserAbort(e)) {
    process.exit(0);
    return;
  }
  console.error(e);
  process.exitCode = 1;
});
