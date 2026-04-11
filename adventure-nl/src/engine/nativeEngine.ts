import {
  runFortranScript,
  type SubprocessEngineOptions,
} from "./subprocessEngine.js";

/**
 * Gameplay engine: the reference implementation runs the Fortran binary for full behavioral parity.
 * The database (`loadDatFile`) supplies text and vocabulary for NL / UX layers.
 */
export class FortranOracleEngine {
  constructor(private readonly options: SubprocessEngineOptions) {}

  /** Scripted stdin lines (each logical user line, without trailing newline). */
  runScript(lines: string[]): string {
    return runFortranScript(lines, this.options);
  }
}

export function createOracleEngine(
  cwd: string,
  adventureBinary?: string,
): FortranOracleEngine {
  return new FortranOracleEngine({ cwd, adventureBinary });
}
