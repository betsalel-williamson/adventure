# Testing baseline

From each package directory after `npm install`:

```bash
npm test
```

Optional layers (package-specific):

- **Cucumber wire** — `npm run test:cucumber` where documented
- **Fortran oracle** — requires repo-root `./adventure`; run opt-in scripts only when touching oracle wiring
- **Full verify** — some packages expose `npm run verify` (lint + format + tests + build)

CI gates are defined in [`.github/workflows/adventure.yml`](../../.github/workflows/adventure.yml).
