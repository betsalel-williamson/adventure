# Lint and tests

- **ESLint:** `npm run lint` — fix with `npm run lint:fix`
- **Prettier:** `npm run format:check` — apply with `npm run format`
- **Unit / component:** `npm test` (Vitest). **`test.projects`**: **`web`** = jsdom for `apps/web/**`; **`node`** for `packages/**`
- **Wire Gherkin (synthetic oracle):** `npm run test:cucumber`
- **Fortran wire scenarios:** requires repo-root `./adventure`; `npm run test:cucumber:fortran`

Suggested regression before merge:

```bash
npm run verify
```

Add `npm run test:cucumber:fortran` when you change oracle/subprocess wiring. For edits inside adventure-v2, also follow that package’s gates.
