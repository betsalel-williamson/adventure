# Step 06 — Engine façade (parity)

## Objective

Provide a TypeScript `FortranOracleEngine` that delegates simulation to the Fortran binary while keeping all world data in the parsed `adventure.dat` model for LLM context.

## Acceptance criteria

- [x] Oracle engine wraps `runFortranScript`.
- [x] `walkLLineChain` reproduces long text chains for tooling/tests.

## Test strategy

Oracle subprocess test + `src/text/speak.test.ts`.
