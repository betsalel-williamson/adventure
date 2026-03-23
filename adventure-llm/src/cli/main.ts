#!/usr/bin/env node
/**
 * CLI: with a configured text LLM (Google Generative AI or OpenAI-compatible HTTP), the Fortran opening runs
 * (you answer the instructions question), then each `> ` line is mapped through help-intent shortcuts and the LLM
 * into GETIN tokens until .quit/:q or game exit. Otherwise the original Fortran binary runs in full TTY.
 * Pass --classic to force Fortran even when an LLM is configured. Pass --debug to enable JSONL interaction
 * logging (see ADVENTURE_LLM_DEBUG* and ADVENTURE_LLM_CACHE_DIR in .env.example).
 * Pass --autoplay for self-acting mode (LLM drives every move; see ADVENTURE_LLM_AUTOPLAY_* in .env.example).
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
import { AutoplaySessionMemory } from "../nl/autoplaySessionMemory.js";
import {
  interpretWithTextLlm,
  planAutoplayWithTextLlm,
  resolveTextLlmFromEnv,
} from "../nl/adventureTextLlm.js";
import {
  resolveCompactPrompts,
  resolveVocabHintMaxWords,
} from "../nl/adventureNlPrompts.js";
import {
  buildSituationalCandidateTokens,
  formatSituationalCandidatesSection,
} from "../nl/situationalCandidates.js";
import { buildVocabHint } from "../nl/vocabHint.js";
import { shouldFallbackToClassicForLlmError } from "../nl/llmErrors.js";
import {
  appendInteractionLog,
  resolveCacheDir,
  resolveDebugLogPath,
} from "../nl/llmDebug.js";
import { instructionIntentToHelpCommand } from "../nl/intent.js";
import {
  interpretedToGetinLine,
  swapInterpretedTokens,
  type AutoplayPlannerResponse,
} from "../nl/schema.js";
import type { TextLlm } from "../nl/textLlmContract.js";

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
      "Natural language needs a text LLM: set GEMINI_API_KEY and/or ADVENTURE_LLM_HTTP_* (see adventure-llm/.env.example). Omit --classic once configured.\n",
    );
  } else if (forceClassic) {
    process.stderr.write(
      "Running Fortran only (--classic). Restart without --classic for natural language first.\n",
    );
  }
  process.stderr.write("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveAutoplayPaceMs(): number {
  const v = process.env.ADVENTURE_LLM_AUTOPLAY_PACE_MS?.trim();
  if (v === undefined || v === "") return 2000;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 2000;
}

function resolveAutoplayMaxMoves(): number {
  const v = process.env.ADVENTURE_LLM_AUTOPLAY_MAX_MOVES?.trim();
  if (v === undefined || v === "") return 300;
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 300;
}

function resolveAutoplayContextChars(): number {
  const v = process.env.ADVENTURE_LLM_AUTOPLAY_CONTEXT_CHARS?.trim();
  if (v === undefined || v === "") return 6000;
  const n = Number(v);
  return Number.isFinite(n) && n >= 2000 ? Math.floor(n) : 6000;
}

/** Instructions screen: `ADVENTURE_LLM_INSTRUCTIONS=y` or `n` (default `n`). */
function resolveAutoplayInstructionsAnswer(): string {
  const v = process.env.ADVENTURE_LLM_INSTRUCTIONS?.trim().toLowerCase();
  if (v?.startsWith("y")) return "y";
  return "n";
}

function scriptedGetinLineString(scripted: ScriptedGetinLine): string {
  if (typeof scripted === "string") return scripted;
  return scripted.line;
}

function toInterpreted(r: AutoplayPlannerResponse): {
  primaryToken: string;
  secondaryToken?: string;
  confidence?: number;
} {
  return {
    primaryToken: r.primaryToken,
    secondaryToken: r.secondaryToken,
    confidence: r.confidence,
  };
}

function plannerToScriptedGetin(r: AutoplayPlannerResponse): ScriptedGetinLine {
  const cmd = toInterpreted(r);
  const firstLine = interpretedToGetinLine(cmd);
  const swapped = swapInterpretedTokens(cmd);
  const retryLine = swapped ? interpretedToGetinLine(swapped) : undefined;
  if (retryLine !== undefined && retryLine.trimEnd() !== firstLine.trimEnd()) {
    return { line: firstLine, retryIfRejected: retryLine };
  }
  return firstLine;
}

/** Substitute planner output when it would repeat a GETIN line the parser already rejected. */
function planAfterRejectedQueueGuard(
  memory: AutoplaySessionMemory,
  plan: AutoplayPlannerResponse,
): AutoplayPlannerResponse {
  const planSafe = memory.avoidRepeatingRejectedCommand(plan);
  if (
    interpretedToGetinLine(toInterpreted(plan)) !==
    interpretedToGetinLine(toInterpreted(planSafe))
  ) {
    process.stderr.write(
      "adventure-llm: autoplay — replaced plan that repeated a parser-rejected GETIN line\n",
    );
  }
  return planSafe;
}

/** stderr: LLM tokens and exact GETIN line(s) sent to the Fortran adventure binary. */
function logAutoplaySendingToGame(
  plan: AutoplayPlannerResponse,
  scripted: ScriptedGetinLine,
): void {
  const tok: string[] = [`primary=${plan.primaryToken}`];
  if (plan.secondaryToken !== undefined && plan.secondaryToken !== "") {
    tok.push(`secondary=${plan.secondaryToken}`);
  }
  if (plan.confidence !== undefined) {
    tok.push(`confidence=${plan.confidence}`);
  }
  if (plan.continuePlaying === false) {
    tok.push("continuePlaying=false");
  }
  let getinDesc: string;
  if (typeof scripted === "string") {
    getinDesc = JSON.stringify(scripted);
  } else {
    getinDesc = JSON.stringify(scripted.line);
    if (scripted.retryIfRejected !== undefined) {
      getinDesc += `, retry if rejected: ${JSON.stringify(scripted.retryIfRejected)}`;
    }
  }
  process.stderr.write(
    `adventure-llm: autoplay — planned ${tok.join(", ")} → to adventure (GETIN): ${getinDesc}\n`,
  );
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

async function runAutoplaySessionWithTextLlm(client: TextLlm): Promise<void> {
  const db = loadDatFile(datPath);
  const memory = new AutoplaySessionMemory();
  const maxMoves = resolveAutoplayMaxMoves();
  const paceMs = resolveAutoplayPaceMs();
  const contextChars = resolveAutoplayContextChars();

  let movesSent = 0;
  let lastGetinLine = "";

  const compact = resolveCompactPrompts(client.providerId);
  const repairTailChars = compact ? 1200 : 2500;
  const callPlanner = async (recentForRepair: string) => {
    const vocabHint = buildVocabHint(db, resolveVocabHintMaxWords(compact));
    const situationalSection = formatSituationalCandidatesSection(
      buildSituationalCandidateTokens(db, memory.getRecentRawTail()),
    );
    const plannerUserPrompt = memory.buildPlannerUserPrompt(
      contextChars,
      vocabHint,
      { compact, situationalSection },
    );
    return planAutoplayWithTextLlm(db, client, {
      plannerUserPrompt,
      recentGameTextForRepair: recentForRepair.slice(-repairTailChars),
    });
  };

  const logPath = resolveDebugLogPath();
  if (logPath) {
    process.stderr.write(`adventure-llm: interaction log → ${logPath}\n`);
  }

  process.stderr.write("adventure-llm: self-acting (autoplay) mode.\n");
  process.stderr.write(
    `adventure-llm: pace ${paceMs}ms; max moves ${maxMoves}; context ~${contextChars} chars.\n`,
  );

  await runFortranOpenThenFirstCommand({
    cwd: repoRoot,
    getInstructionsAnswer: async () => resolveAutoplayInstructionsAnswer(),
    getFirstCommandLine: async (ctx) => {
      memory.seedOpening(ctx.transcriptSoFar);
      if (paceMs > 0) await sleep(paceMs);
      const plan = await callPlanner(
        ctx.transcriptSoFar.slice(-repairTailChars),
      );
      if (plan.continuePlaying === false) {
        await appendInteractionLog({
          event: "autoplay_stop_before_first_command",
        });
        const quitLine: ScriptedGetinLine = interpretedToGetinLine({
          primaryToken: "QUIT",
        });
        logAutoplaySendingToGame(plan, quitLine);
        movesSent = 1;
        lastGetinLine = scriptedGetinLineString(quitLine);
        return quitLine;
      }
      const planSafe = planAfterRejectedQueueGuard(memory, plan);
      const scripted = plannerToScriptedGetin(planSafe);
      logAutoplaySendingToGame(planSafe, scripted);
      movesSent = 1;
      lastGetinLine = scriptedGetinLineString(scripted);
      return scripted;
    },
    getContinueLine: async (ctx) => {
      memory.recordCommandOutcome(
        lastGetinLine,
        ctx.gameOutputSinceLastCommand,
      );
      if (movesSent >= maxMoves) {
        await appendInteractionLog({
          event: "autoplay_max_moves",
          movesSent,
        });
        return null;
      }
      if (paceMs > 0) await sleep(paceMs);
      const plan = await callPlanner(
        ctx.gameOutputSinceLastCommand.slice(-repairTailChars),
      );
      if (plan.continuePlaying === false) {
        await appendInteractionLog({
          event: "autoplay_stop",
          reason: "continuePlaying",
        });
        return null;
      }
      const planSafe = planAfterRejectedQueueGuard(memory, plan);
      const scripted = plannerToScriptedGetin(planSafe);
      logAutoplaySendingToGame(planSafe, scripted);
      movesSent += 1;
      lastGetinLine = scriptedGetinLineString(scripted);
      return scripted;
    },
  });

  await appendInteractionLog({ event: "autoplay_session_end" });
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
      "adventure-llm: --autoplay requires a text LLM (GEMINI_API_KEY and/or ADVENTURE_LLM_HTTP_MODEL; see .env.example).\n",
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
      await runAutoplaySessionWithTextLlm(textLlm);
    } catch (err) {
      if (shouldFallbackToClassicForLlmError(err, textLlm.providerId)) {
        process.stderr.write(
          "\nadventure-llm: text LLM unavailable (quota, rate limit, network, or service error). Autoplay stopped.\n",
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
    const interpreted = await interpretWithTextLlm(user, db, textLlm!, {
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
      getFirstCommandLine: async (ctx) => {
        const user = await rl.question("> ");
        return interpretPlayerLineToGetin(user, ctx.transcriptSoFar);
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
    if (shouldFallbackToClassicForLlmError(err, textLlm!.providerId)) {
      process.stderr.write(
        "\nadventure-llm: text LLM is unavailable (quota, rate limit, or service error). Switching to classic mode: type parser words directly (e.g. EAST, TAKE LAMP).\n\n",
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
