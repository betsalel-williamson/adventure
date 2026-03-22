import {
  spawn,
  spawnSync,
  type ChildProcess,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { appendInteractionLog } from "../nl/llmDebug.js";

export type SubprocessEngineOptions = {
  /** Directory containing adventure.dat and ./adventure */
  cwd: string;
  /** Path to adventure executable (default: cwd/adventure) */
  adventureBinary?: string;
};

/**
 * Run the Fortran adventure binary with a scripted stdin, return combined stdout+stderr.
 * Normalizes CRLF to LF for comparisons.
 */
export function runFortranScript(
  lines: string[],
  options: SubprocessEngineOptions,
): string {
  const bin = options.adventureBinary ?? path.join(options.cwd, "adventure");
  const input = lines.map((l) => (l.endsWith("\n") ? l : `${l}\n`)).join("");
  const r = spawnSync(bin, [], {
    cwd: options.cwd,
    input,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  return out.replace(/\r\n/g, "\n");
}

/** Strip timing noise and INIT line for snapshot tests. */
export function normalizeTranscript(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/^ *INIT DONE\n/m, "")
    .trim();
}

/**
 * True if new game output looks like Colossal Cave rejected the last command
 * (adventure.dat RTEXT lines such as 12, 13, 15, 60).
 */
export function transcriptSuggestsCommandRejected(output: string): boolean {
  const u = output.toUpperCase();
  return (
    u.includes("I DON'T UNDERSTAND THAT!") ||
    u.includes("I DON'T KNOW HOW TO APPLY THAT WORD HERE.") ||
    u.includes("SORRY, BUT I AM NOT ALLOWED TO GIVE MORE DETAIL") ||
    u.includes("I DON'T KNOW THAT WORD.")
  );
}

/** One or two GETIN lines: optional automatic retry when the parser rejects the first. */
export type ScriptedGetinLine =
  | string
  | {
      line: string;
      /** Sent once if output after `line` matches {@link transcriptSuggestsCommandRejected}. */
      retryIfRejected?: string;
    };

/** Transcript printed after the last scripted command, for NL context (resolve "them", objects). */
export type ContinueLineContext = {
  gameOutputSinceLastCommand: string;
};

/** Full transcript so far (stdout+stderr) immediately before the first GETIN line. */
export type FirstCommandContext = {
  transcriptSoFar: string;
};

function normalizeScriptedGetin(scripted: ScriptedGetinLine): {
  line: string;
  retryIfRejected?: string;
} {
  if (typeof scripted === "string") return { line: scripted };
  return scripted;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wait until `idleMs` passes with no stdout/stderr data (game finished printing a screen). */
function transcriptByteLength(chunks: Buffer[]): number {
  return Buffer.concat(chunks).length;
}

function transcriptSince(chunks: Buffer[], startByte: number): string {
  return Buffer.concat(chunks).subarray(startByte).toString("utf8");
}

async function writeGetinLine(
  child: ChildProcessWithoutNullStreams,
  line: string,
): Promise<void> {
  const trimmed = line.trimEnd();
  child.stdin.write(trimmed.endsWith("\n") ? trimmed : `${trimmed}\n`);
}

/**
 * Write one GETIN line, wait for output; if the game output looks like a parser
 * rejection and `retryIfRejected` is set, write that line once and wait again.
 */
async function writeScriptedGetinLine(
  child: ChildProcessWithoutNullStreams,
  allChunks: Buffer[],
  scripted: ScriptedGetinLine,
  idleMs: number,
): Promise<void> {
  const { line, retryIfRejected } = normalizeScriptedGetin(scripted);
  const markBefore = transcriptByteLength(allChunks);
  await writeGetinLine(child, line);
  await waitForOutputIdle(child, idleMs);
  if (!retryIfRejected?.trim()) return;
  const newText = transcriptSince(allChunks, markBefore);
  if (!transcriptSuggestsCommandRejected(newText)) return;
  process.stderr.write(
    "adventure-llm: first tokens were rejected; retrying with secondary and primary swapped.\n",
  );
  await appendInteractionLog({
    event: "nl_getin_retry_after_rejection",
    firstLine: line.trimEnd(),
    retryLine: retryIfRejected.trimEnd(),
    matchedOutputTail: newText.slice(-800),
  });
  await writeGetinLine(child, retryIfRejected);
  await waitForOutputIdle(child, idleMs);
}

async function killChildIfRunning(
  child: ChildProcessWithoutNullStreams,
): Promise<void> {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await once(child, "close");
  }
}

async function waitForOutputIdle(
  child: ChildProcess,
  idleMs: number,
): Promise<void> {
  await new Promise<void>((resolve) => {
    let timer: NodeJS.Timeout;
    const finish = () => {
      clearTimeout(timer);
      child.stdout?.off("data", bump);
      child.stderr?.off("data", bump);
      resolve();
    };
    const bump = () => {
      clearTimeout(timer);
      timer = setTimeout(finish, idleMs);
    };
    child.stdout?.on("data", bump);
    child.stderr?.on("data", bump);
    bump();
  });
}

/**
 * Normalize the player's answer to "WOULD YOU LIKE INSTRUCTIONS?" to a single-letter line for GETIN.
 */
export function normalizeInstructionsAnswer(line: string): string {
  const t = line.trim().toLowerCase();
  if (t.startsWith("y")) return "y";
  if (t.startsWith("n")) return "n";
  return (t.slice(0, 1) || "n").toLowerCase();
}

/**
 * Stream the Fortran binary to the terminal: wait for the welcome + instructions question (no stdin yet),
 * then `getInstructionsAnswer` (y/n), then wait for the next screen, then `getFirstCommandLine` (first move).
 * Stdout/stderr are streamed live; the returned string is the full transcript.
 *
 * If `getContinueLine` is set, after the first command we keep stdin open and call it for each further line
 * (plain text to GETIN) until the process exits or it returns `null` (then we SIGTERM). If omitted, we SIGTERM
 * after the first command (used by tests; avoids EOF read errors on stdin close).
 */
export async function runFortranOpenThenFirstCommand(
  options: SubprocessEngineOptions & {
    getInstructionsAnswer: () => Promise<string>;
    getFirstCommandLine: (
      ctx: FirstCommandContext,
    ) => Promise<ScriptedGetinLine>;
    /** Further moves: return a line to send, or `null` to end the session (SIGTERM). */
    getContinueLine?: (
      ctx: ContinueLineContext,
    ) => Promise<ScriptedGetinLine | null>;
  },
): Promise<string> {
  const bin = options.adventureBinary ?? path.join(options.cwd, "adventure");
  const child = spawn(bin, [], {
    cwd: options.cwd,
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  }) as ChildProcessWithoutNullStreams;

  const allChunks: Buffer[] = [];
  const tee = (d: Buffer) => {
    allChunks.push(d);
    process.stdout.write(d);
  };
  child.stdout.on("data", tee);
  child.stderr.on("data", tee);

  try {
    await Promise.race([
      Promise.race([once(child.stdout, "data"), once(child.stderr, "data")]),
      sleep(15_000).then(() => {
        throw new Error("adventure produced no output while starting");
      }),
    ]);
    await waitForOutputIdle(child, 320);

    const rawInstr = await options.getInstructionsAnswer();
    const instrLine = normalizeInstructionsAnswer(rawInstr);
    child.stdin.write(`${instrLine}\n`);

    await waitForOutputIdle(child, 380);

    const transcriptSoFar = Buffer.concat(allChunks)
      .toString("utf8")
      .replace(/\r\n/g, "\n");
    const firstScripted = await options.getFirstCommandLine({
      transcriptSoFar,
    });
    await writeScriptedGetinLine(child, allChunks, firstScripted, 500);

    let outputMark = transcriptByteLength(allChunks);

    if (options.getContinueLine) {
      while (child.exitCode === null && child.signalCode === null) {
        const gameOutputSinceLastCommand = transcriptSince(
          allChunks,
          outputMark,
        );
        const next = await options.getContinueLine({
          gameOutputSinceLastCommand,
        });
        if (next === null) {
          break;
        }
        const norm = normalizeScriptedGetin(next);
        if (norm.line.trimEnd().length === 0) {
          continue;
        }
        await writeScriptedGetinLine(child, allChunks, next, 450);
        outputMark = transcriptByteLength(allChunks);
      }
    }

    await killChildIfRunning(child);

    return Buffer.concat(allChunks).toString("utf8").replace(/\r\n/g, "\n");
  } catch (err) {
    await killChildIfRunning(child);
    throw err;
  }
}
