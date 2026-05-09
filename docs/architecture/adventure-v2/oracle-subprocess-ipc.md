# Adventure v2 — Oracle subprocess IPC

## Purpose

Define how an **external oracle** process implements the same contract as the in-process [`OracleBridge`](../../../adventure-v2/apps/server/src/oracle/oracleBridge.ts) seam used by `RunCoordinator`: one observation per child invocation, mapping to `OracleObservationResult` (`rejected`, `output`).

See also: [contracts-and-actors.md](./contracts-and-actors.md) (oracle observation flow).

## Invocation (server side)

- **No shell:** the server uses `spawnSync` with `{ shell: false }` and an **argv array** (`command` + `args`). Do not pass user input through `sh -c`.
- **stdin:** exactly **one UTF-8 line** (trailing `\n` allowed) containing JSON:

```json
{
  "runId": "<string>",
  "turnId": "<string>",
  "sequence": <number>,
  "action": "<string>",
  "forceReject": <optional boolean>
}
```

Fields mirror `OracleObservationInput` on the bridge.

- **stdout:** exactly **one JSON object** per successful observation, on the **first non-empty line** of stdout (leading/trailing whitespace ignored; extra lines are ignored after the first parsed line).

```json
{
  "rejected": <boolean>,
  "output": "<string>"
}
```

- **stderr:** diagnostic only; on failure paths the server may surface a short stderr prefix in the synthetic `output` string.
- **exit code:** `0` is expected when the child wrote a valid response line. Non-zero exit is treated as **oracle failure** (see below).
- **timeout:** bounded wait (default **10 seconds** unless overridden per adapter). Expired waits are treated as oracle failure.

## Failure mapping (`OracleObservationResult`)

All failures are surfaced as **`rejected: true`** so downstream control/recovery aligns with invalid-action telemetry (requirement **R5**):

| Situation | `rejected` | `output` (stable prefix) |
|-----------|------------|---------------------------|
| Child timeout | `true` | `[oracle-process] timeout after <n>ms` |
| Non-zero exit | `true` | `[oracle-process] exit <code>: <stderr snippet>` |
| Empty/missing stdout line | `true` | `[oracle-process] empty response` |
| stdout not valid JSON for one object | `true` | `[oracle-process] malformed response:` … |
| JSON missing boolean `rejected` or string `output` | `true` | `[oracle-process] malformed response:` … |
| spawn error (e.g. ENOENT) | `true` | `[oracle-process] spawn failed:` … |

## Intentional engine exit vs failure

Non-zero exit, truncated stdout, or missing JSON lines are not always “crash” semantics:

- The Fortran program may exit early from an **instructions/menu path** that ends the process (operator-level class comparable to Ctrl+C), or when stdin closes (EOF). Those outcomes still surface through the **failure mapping** above (`rejected: true`) for requirement **R5** alignment today.
- The [`oracle-fortran-bridge.mjs`](../../../adventure-v2/fixtures/oracle-fortran-bridge.mjs) adapter applies **transitional** heuristics (for example treating some non-zero exits as success when the transcript already looks playable) so CI benchmarks remain usable when `gfortran` returns non-zero after EOF.

**Run Coordinator direction:** persistent oracle absence after such exits should eventually be classified as a **terminal run outcome**, not an indefinite **`test` / `chaos`** loop. A future contract refinement might distinguish **oracle halted** from **rejected** without changing the stdin/stdout shape immediately—see [`contracts-and-actors.md`](./contracts-and-actors.md) and **Oracle process lifecycle** in [`process-view.md`](./process-view.md).

## Activation

1. **Tests / custom servers:** inject `createProcessOracleBridge({ command, args, timeoutMs?, cwd?, env? })` into `RunCoordinator`.
2. **Local dev CLI:** optionally set **`ADV_V2_PROCESS_ORACLE_SCRIPT`** to an absolute path, or to a path relative to the **`adventure-v2` current working directory** when starting `npm run dev:server`. The CLI runs `process.execPath` with that script as the single argv entry (Node executes `.mjs` / `.js` stubs). When unset, the **synthetic** oracle remains the default (zero-config CI and local runs).

**CI:** GitHub Actions runs [`adventure-v2/fixtures/oracle-fortran-bridge.mjs`](../../../adventure-v2/fixtures/oracle-fortran-bridge.mjs) after `make adventure` at the repo root (`npm run test:oracle-fortran` in [`adventure-v2/README.md`](../../../adventure-v2/README.md)). That adapter batches stdin to the Fortran binary (decline instructions + one GETIN line); the engine may exit non-zero when stdin closes—bridge logic treats a substantive transcript as success for benchmark parity (see script comments).

**Local:** benchmarks may opt in via `ADV_V2_PROCESS_ORACLE_SCRIPT`, `createProcessOracleBridge`, or `npm run test:oracle-fortran` after building `./adventure`.
