# Fortran oracle

Colossal Cave runs as a **Fortran subprocess** (`./adventure` at repo root). TypeScript packages treat it as the behavioral oracle — game state is never inferred from docs alone.

Build from repository root:

```bash
make adventure
```

| Scenario | Behavior |
| --- | --- |
| `./adventure` exists, no override | **Persistent** Fortran oracle (one process per HTTP run or dashboard session) |
| Binary missing | **Synthetic** oracle (`OK.` responses) for deterministic tests |
| Force synthetic | Set package-specific disable flags (for example `ADV_V2_DISABLE_AUTO_FORTRAN_ORACLE=1` on v2 API) |

See package READMEs for env overrides and health-check fields.
