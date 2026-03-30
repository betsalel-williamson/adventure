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
  gameOutputLooksLikePlayAgainPrompt,
  type AutoplayUiSnapshot,
} from "../nl/autoplaySessionMemory.js";
import { planAutoplayWithTextLlm } from "../nl/adventureTextLlm.js";
import {
  effectivePlannerSendPayload,
  resolveAutoplayPromptMode,
  resolveCompactPrompts,
  resolveStructuredDashboardPrompts,
  resolveVocabHintMaxWords,
} from "../nl/adventureNlPrompts.js";
import {
  applyPlannerPromptExperiment,
  type PromptExperimentPatch,
} from "../nl/promptExperiment.js";
import {
  buildSituationalCandidateTokens,
  formatSituationalCandidatesSection,
  recentTextSuggestsIndoorBuildingNavigation,
  shouldPrioritizeLootFunnel,
} from "../nl/situationalCandidates.js";
import { buildVocabHint } from "../nl/vocabHint.js";
import { appendInteractionLog, resolveDebugLogPath } from "../nl/llmDebug.js";
import {
  interpretedToGetinLine,
  swapInterpretedTokens,
  type AutoplayPlannerResponse,
} from "../nl/schema.js";
import {
  describeMotionGridDelta,
  primaryFromGetinCommand,
} from "../nl/inferredExplorationMap.js";
import type {
  PlannerUserPromptInput,
  TextLlm,
  TextLlmProviderId,
} from "../nl/textLlmContract.js";

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

const PACE_MS_MAX = 3_600_000;
const MAX_MOVES_CAP = 1_000_000;

function paceMsFromOverrides(
  overrides: AutoplayRunOverrides | undefined,
): number {
  if (overrides?.getPaceMs) {
    const n = overrides.getPaceMs();
    if (Number.isFinite(n) && n >= 0 && n <= PACE_MS_MAX) return Math.floor(n);
    return resolveAutoplayPaceMs();
  }
  if (overrides?.paceMs !== undefined) {
    const n = Number(overrides.paceMs);
    return Number.isFinite(n) && n >= 0
      ? Math.floor(n)
      : resolveAutoplayPaceMs();
  }
  return resolveAutoplayPaceMs();
}

function maxMovesFromOverrides(
  overrides: AutoplayRunOverrides | undefined,
): number {
  if (overrides?.getMaxMoves) {
    const n = overrides.getMaxMoves();
    if (Number.isFinite(n) && n >= 1 && n <= MAX_MOVES_CAP)
      return Math.floor(n);
    return resolveAutoplayMaxMoves();
  }
  if (overrides?.maxMoves !== undefined) {
    const n = Number(overrides.maxMoves);
    return Number.isFinite(n)
      ? Math.max(1, Math.floor(n))
      : resolveAutoplayMaxMoves();
  }
  return resolveAutoplayMaxMoves();
}

function scriptedGetinLineString(scripted: ScriptedGetinLine): string {
  if (typeof scripted === "string") return scripted;
  return scripted.line;
}

function motionGridHintFromGetinLine(getinLine: string): string | null {
  return describeMotionGridDelta(primaryFromGetinCommand(getinLine));
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

export function plannerToScriptedGetin(
  r: AutoplayPlannerResponse,
): ScriptedGetinLine {
  const cmd = toInterpreted(r);
  const firstLine = interpretedToGetinLine(cmd);
  const swapped = swapInterpretedTokens(cmd);
  const retryLine = swapped ? interpretedToGetinLine(swapped) : undefined;
  if (retryLine !== undefined && retryLine.trimEnd() !== firstLine.trimEnd()) {
    return { line: firstLine, retryIfRejected: retryLine };
  }
  return firstLine;
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

function planAfterAutoplayGuards(
  memory: AutoplaySessionMemory,
  plan: AutoplayPlannerResponse,
  log: (line: string) => void,
): AutoplayPlannerResponse {
  let planSafe = memory.avoidRepeatingRejectedCommand(plan);
  if (
    interpretedToGetinLine(toInterpreted(plan)) !==
    interpretedToGetinLine(toInterpreted(planSafe))
  ) {
    log(
      "adventure-llm: autoplay — replaced plan that repeated a parser-rejected GETIN line\n",
    );
  }
  const beforeTakeCarry = planSafe;
  planSafe = memory.avoidRedundantTakeWhenCarrying(planSafe);
  if (
    interpretedToGetinLine(toInterpreted(beforeTakeCarry)) !==
    interpretedToGetinLine(toInterpreted(planSafe))
  ) {
    log(
      "adventure-llm: autoplay — replaced plan: TAKE/GET object already in inventory\n",
    );
  }
  const beforeOsc = planSafe;
  planSafe = memory.avoidOscillatingCommand(planSafe);
  if (
    interpretedToGetinLine(toInterpreted(beforeOsc)) !==
    interpretedToGetinLine(toInterpreted(planSafe))
  ) {
    log(
      "adventure-llm: autoplay — replaced plan that would continue a two-location loop\n",
    );
  }
  const beforeStag = planSafe;
  planSafe = memory.avoidStagnatingCommand(planSafe);
  if (
    interpretedToGetinLine(toInterpreted(beforeStag)) !==
    interpretedToGetinLine(toInterpreted(planSafe))
  ) {
    log(
      "adventure-llm: autoplay — replaced plan due to location stagnation (inferred map)\n",
    );
  }
  const beforeLook = planSafe;
  planSafe = memory.avoidRepeatedLookExamiInSameCell(planSafe);
  if (
    interpretedToGetinLine(toInterpreted(beforeLook)) !==
    interpretedToGetinLine(toInterpreted(planSafe))
  ) {
    log(
      "adventure-llm: autoplay — replaced plan: LOOK/EXAMI already used without leaving this room (inferred map)\n",
    );
  }
  return planSafe;
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
  const lineOut = `adventure-llm: autoplay — planned ${tok.join(", ")} → to adventure (GETIN): ${getinDesc}\n`;
  log(lineOut);
}

export function resolveAutoplayPaceMs(): number {
  const v = process.env.ADVENTURE_LLM_AUTOPLAY_PACE_MS?.trim();
  if (v === undefined || v === "") return 2000;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 2000;
}

export function resolveAutoplayMaxMoves(): number {
  const v = process.env.ADVENTURE_LLM_AUTOPLAY_MAX_MOVES?.trim();
  if (v === undefined || v === "") return 300;
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 300;
}

export function resolveAutoplayContextChars(): number {
  const v = process.env.ADVENTURE_LLM_AUTOPLAY_CONTEXT_CHARS?.trim();
  if (v === undefined || v === "") return 6000;
  const n = Number(v);
  return Number.isFinite(n) && n >= 2000 ? Math.floor(n) : 6000;
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

/** Instructions screen: `ADVENTURE_LLM_INSTRUCTIONS=y` or `n` (default `n`). */
export function resolveAutoplayInstructionsAnswer(): string {
  const v = process.env.ADVENTURE_LLM_INSTRUCTIONS?.trim().toLowerCase();
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
    const { compact, structuredDashboard, repairTailChars } =
      resolveAutoplayPromptLayout(plannerClient.providerId);
    const stagnating = memory.isLocationStagnating();
    const tryNextLine = memory.formatExplorationTryNextLine();
    const vocabHint = buildVocabHint(db, resolveVocabHintMaxWords(compact), {
      grouped: !compact,
      structuredGroups: structuredDashboard && !compact,
      compact,
    });
    const objectScope = memory.getObjectHintScopeText();
    const indoorLeave = recentTextSuggestsIndoorBuildingNavigation(objectScope);
    const promptMode = resolveAutoplayPromptMode();
    const invLines = memory.getStructuredInventory();
    const takeFailWords = memory.getRoomTakeFailureObjectAtabWords();
    const lootFunnel = shouldPrioritizeLootFunnel(
      db,
      objectScope,
      invLines,
      takeFailWords,
    );
    const situationalSection = formatSituationalCandidatesSection(
      db,
      buildSituationalCandidateTokens(db, memory.getRecentRawTail(), {
        deprioritize: stagnating ? ["ROAD"] : [],
        indoorLeaveBuilding: indoorLeave,
        exploreFirst: promptMode === "explore",
        inventorySubtractText:
          invLines.length > 0 ? invLines.join("\n") : undefined,
        takeFailureSubtractWords: takeFailWords,
        objectHintScopeText: objectScope,
        lootFunnel,
      }),
      stagnating && tryNextLine.length > 0 ? tryNextLine : undefined,
      {
        flatList: !compact,
        slmGrouped: compact,
        lootFunnelDeferCandMove: lootFunnel,
      },
    );
    const useMxStructuredSplit =
      plannerClient.providerId === "mlx" && structuredDashboard;
    const baselinePlannerPrompt: PlannerUserPromptInput = useMxStructuredSplit
      ? memory.buildPlannerMxStructuredPrompt(contextChars, {
          compact,
          situationalSection,
          lootFunnel,
        })
      : memory.buildPlannerUserPrompt(contextChars, vocabHint, {
          compact,
          situationalSection,
          structuredDashboard,
        });
    const experimentPatch = overrides?.getPlannerPromptExperiment?.() ?? {};
    const plannerUserPrompt = applyPlannerPromptExperiment(
      baselinePlannerPrompt,
      experimentPatch,
    );
    const includeDatHelp = experimentPatch.includeDatHelpInSystem !== false;
    const capSse = process.env.ADVENTURE_LLM_SSE_FULL_PROMPTS?.trim() === "1";
    const effective = effectivePlannerSendPayload(
      db,
      plannerClient.providerId,
      plannerUserPrompt,
      {
        compact,
        structuredSplit: useMxStructuredSplit,
        includeDatHelpInSystem: includeDatHelp,
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
    sink?.onPlannerPhase?.({
      phase: "start",
      providerId: plannerClient.providerId,
    });
    try {
      return await planAutoplayWithTextLlm(db, plannerClient, {
        plannerUserPrompt,
        recentGameTextForRepair: recentForRepair.slice(-repairTailChars),
        includeDatHelpInSystem: includeDatHelp,
      });
    } finally {
      sink?.onPlannerPhase?.({
        phase: "end",
        providerId: plannerClient.providerId,
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
    process.stderr.write(`adventure-llm: interaction log → ${logPath}\n`);
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
    process.stderr.write("adventure-llm: self-acting (autoplay) mode.\n");
    process.stderr.write(
      `adventure-llm: pace ${paceMs0}ms; max moves ${maxMoves0}; context ~${contextChars} chars.\n`,
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
          "adventure-llm: autoplay — GAME IS OVER / PLAY AGAIN detected; sending Y (restart)\n",
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
