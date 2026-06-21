# nl-glue — package README

## Overview

`@adventure-nl/nl-glue` packages shared **interpret**, **planner**, and vocabulary glue used by the NL CLI, autoplay dashboard, and MCP tools.

Browser and Node paths share prompt packaging constants and eval fixtures where applicable.

## Public surface

| Area               | Role                                             |
| ------------------ | ------------------------------------------------ |
| Interpret pipeline | Map natural language to GETIN-safe tokens        |
| Planner / autoplay | Build prompts from session memory and transcript |
| MCP tools          | Glue MCP stdio server and snapshot schemas       |
| Fixtures           | Interpret eval fixtures for prompt experiments   |

Package entry: [`packages/nl-glue/src/`](src).

ADRs: [ADR0014](../../../docs/decisions/ADR0014-two-step-nl-glue-package-then-browser.md), [ADR0016](../../../docs/decisions/ADR0016-cognition-glue-mcp-and-execution-mcp-surfaces.md).

## Testing

From `adventure-nl/`:

```bash
npm test -- packages/nl-glue
```

Also covered indirectly by CLI and dashboard integration tests under `src/cli/` and `src/test/nl-glue/`.
