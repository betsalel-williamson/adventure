import { spawnSync } from "node:child_process";
import type {
  OracleBridge,
  OracleObservationInput,
  OracleObservationResult
} from "./oracleBridge.js";

export type ProcessOracleBridgeOptions = {
  command: string;
  args: readonly string[];
  timeoutMs?: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

const DEFAULT_TIMEOUT_MS = 10_000;

const parseResultLine = (line: string): OracleObservationResult | null => {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const value = JSON.parse(trimmed) as unknown;
    if (typeof value !== "object" || value === null) {
      return null;
    }
    const rec = value as Record<string, unknown>;
    if (typeof rec.rejected !== "boolean" || typeof rec.output !== "string") {
      return null;
    }
    return { rejected: rec.rejected, output: rec.output };
  } catch {
    return null;
  }
};

const oneLineSnippet = (text: string, max = 200): string => {
  const s = text.trim().replace(/\s+/g, " ");
  if (s.length <= max) {
    return s;
  }
  return `${s.slice(0, max)}…`;
};

export const createProcessOracleBridge = (options: ProcessOracleBridgeOptions): OracleBridge => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { command, args, cwd, env } = options;

  return {
    observe(input: OracleObservationInput): OracleObservationResult {
      const payload = JSON.stringify({
        runId: input.runId,
        turnId: input.turnId,
        sequence: input.sequence,
        action: input.action,
        ...(input.forceReject !== undefined ? { forceReject: input.forceReject } : {})
      });

      let result;
      try {
        result = spawnSync(command, [...args], {
          input: `${payload}\n`,
          encoding: "utf8",
          timeout: timeoutMs,
          maxBuffer: 1024 * 1024,
          cwd,
          env: env ? { ...process.env, ...env } : process.env,
          shell: false
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          rejected: true,
          output: `[oracle-process] spawn failed: ${msg}`
        };
      }

      if (result.error) {
        const errno = result.error as NodeJS.ErrnoException & Error;
        if (errno.code === "ETIMEDOUT") {
          return {
            rejected: true,
            output: `[oracle-process] timeout after ${timeoutMs}ms`
          };
        }
        return {
          rejected: true,
          output: `[oracle-process] spawn failed: ${errno.message}`
        };
      }

      const out = result.stdout ?? "";
      const firstNonEmptyLine = out.split(/\r?\n/).find((l) => l.trim().length > 0);

      if (result.status !== 0) {
        return {
          rejected: true,
          output: `[oracle-process] exit ${result.status ?? "unknown"}: ${oneLineSnippet(result.stderr ?? "")}`
        };
      }

      if (firstNonEmptyLine === undefined) {
        return {
          rejected: true,
          output: "[oracle-process] empty response"
        };
      }

      const parsed = parseResultLine(firstNonEmptyLine);
      if (!parsed) {
        return {
          rejected: true,
          output: `[oracle-process] malformed response: ${oneLineSnippet(firstNonEmptyLine, 120)}`
        };
      }

      return parsed;
    }
  };
};
