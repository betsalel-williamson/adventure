# Public surface

| Area | Role |
| --- | --- |
| Interpret pipeline | Map natural language to GETIN-safe tokens |
| Planner / autoplay | Build prompts from session memory and transcript |
| MCP tools | Glue MCP stdio server and snapshot schemas |
| Fixtures | Interpret eval fixtures for prompt experiments |

Package entry: [`packages/nl-glue/src/`](../../adventure-nl/packages/nl-glue/src/).

ADRs: [ADR0014](../decisions/ADR0014-two-step-nl-glue-package-then-browser.md), [ADR0016](../decisions/ADR0016-cognition-glue-mcp-and-execution-mcp-surfaces.md).
