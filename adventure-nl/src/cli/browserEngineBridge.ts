/**
 * Fortran-only autoplay loop for the web dashboard when the browser owns planner glue (ADR0005).
 * GETIN lines are supplied asynchronously via the dashboard session queue (HTTP), not from in-process LLM calls.
 */
import {
  runFortranOpenThenFirstCommand,
  type ScriptedGetinLine,
} from "../engine/subprocessEngine.js";
import { interpretedToGetinLine } from "@adventure-nl/nl-glue";
import type { AutoplayPlannerResponse } from "@adventure-nl/nl-glue";
import {
  AUTOPLAY_RESUME_PLANNER,
  resolveAutoplayInstructionsAnswer,
} from "./autoplayRunner.js";
import {
  maxMovesFromOverrides,
  paceMsFromOverrides,
  resolveAutoplayContextChars,
} from "../nl/autoplayThrottle.js";
import type {
  AutoplayManualPlannerGate,
  AutoplayRunOverrides,
  AutoplayUiSink,
  AutoplayRunPaths,
} from "./autoplayRunner.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type WaitForBrowserEngineGetin = (args: {
  readonly phase: "first" | "continue";
  readonly transcriptSoFar: string;
  readonly gameOutputSinceLastCommand: string;
  readonly step: number;
}) => Promise<ScriptedGetinLine | null>;

export type RunBrowserEngineSessionOptions = {
  readonly waitForEngineGetin: WaitForBrowserEngineGetin;
  readonly manualPlannerGate?: AutoplayManualPlannerGate;
  readonly overrides?: AutoplayRunOverrides;
  /** Shown in session_start SSE (defaults to the active text model id when omitted). */
  readonly sessionProviderId?: string;
};

/**
 * Runs the adventure subprocess; each time the engine blocks for GETIN, {@link waitForEngineGetin}
 * resolves when the browser POSTs a line to the session queue.
 */
export async function runBrowserOrchestratedEngineSession(
  paths: AutoplayRunPaths,
  sink: AutoplayUiSink | undefined,
  options: RunBrowserEngineSessionOptions,
): Promise<void> {
  const { waitForEngineGetin, manualPlannerGate, overrides } = options;
  let movesSent = 0;
  let sessionTranscript = "";

  const pace0 = paceMsFromOverrides(overrides);
  const maxMoves0 = maxMovesFromOverrides(overrides);
  const contextChars = resolveAutoplayContextChars();

  sink?.onSessionStart?.({
    paceMs: pace0,
    maxMoves: maxMoves0,
    contextChars,
    providerId: options.sessionProviderId ?? "browser",
  });

  const nextScriptedLine = async (
    phase: "first" | "continue",
    transcriptSoFar: string,
    gameOutputSinceLastCommand: string,
  ): Promise<ScriptedGetinLine | null> => {
    for (;;) {
      if (
        manualPlannerGate !== undefined &&
        !manualPlannerGate.isPlannerEnabled()
      ) {
        const r = await manualPlannerGate.waitForManualLine();
        if (r === null) return null;
        if (r === AUTOPLAY_RESUME_PLANNER) continue;
        return r;
      }
      return waitForEngineGetin({
        phase,
        transcriptSoFar,
        gameOutputSinceLastCommand,
        step: movesSent,
      });
    }
  };

  await runFortranOpenThenFirstCommand({
    cwd: paths.repoRoot,
    forwardGameOutputToTerminal: sink?.forwardGameOutputToTerminal !== false,
    onGameOutputChunk: (chunk) => {
      sessionTranscript += chunk.toString("utf8");
      sink?.onTranscriptChunk?.(chunk.toString("utf8"), movesSent);
    },
    onAwaitingPlayerInput: (ctx) => {
      sink?.onAwaitingPlayerInput?.({
        phase: ctx.phase,
        transcriptSoFar: ctx.transcriptSoFar,
        gameOutputSinceLastCommand: ctx.gameOutputSinceLastCommand,
        step: movesSent,
      });
    },
    getInstructionsAnswer: async () => resolveAutoplayInstructionsAnswer(),
    getFirstCommandLine: async (ctx) => {
      {
        const paceMs = paceMsFromOverrides(overrides);
        if (paceMs > 0) await sleep(paceMs);
      }
      const scripted = await nextScriptedLine("first", ctx.transcriptSoFar, "");
      if (scripted === null) {
        return interpretedToGetinLine({ primaryToken: "QUIT" });
      }
      movesSent += 1;
      return scripted;
    },
    getContinueLine: async (ctx) => {
      const maxMovesNow = maxMovesFromOverrides(overrides);
      if (movesSent >= maxMovesNow) {
        return null;
      }
      {
        const paceMs = paceMsFromOverrides(overrides);
        if (paceMs > 0) await sleep(paceMs);
      }
      const scripted = await nextScriptedLine(
        "continue",
        sessionTranscript,
        ctx.gameOutputSinceLastCommand,
      );
      if (scripted === null) return null;
      movesSent += 1;
      return scripted;
    },
  });

  sink?.onSessionEnd?.();
}

export type { AutoplayPlannerResponse };
