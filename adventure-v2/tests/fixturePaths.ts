import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testsDir = dirname(fileURLToPath(import.meta.url));

/** Absolute path to `adventure-v2/fixtures/oracle-stub.mjs` (subprocess oracle stub). */
export const oracleStubPath = join(testsDir, "..", "fixtures", "oracle-stub.mjs");

/** Absolute path to `adventure-v2/fixtures/oracle-fortran-bridge.mjs` (Fortran engine IPC shim). */
export const oracleFortranBridgePath = join(
  testsDir,
  "..",
  "fixtures",
  "oracle-fortran-bridge.mjs"
);

/** Repo root (parent of `adventure-v2/`). */
export const repoRootPath = join(testsDir, "..", "..");
