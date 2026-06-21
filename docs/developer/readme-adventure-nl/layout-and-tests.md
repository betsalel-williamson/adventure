# Layout and tests

| Path | Role |
| --- | --- |
| `src/dat/` | `adventure.dat` loader |
| `src/engine/` | Fortran subprocess oracle |
| `src/cli/` | GETIN tokenizer, web dashboard server |
| `src/nl/` | NL providers, interpret/autoplay pipeline |
| `packages/nl-glue/` | Shared interpret/planner/MCP glue |
| `public/` | Autoplay dashboard ES modules |

```bash
npm test
npm run check   # lint + tsc + tests
```

Module ↔ test map: [`docs/source-map.md`](docs/source-map.md).
