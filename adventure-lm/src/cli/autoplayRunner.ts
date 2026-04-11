/**
 * Shared self-acting (autoplay) session: Fortran subprocess + TextLlm planner.
 * CLI uses terminal streaming; web dashboard uses {@link AutoplayUiSink} + silent subprocess.
 */
import { loadDatFile } from "../dat/loadDat.js";
import {
  runFortranOpenThenFirstCommand,
  type ScriptedGetinLine,
} from "../engine/subprocessEngine.js";
import {
  AutoplaySessionMemory,
  buildAutoplayPlannerInvocation,
  effectivePlannerSendPayload,
  gameOutputLooksLikePlayAgainPrompt,
  interpretedToGetinLine,
  planAfterAutoplayGuards,
  plannerToScriptedGetin,
  resolveCompactPrompts,
  resolveStructuredDashboardPrompts,
  type AutoplayPlannerResponse,
  type AutoplayPromptMode,
  type AutoplayUiSnapshot,
  type PromptExperimentPatch,
} from "@adventure-lm/lm-glue";
import { planAutoplayWithTextLlm } from "../nl/adventureTextLlm.js";
import { appendInteractionLog, resolveDebugLogPath } from "../nl/llmDebug.js";
import {
  DEFAULT_AUTOPLAY_MAX_MOVES,
  maxMovesFromOverrides,
  paceMsFromOverrides,
  resolveAutoplayContextChars,
  resolveAutoplayMaxMoves,
  resolveAutoplayPaceMs,
} from "../nl/autoplayThrottle.js";
import {
  describeMotionGridDelta,
  primaryFromGetinCommand,
  type PlannerUserPromptInput,
  type TextLlm,
  type TextLlmProviderId,
} from "@adventure-lm/lm-glue";

/** Fixed client or mutable ref (web dashboard text model hot-swap). */
export type TextLlmSource = TextLlm | { current: TextLlm };

function isMutableTextLlmRef(s: TextLlmSource): s is { current: TextLlm } {
  return (
    typeof s === "object" && s !== null && "current" in s && !("modelId" in s)
  );
}

/** Resolves the active client once per call (supports `{ current }` for text model hot-swap in the web UI). */
export function getTextLlmAccessor(src: TextLlmSource): () => TextLlm {
  if (isMutableTextLlmRef(src)) {
    return () => src.current;
  }
  return () => src;
}

/** Returned by {@link AutoplayManualPlannerGate.waitForManualLine} when the UI turns autoplay back on while waiting. */
export const AUTOPLAY_RESUME_PLANNER = Symbol.for(
  "adventure_llm.autoplay_resume_planner",
);

export type AutoplayManualPlannerGate = {
  readonly isPlannerEnabled: () => boolean;
  /**
   * Await user input from the dashboard. Return `null` to end the session without another GETIN
   * (same as planner `continuePlaying: false`). Return {@link AUTOPLAY_RESUME_PLANNER} if the UI
   * re-enables the planner while blocked (runner will call the text model on the next iteration).
   */
  readonly waitForManualLine: () => Promise<
    ScriptedGetinLine | null | typeof AUTOPLAY_RESUME_PLANNER
  >;
};

/** Display-only plan for logging / SSE when the player supplied a GETIN line manually. */
export function syntheticPlannerResponseFromScripted(
  scripted: ScriptedGetinLine,
): AutoplayPlannerResponse {
  const line = typeof scripted === "string" ? scripted : scripted.line;
  const head = primaryFromGetinCommand(line);
  const primaryToken = head.slice(0, 5).padEnd(5, " ").trimEnd();
  const trimmed = line.trimEnd();
  let secondaryToken: string | undefined;
  if (trimmed.length > 5) {
    const sec = trimmed.slice(5, 10).trim();
    if (sec.length > 0) secondaryToken = sec.slice(0, 5);
  }
  return {
    primaryToken: primaryToken.length > 0 ? primaryToken : "MANU",
    secondaryToken,
    continuePlaying: true,
  };
}

export type AutoplayRunPaths = {
  readonly repoRoot: string;
  readonly datPath: string;
};

/** Optional overrides for autoplay throttling (e.g. web dashboard). */
export type AutoplayRunOverrides = {
  readonly paceMs?: number;
  readonly maxMoves?: number;
  /**
   * When set, called before each inter-move delay. Overrides {@link paceMs} for that step.
   * Used by the dashboard so POST /api/autoplay-settings applies without restarting autoplay.
   */
  readonly getPaceMs?: () => number;
  /**
   * When set, called before each max-move check. Overrides {@link maxMoves} for that step.
   */
  readonly getMaxMoves?: () => number;
  /** Web dashboard: prompt experiment patch applied after session-memory planner build. */
  readonly getPlannerPromptExperiment?: () => PromptExperimentPatch;
  /** Override autoplay prompt mode (strategy registry / dashboard) without mutating env. */
  readonly getAutoplayPromptMode?: () => AutoplayPromptMode;
};

export type AutoplayUiSink = {
  /** When false, subprocess still runs but game output only goes to {@link onTranscriptChunk}. Default true. */
  readonly forwardGameOutputToTerminal?: boolean;
  readonly onSessionStart?: (e: {
    paceMs: number;
    maxMoves: number;
    contextChars: number;
    providerId: string;
  }) => void;
  readonly onSessionEnd?: () => void;
  readonly onPlannerPhase?: (e: {
    phase: "start" | "end";
    providerId: string;
    /** Present on `end` when timing is available. */
    elapsedMs?: number;
  }) => void;
  readonly onPlannerPrompt?: (e: {
    userPreview: string;
    systemPreview?: string;
    fullSystem?: string;
    fullUser?: string;
    merged?: string;
  }) => void;
  /**
   * Engine stdout/stderr chunk. `step` = GETIN lines already sent (0 = opening only).
   */
  readonly onTranscriptChunk?: (text: string, step: number) => void;
  /**
   * Engine output is idle and a GETIN will be read next (browser-orchestrated autoplay; ADR0005).
   * `step` matches the upcoming {@link onTranscriptChunk} tag until the next GETIN is applied.
   */
  readonly onAwaitingPlayerInput?: (e: {
    phase: "first" | "continue";
    transcriptSoFar: string;
    gameOutputSinceLastCommand: string;
    step: number;
  }) => void;
  readonly onTurnEnd?: (e: {
    transcriptSoFar: string;
    gameOutputSinceLastCommand: string;
    snapshot: AutoplayUiSnapshot;
    moveIndex: number;
    maxMoves: number;
  }) => void;
  readonly onPlanApplied?: (e: {
    plan: AutoplayPlannerResponse;
    scripted: ScriptedGetinLine;
    getinLine: string;
    /** 1-based ordinal of this GETIN (same step tag as following engine output). */
    moveNumber: number;
    /** Wrapper inferred-grid delta for transcript captions; null if primary has no grid entry. */
    motionGridHint: string | null;
  }) => void;
  /** Guard substitutions and autoplay log lines (include trailing `\n` where applicable). */
  readonly onLogLine?: (line: string, step: number) => void;
  /**
   * Awaited at the start of each planner call (before building prompts). Used by the web dashboard
   * to pause autoplay while an MLX model swap is loading (API swaps do not use this barrier).
   */
  readonly beforePlannerCall?: () => Promise<void>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export {
  DEFAULT_AUTOPLAY_MAX_MOVES,
  maxMovesFromOverrides,
  paceMsFromOverrides,
  resolveAutoplayContextChars,
  resolveAutoplayMaxMoves,
  resolveAutoplayPaceMs,
};

function scriptedGetinLineString(scripted: ScriptedGetinLine): string {
  if (typeof scripted === "string") return scripted;
  return scripted.line;
}

function motionGridHintFromGetinLine(getinLine: string): string | null {
  return describeMotionGridDelta(primaryFromGetinCommand(getinLine));
}

function truncatePreview(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

export function formatPlannerPromptPreviews(
  input: PlannerUserPromptInput,
  maxUser = 12_000,
  maxSystem = 8_000,
): { userPreview: string; systemPreview?: string } {
  if (typeof input === "string") {
    return { userPreview: truncatePreview(input, maxUser) };
  }
  return {
    systemPreview: truncatePreview(input.system, maxSystem),
    userPreview: truncatePreview(input.user, maxUser),
  };
}

function logAutoplaySendingToGame(
  plan: AutoplayPlannerResponse,
  scripted: ScriptedGetinLine,
  log: (line: string) => void,
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
  const fmtGetin = (line: string) => JSON.stringify(line.trimEnd());
  let getinDesc: string;
  if (typeof scripted === "string") {
    getinDesc = fmtGetin(scripted);
  } else {
    getinDesc = fmtGetin(scripted.line);
    if (scripted.retryIfRejected !== undefined) {
      getinDesc += `, retry if rejected: ${fmtGetin(scripted.retryIfRejected)}`;
    }
  }
  const lineOut = `adventure-lm: autoplay — planned ${tok.join(", ")} → to adventure (GETIN): ${getinDesc}\n`;
  log(lineOut);
}

/** Compact / structured layout and repair window for the active text model provider (supports web hot-swap). */
export function resolveAutoplayPromptLayout(providerId: TextLlmProviderId): {
  compact: boolean;
  structuredDashboard: boolean;
  repairTailChars: number;
} {
  const compact = resolveCompactPrompts(providerId);
  const structuredDashboard = resolveStructuredDashboardPrompts(providerId);
  const repairTailChars = compact ? 1200 : 2500;
  return { compact, structuredDashboard, repairTailChars };
}

/** Instructions screen: `ADVENTURE_LM_INSTRUCTIONS=y` or `n` (default `n`). */
export function resolveAutoplayInstructionsAnswer(): string {
  const v = process.env.ADVENTURE_LM_INSTRUCTIONS?.trim().toLowerCase();
  if (v?.startsWith("y")) return "y";
  return "n";
}

export async function runAutoplaySessionWithTextLlm(
  client: TextLlmSource,
  paths: AutoplayRunPaths,
  sink?: AutoplayUiSink,
  manualPlannerGate?: AutoplayManualPlannerGate,
  overrides?: AutoplayRunOverrides,
): Promise<void> {
  const getClient = getTextLlmAccessor(client);

  const db = loadDatFile(paths.datPath);
  const memory = new AutoplaySessionMemory();
  const contextChars = resolveAutoplayContextChars();

  const logLine = (line: string) => {
    if (sink?.onLogLine) {
      sink.onLogLine(line, movesSent);
    } else {
      process.stderr.write(line);
    }
  };

  let movesSent = 0;
  let lastGetinLine = "";

  let sessionTranscript = "";

  const callPlanner = async (recentForRepair: string) => {
    await sink?.beforePlannerCall?.();
    const plannerClient = getClient();
    const inv = buildAutoplayPlannerInvocation({
      db,
      memory,
      contextChars,
      providerId: plannerClient.providerId,
      recentForRepairRaw: recentForRepair,
      overrides,
    });
    const capSse = process.env.ADVENTURE_LM_SSE_FULL_PROMPTS?.trim() === "1";
    const effective = effectivePlannerSendPayload(
      db,
      plannerClient.providerId,
      inv.plannerUserPrompt,
      {
        compact: inv.compact,
        structuredSplit: inv.useMxStructuredSplit,
        includeDatHelpInSystem: inv.includeDatHelpInSystem,
        capForEventStream: capSse,
      },
    );
    sink?.onPlannerPrompt?.({
      userPreview: effective.userPreview,
      systemPreview: effective.systemPreview,
      fullSystem: effective.fullSystem,
      fullUser: effective.fullUser,
      merged: effective.merged,
    });
    const plannerT0 = performance.now();
    sink?.onPlannerPhase?.({
      phase: "start",
      providerId: plannerClient.providerId,
    });
    try {
      return await planAutoplayWithTextLlm(db, plannerClient, {
        plannerUserPrompt: inv.plannerUserPrompt,
        recentGameTextForRepair: inv.recentGameTextForRepair,
        includeDatHelpInSystem: inv.includeDatHelpInSystem,
      });
    } finally {
      const elapsedMs = Math.max(0, performance.now() - plannerT0);
      sink?.onPlannerPhase?.({
        phase: "end",
        providerId: plannerClient.providerId,
        elapsedMs,
      });
    }
  };

  type MoveChoice =
    | {
        tag: "move";
        scripted: ScriptedGetinLine;
        planForLog: AutoplayPlannerResponse;
      }
    | { tag: "planner_stop"; plan: AutoplayPlannerResponse }
    | { tag: "gate_stop" };

  async function chooseNextMove(recentForRepair: string): Promise<MoveChoice> {
    for (;;) {
      if (
        manualPlannerGate !== undefined &&
        !manualPlannerGate.isPlannerEnabled()
      ) {
        const r = await manualPlannerGate.waitForManualLine();
        if (r === null) return { tag: "gate_stop" };
        if (r === AUTOPLAY_RESUME_PLANNER) continue;
        return {
          tag: "move",
          scripted: r,
          planForLog: syntheticPlannerResponseFromScripted(r),
        };
      }
      const plan = await callPlanner(recentForRepair);
      if (plan.continuePlaying === false) {
        return { tag: "planner_stop", plan };
      }
      const planSafe = planAfterAutoplayGuards(memory, plan, logLine);
      const scripted = plannerToScriptedGetin(planSafe);
      return { tag: "move", scripted, planForLog: planSafe };
    }
  }

  const logPath = resolveDebugLogPath();
  if (logPath) {
    process.stderr.write(`adventure-lm: interaction log → ${logPath}\n`);
  }

  const paceMs0 = paceMsFromOverrides(overrides);
  const maxMoves0 = maxMovesFromOverrides(overrides);
  sink?.onSessionStart?.({
    paceMs: paceMs0,
    maxMoves: maxMoves0,
    contextChars,
    providerId: getClient().providerId,
  });
  if (sink === undefined) {
    process.stderr.write("adventure-lm: self-acting (autoplay) mode.\n");
    process.stderr.write(
      `adventure-lm: pace ${paceMs0}ms; max moves ${maxMoves0}; context ~${contextChars} chars.\n`,
    );
  }

  const forwardTerminal = sink?.forwardGameOutputToTerminal !== false;

  await runFortranOpenThenFirstCommand({
    cwd: paths.repoRoot,
    forwardGameOutputToTerminal: forwardTerminal,
    onGameOutputChunk: (chunk) => {
      sessionTranscript += chunk.toString("utf8");
      sink?.onTranscriptChunk?.(chunk.toString("utf8"), movesSent);
    },
    getInstructionsAnswer: async () => resolveAutoplayInstructionsAnswer(),
    getFirstCommandLine: async (ctx) => {
      memory.seedOpening(ctx.transcriptSoFar, { adventureDb: db });
      {
        const paceMs = paceMsFromOverrides(overrides);
        if (paceMs > 0) await sleep(paceMs);
      }
      const { repairTailChars } = resolveAutoplayPromptLayout(
        getClient().providerId,
      );
      const choice = await chooseNextMove(
        ctx.transcriptSoFar.slice(-repairTailChars),
      );
      if (choice.tag === "planner_stop") {
        await appendInteractionLog({
          event: "autoplay_stop_before_first_command",
        });
        const quitLine: ScriptedGetinLine = interpretedToGetinLine({
          primaryToken: "QUIT",
        });
        logAutoplaySendingToGame(choice.plan, quitLine, logLine);
        const glQuit = scriptedGetinLineString(quitLine);
        sink?.onPlanApplied?.({
          plan: choice.plan,
          scripted: quitLine,
          getinLine: glQuit,
          moveNumber: movesSent + 1,
          motionGridHint: motionGridHintFromGetinLine(glQuit),
        });
        movesSent = 1;
        lastGetinLine = glQuit;
        return quitLine;
      }
      if (choice.tag === "gate_stop") {
        await appendInteractionLog({
          event: "autoplay_stop_before_first_command",
          reason: "manual_end",
        });
        const quitLine: ScriptedGetinLine = interpretedToGetinLine({
          primaryToken: "QUIT",
        });
        const endPlan: AutoplayPlannerResponse = {
          primaryToken: "QUIT",
          continuePlaying: false,
        };
        logAutoplaySendingToGame(endPlan, quitLine, logLine);
        const glGateQuit = scriptedGetinLineString(quitLine);
        sink?.onPlanApplied?.({
          plan: endPlan,
          scripted: quitLine,
          getinLine: glGateQuit,
          moveNumber: movesSent + 1,
          motionGridHint: motionGridHintFromGetinLine(glGateQuit),
        });
        movesSent = 1;
        lastGetinLine = glGateQuit;
        return quitLine;
      }
      const { scripted, planForLog } = choice;
      logAutoplaySendingToGame(planForLog, scripted, logLine);
      const glFirst = scriptedGetinLineString(scripted);
      sink?.onPlanApplied?.({
        plan: planForLog,
        scripted,
        getinLine: glFirst,
        moveNumber: movesSent + 1,
        motionGridHint: motionGridHintFromGetinLine(glFirst),
      });
      movesSent = 1;
      lastGetinLine = glFirst;
      return scripted;
    },
    getContinueLine: async (ctx) => {
      memory.recordCommandOutcome(
        lastGetinLine,
        ctx.gameOutputSinceLastCommand,
        { adventureDb: db },
      );
      const maxMovesNow = maxMovesFromOverrides(overrides);
      sink?.onTurnEnd?.({
        transcriptSoFar: sessionTranscript,
        gameOutputSinceLastCommand: ctx.gameOutputSinceLastCommand,
        snapshot: memory.buildAutoplayUiSnapshot(),
        moveIndex: movesSent,
        maxMoves: maxMovesNow,
      });
      if (movesSent >= maxMovesNow) {
        await appendInteractionLog({
          event: "autoplay_max_moves",
          movesSent,
        });
        return null;
      }
      {
        const paceMs = paceMsFromOverrides(overrides);
        if (paceMs > 0) await sleep(paceMs);
      }
      if (gameOutputLooksLikePlayAgainPrompt(ctx.gameOutputSinceLastCommand)) {
        await appendInteractionLog({ event: "autoplay_play_again_yes" });
        const scripted = interpretedToGetinLine({ primaryToken: "Y" });
        const planForLog: AutoplayPlannerResponse = {
          primaryToken: "Y",
          continuePlaying: true,
        };
        logLine(
          "adventure-lm: autoplay — GAME IS OVER / PLAY AGAIN detected; sending Y (restart)\n",
        );
        logAutoplaySendingToGame(planForLog, scripted, logLine);
        const glPlayAgain = scriptedGetinLineString(scripted);
        sink?.onPlanApplied?.({
          plan: planForLog,
          scripted,
          getinLine: glPlayAgain,
          moveNumber: movesSent + 1,
          motionGridHint: motionGridHintFromGetinLine(glPlayAgain),
        });
        movesSent += 1;
        lastGetinLine = glPlayAgain;
        return scripted;
      }
      const { repairTailChars } = resolveAutoplayPromptLayout(
        getClient().providerId,
      );
      const choice = await chooseNextMove(
        ctx.gameOutputSinceLastCommand.slice(-repairTailChars),
      );
      if (choice.tag === "planner_stop") {
        await appendInteractionLog({
          event: "autoplay_stop",
          reason: "continuePlaying",
        });
        return null;
      }
      if (choice.tag === "gate_stop") {
        await appendInteractionLog({
          event: "autoplay_stop",
          reason: "manual_end",
        });
        return null;
      }
      const { scripted, planForLog } = choice;
      logAutoplaySendingToGame(planForLog, scripted, logLine);
      const glCont = scriptedGetinLineString(scripted);
      sink?.onPlanApplied?.({
        plan: planForLog,
        scripted,
        getinLine: glCont,
        moveNumber: movesSent + 1,
        motionGridHint: motionGridHintFromGetinLine(glCont),
      });
      movesSent += 1;
      lastGetinLine = glCont;
      return scripted;
    },
  });

  await appendInteractionLog({ event: "autoplay_session_end" });
  sink?.onSessionEnd?.();
}

export { plannerToScriptedGetin };
