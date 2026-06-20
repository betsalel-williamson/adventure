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
