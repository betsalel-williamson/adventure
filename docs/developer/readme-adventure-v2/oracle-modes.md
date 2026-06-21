# Oracle modes

See [Fortran oracle](../readme-shards/fortran-oracle.md) for build steps.

| Goal | Command |
| --- | --- |
| Dev with real game text (`./adventure` at repo root) | `make adventure`, then `npm run dev:server` — **persistent** Fortran oracle |
| Dev without Fortran (synthetic `OK.`) | Do not build `./adventure`, or `ADV_V2_DISABLE_AUTO_FORTRAN_ORACLE=1 npm run dev:server` |
| Explicit one-shot bridge script | `ADV_V2_PROCESS_ORACLE_SCRIPT=fixtures/oracle-fortran-bridge.mjs npm run dev:server` |

Verify while API is up:

```bash
curl -sS http://127.0.0.1:8787/health
```

| On disk | Expected `oracleMode` | `processOracleScript` |
| --- | --- | --- |
| `./adventure` exists, auto on, no script env | `"process"` | `"adventure"` |
| `ADV_V2_PROCESS_ORACLE_SCRIPT` set | `"process"` | bridge basename |
| No binary or auto disabled | `"synthetic"` | `null` |

CI: `npm run test:oracle-fortran` after `make adventure`. Default `npm test` excludes Fortran CI test.
