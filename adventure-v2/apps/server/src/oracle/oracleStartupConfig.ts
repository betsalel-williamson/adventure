import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** `apps/server/src/oracle/` → adventure-v2 workspace root */
const adventureV2Root = resolve(__dirname, "../../../..");
const repoRoot = resolve(adventureV2Root, "..");
const defaultAdventureBinary = join(repoRoot, "adventure");

export type OracleStartupResolution =
  | { kind: "synthetic"; reason: OracleSyntheticReason }
  | {
      kind: "process";
      mode: "bridge_script";
      scriptPath: string;
      reason: "explicit_env";
    }
  | {
      kind: "process";
      mode: "persistent_fortran";
      repoRoot: string;
      adventureBinary: string;
      reason: "auto_fortran";
    };

export type OracleSyntheticReason =
  | "explicit_disable"
  | "explicit_empty"
  | "no_auto_paths";

/**
 * When unset, Vitest sets {@link ADV_V2_DISABLE_AUTO_FORTRAN_ORACLE} so HTTP tests stay on synthetic oracle.
 */
export const ADV_V2_DISABLE_AUTO_FORTRAN_ORACLE_ENV = "ADV_V2_DISABLE_AUTO_FORTRAN_ORACLE";

/**
 * Shared by CLI and `GET /health` so reported oracle mode matches the bridge actually loaded.
 */
export function resolveOracleStartupConfig(): OracleStartupResolution {
  const disableAuto = process.env[ADV_V2_DISABLE_AUTO_FORTRAN_ORACLE_ENV]?.trim() === "1";
  const explicitRaw = process.env.ADV_V2_PROCESS_ORACLE_SCRIPT;

  if (explicitRaw !== undefined) {
    const explicit = explicitRaw.trim();
    if (explicit.length > 0) {
      return {
        kind: "process",
        mode: "bridge_script",
        scriptPath: resolve(explicit),
        reason: "explicit_env"
      };
    }
    return { kind: "synthetic", reason: "explicit_empty" };
  }

  if (disableAuto) {
    return { kind: "synthetic", reason: "explicit_disable" };
  }

  if (existsSync(defaultAdventureBinary)) {
    return {
      kind: "process",
      mode: "persistent_fortran",
      repoRoot,
      adventureBinary: defaultAdventureBinary,
      reason: "auto_fortran"
    };
  }

  return { kind: "synthetic", reason: "no_auto_paths" };
}

/** Body fields for `GET /health` (subset derived from {@link resolveOracleStartupConfig}). */
export const healthOracleWireFields = (): {
  oracleMode: "synthetic" | "process";
  processOracleScript: string | null;
} => {
  const cfg = resolveOracleStartupConfig();
  if (cfg.kind === "process" && cfg.mode === "bridge_script") {
    return { oracleMode: "process", processOracleScript: basename(cfg.scriptPath) };
  }
  if (cfg.kind === "process" && cfg.mode === "persistent_fortran") {
    return { oracleMode: "process", processOracleScript: basename(cfg.adventureBinary) };
  }
  return { oracleMode: "synthetic", processOracleScript: null };
};
