import { spawnSync } from "node:child_process";
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
