#!/usr/bin/env node
/**
 * Subprocess oracle adapter: one JSON line on stdin → one JSON line on stdout.
 * Drives the repo-root Fortran `adventure` binary (same pattern as adventure-nl `runFortranScript`).
 * Protocol: docs/architecture/adventure-v2/oracle-subprocess-ipc.md
 */
import { spawnSync } from "node:child_process";
import * as readline from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const adventureBin = path.join(repoRoot, "adventure");

const TIMEOUT_MS = 12_000;
const MAX_OUT = 24_000;

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.once("line", (line) => {
  let req;
  try {
    req = JSON.parse(line);
  } catch {
    console.log(
      JSON.stringify({
        rejected: true,
        output: "[fortran-oracle] invalid request json"
      })
    );
    process.exit(0);
  }

  const forceReject = Boolean(req.forceReject);
  if (forceReject) {
    console.log(
      JSON.stringify({
        rejected: true,
        output: "fortran-oracle: forced reject"
      })
    );
    process.exit(0);
  }

  if (!existsSync(adventureBin)) {
    console.log(
      JSON.stringify({
        rejected: true,
        output: `[fortran-oracle] missing binary: ${adventureBin}`
      })
    );
    process.exit(0);
  }

  const action = typeof req.action === "string" ? req.action : "";
  const trimmed = action.trim();
  /**
   * Empty action ⇒ stdin is only `n` (decline instructions). That yields INIT / welcome / first room
   * text without a second GETIN — an immediate `look` duplicates “describe location” and triggers the
   * “SORRY, BUT I AM NOT ALLOWED TO GIVE MORE DETAIL…” path on this engine.
   * Non-empty: decline instructions then one parser line (`n\n<verb>\n`).
   */
  const input = trimmed === "" ? `n\n` : `n\n${trimmed}\n`;

  const result = spawnSync(adventureBin, [], {
    cwd: repoRoot,
    input,
    encoding: "utf8",
    timeout: TIMEOUT_MS,
    maxBuffer: 10 * 1024 * 1024,
    shell: false
  });

  if (result.error) {
    const errno = result.error;
    if (errno.code === "ETIMEDOUT") {
      console.log(
        JSON.stringify({
          rejected: true,
          output: `[fortran-oracle] timeout after ${TIMEOUT_MS}ms`
        })
      );
      process.exit(0);
    }
    const msg = errno instanceof Error ? errno.message : String(errno);
    console.log(
      JSON.stringify({
        rejected: true,
        output: `[fortran-oracle] spawn failed: ${msg}`
      })
    );
    process.exit(0);
  }

  const combinedRaw = `${result.stdout ?? ""}${result.stderr ?? ""}`.replace(
    /\r\n/g,
    "\n"
  );

  /** Drop gfortran EOF noise after stdin closes (still happens without a quit line). */
  const stripFortranCrashTail = (text) => {
    let s = text;
    const cutFortran = s.search(/\nAt line \d+ of file adventure\.f\b/);
    if (cutFortran !== -1) {
      s = s.slice(0, cutFortran);
    }
    const cutRt = s.search(/\nFortran runtime error:/);
    if (cutRt !== -1) {
      s = s.slice(0, cutRt);
    }
    const cutBt = s.search(/\nError termination\. Backtrace:/);
    if (cutBt !== -1) {
      s = s.slice(0, cutBt);
    }
    const cutHash = s.search(/\n#\d+\s+0x/);
    if (cutHash !== -1) {
      s = s.slice(0, cutHash);
    }
    return s.trimEnd();
  };

  const combined = stripFortranCrashTail(combinedRaw);
  const clipped =
    combined.length > MAX_OUT ? `${combined.slice(0, MAX_OUT)}…` : combined;

  /** Batch stdin closes before the game loop exits cleanly; gfortran may return non-zero after EOF. */
  const looksLikePlayableTranscript =
    /WELL HOUSE/i.test(combined) ||
    /END OF A ROAD/i.test(combined) ||
    /YOU ARE (STANDING|INSIDE)/i.test(combined);

  if (result.status !== 0 && !looksLikePlayableTranscript) {
    console.log(
      JSON.stringify({
        rejected: true,
        output: `[fortran-oracle] exit ${result.status ?? "unknown"}: ${clipped.slice(0, 800)}`
      })
    );
    process.exit(0);
  }

  console.log(
    JSON.stringify({
      rejected: false,
      output: clipped
    })
  );
  process.exit(0);
});
