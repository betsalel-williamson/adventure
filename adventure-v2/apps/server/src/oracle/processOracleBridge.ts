import { spawnSync } from "node:child_process";
import type { OracleObservationOutcome } from "../../../../packages/contracts/src/index.js";
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

const parseOutcome = (rec: Record<string, unknown>, rejected: boolean): OracleObservationOutcome => {
  const raw = rec.outcome;
  if (raw === "accepted" || raw === "rejected" || raw === "transport_error") {
    return raw;
  }
  return rejected ? "rejected" : "accepted";
};

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
    const outcome = parseOutcome(rec, rec.rejected);
    const stderrExcerpt =
      typeof rec.stderrExcerpt === "string" ? rec.stderrExcerpt.slice(0, 120) : undefined;
    return {
      rejected: rec.rejected,
      output: rec.output,
      outcome,
      ...(stderrExcerpt !== undefined && stderrExcerpt.length > 0 ? { stderrExcerpt } : {})
    };
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
          output: `[oracle-process] spawn failed: ${msg}`,
          outcome: "transport_error"
        };
      }

      if (result.error) {
        const errno = result.error as NodeJS.ErrnoException & Error;
        if (errno.code === "ETIMEDOUT") {
          return {
            rejected: true,
            output: `[oracle-process] timeout after ${timeoutMs}ms`,
            outcome: "transport_error"
          };
        }
        return {
          rejected: true,
          output: `[oracle-process] spawn failed: ${errno.message}`,
          outcome: "transport_error"
        };
      }

      const out = result.stdout ?? "";
      const firstNonEmptyLine = out.split(/\r?\n/).find((l) => l.trim().length > 0);

      if (result.status !== 0) {
        return {
          rejected: true,
          output: `[oracle-process] exit ${result.status ?? "unknown"}: ${oneLineSnippet(result.stderr ?? "")}`,
          outcome: "transport_error",
          stderrExcerpt: oneLineSnippet(result.stderr ?? "", 120)
        };
      }

      if (firstNonEmptyLine === undefined) {
        return {
          rejected: true,
          output: "[oracle-process] empty response",
          outcome: "transport_error"
        };
      }

      const parsed = parseResultLine(firstNonEmptyLine);
      if (!parsed) {
        return {
          rejected: true,
          output: `[oracle-process] malformed response: ${oneLineSnippet(firstNonEmptyLine, 120)}`,
          outcome: "transport_error"
        };
      }

      return parsed;
    }
  };
};
