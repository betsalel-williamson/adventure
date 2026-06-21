# v3 testing

Test gates for adventure-v3 changes.

## Unit and component tests

```bash
cd adventure-v3
npm test              # all Vitest projects
npm run test:web      # jsdom / apps/web only
```

Vitest projects: **web** (jsdom, `apps/web/**`) and **node** (`packages/**`).

## Wire tests (Cucumber)

Synthetic oracle (no Fortran build required):

```bash
npm run test:cucumber
```

Fortran transcript scenarios (requires `./adventure`):

```bash
make adventure   # repo root
npm run test:cucumber:fortran
```

### Persistent Fortran oracle teardown

When `./adventure` exists, Cucumber hooks use adventure-v2's **persistent Fortran oracle** (`createPersistentFortranOracleBridge`): one long-lived game subprocess per HTTP `runId`. Scenarios can pass while Node still hangs if those children are not killed — CI appears stuck on **Cucumber Fortran transcript** even though steps finished.

The Fortran Cucumber harness must tear down the oracle in its `After` hook via `shutdownOracleBridge` (see `adventure-v3/tests/cucumber/http_hooks.ts`). The bridge implements optional `shutdown()` on `OracleBridge` in `adventure-v2/apps/server/src/oracle/persistentFortranOracleBridge.ts`.

When adding hooks or acceptance tests that start a persistent oracle, always release subprocesses before the process exits. One-shot process oracles (`createProcessOracleBridge`) do not need this — each observation is a short-lived child.

## Full verify gate

Before merge from `adventure-v3/`:

```bash
npm run verify
```

Runs ESLint, Prettier check, unit tests, cucumber wire tests, and production build.

Add `npm run test:cucumber:fortran` when changing oracle or subprocess wiring.

## Documentation gate

When editing mdcp shards under `docs/`:

```bash
cd docs && npm run docs:check
```

Or from repo root: `make docs-check`.
