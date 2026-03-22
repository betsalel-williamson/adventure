import {
  spawn,
  spawnSync,
  type ChildProcess,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { once } from "node:events";
import path from "node:path";

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wait until `idleMs` passes with no stdout/stderr data (game finished printing a screen). */
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
    getFirstCommandLine: () => Promise<string>;
    /** Further moves: return a line to send, or `null` to end the session (SIGTERM). */
    getContinueLine?: () => Promise<string | null>;
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

  const cmdLine = await options.getFirstCommandLine();
  child.stdin.write(cmdLine.endsWith("\n") ? cmdLine : `${cmdLine}\n`);

  await waitForOutputIdle(child, 500);

  if (options.getContinueLine) {
    while (child.exitCode === null && child.signalCode === null) {
      const next = await options.getContinueLine();
      if (next === null) {
        break;
      }
      const trimmed = next.trimEnd();
      if (trimmed.length === 0) {
        continue;
      }
      child.stdin.write(trimmed.endsWith("\n") ? trimmed : `${trimmed}\n`);
      await waitForOutputIdle(child, 450);
    }
  }

  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await once(child, "close");
  }

  return Buffer.concat(allChunks).toString("utf8").replace(/\r\n/g, "\n");
}
