import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  OracleBridge,
  OracleObservationInput,
  OracleObservationResult
} from "./oracleBridge.js";

export type PersistentFortranOracleOptions = {
  repoRoot: string;
  /** Defaults to `<repoRoot>/adventure`. */
  adventureBinary?: string;
  /** Quiet period before treating oracle output as complete (ms). */
  idleQuietMs?: number;
  /** Safety cap if the game stops emitting (ms). */
  maxWaitMs?: number;
};

const MAX_OUT = 24_000;
const DEFAULT_IDLE_MS = 150;
const DEFAULT_MAX_WAIT_MS = 15_000;

type FortranSession = {
  child: ChildProcess;
  instructionsDeclined: boolean;
};

const stripFortranCrashTail = (text: string): string => {
  let s = text.replace(/\r\n/g, "\n");
  const markers = [
    /\nAt line \d+ of file adventure\.f\b/,
    /\nFortran runtime error:/,
    /\nError termination\. Backtrace:/,
    /\n#\d+\s+0x/
  ];
  for (const re of markers) {
    const i = s.search(re);
    if (i !== -1) {
      s = s.slice(0, i);
    }
  }
  return s.trimEnd();
};

const clip = (text: string): string =>
  text.length > MAX_OUT ? `${text.slice(0, MAX_OUT)}…` : text;

const writeStdin = async (child: ChildProcess, data: string): Promise<void> => {
  const stdin = child.stdin;
  if (!stdin) {
    throw new Error("[fortran-oracle] child has no stdin");
  }
  await new Promise<void>((resolve, reject) => {
    stdin.write(data, "utf8", (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

/**
 * Writes stdin, then collects stdout/stderr until output is idle for `idleQuietMs`
 * or `maxWaitMs` elapses (whichever completes the read first).
 */
const writeAndDrain = async (
  child: ChildProcess,
  stdinPayload: string,
  idleQuietMs: number,
  maxWaitMs: number
): Promise<string> => {
  await writeStdin(child, stdinPayload);

  let buffer = "";
  let idleTimer: NodeJS.Timeout | undefined;
  let settled = false;

  const stdout = child.stdout;
  const stderr = child.stderr;

  return await new Promise((resolve, reject) => {
    let maxTimer: NodeJS.Timeout;

    const cleanup = () => {
      if (idleTimer !== undefined) {
        clearTimeout(idleTimer);
      }
      clearTimeout(maxTimer);
      stdout?.removeListener("data", onData);
      stderr?.removeListener("data", onData);
      child.removeListener("exit", onExit);
    };

    const finish = (value: string) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(value);
    };

    const fail = (err: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(err);
    };

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      if (idleTimer !== undefined) {
        clearTimeout(idleTimer);
      }
      idleTimer = setTimeout(() => finish(buffer), idleQuietMs);
    };

    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      fail(new Error(`fortran exited (code=${code}, signal=${signal})`));
    };

    maxTimer = setTimeout(() => finish(buffer), maxWaitMs);

    stdout?.on("data", onData);
    stderr?.on("data", onData);
    child.once("exit", onExit);

    idleTimer = setTimeout(() => finish(buffer), idleQuietMs);
  });
};

const spawnFortranSession = (binary: string, cwd: string): FortranSession => {
  const child = spawn(binary, [], {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
    shell: false
  });
  return { child, instructionsDeclined: false };
};

/**
 * One long-lived `adventure` process per `runId`. stdin receives `n` once (decline
 * instructions), then successive parser lines only — matching interactive play and
 * avoiding per-turn process restart (which replayed INIT / reset inventory).
 */
export const createPersistentFortranOracleBridge = (
  options: PersistentFortranOracleOptions
): OracleBridge => {
  const bin = options.adventureBinary ?? join(options.repoRoot, "adventure");
  const idleQuietMs = options.idleQuietMs ?? DEFAULT_IDLE_MS;
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const sessions = new Map<string, FortranSession>();

  return {
    async observe(input: OracleObservationInput): Promise<OracleObservationResult> {
      if (input.forceReject) {
        return {
          rejected: true,
          output: "fortran-oracle: forced reject",
          outcome: "rejected"
        };
      }

      if (!existsSync(bin)) {
        return {
          rejected: true,
          output: `[fortran-oracle] missing binary: ${bin}`,
          outcome: "transport_error"
        };
      }

      let session = sessions.get(input.runId);
      if (!session) {
        session = spawnFortranSession(bin, options.repoRoot);
        sessions.set(input.runId, session);
      }

      const trimmed = input.action.trim();

      if (session.instructionsDeclined && trimmed === "") {
        return { rejected: false, output: "", outcome: "accepted" };
      }

      let stdinPayload: string;
      let markInstructionsDeclinedAfterSuccess = false;
      if (!session.instructionsDeclined) {
        stdinPayload = trimmed === "" ? "n\n" : `n\n${trimmed}\n`;
        markInstructionsDeclinedAfterSuccess = true;
      } else {
        stdinPayload = `${trimmed}\n`;
      }

      try {
        const raw = await writeAndDrain(session.child, stdinPayload, idleQuietMs, maxWaitMs);
        if (markInstructionsDeclinedAfterSuccess) {
          session.instructionsDeclined = true;
        }
        const combined = stripFortranCrashTail(raw);
        const clipped = clip(combined);
        return { rejected: false, output: clipped, outcome: "accepted" };
      } catch (err) {
        sessions.delete(input.runId);
        try {
          session!.child.kill();
        } catch {
          // ignore kill errors
        }
        const msg = err instanceof Error ? err.message : String(err);
        return {
          rejected: true,
          output: `[fortran-oracle] ${msg}`,
          outcome: "transport_error"
        };
      }
    }
  };
};
