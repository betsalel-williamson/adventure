# Evaluating agent behavior

Guidance for **agent researchers** testing LangGraph assist, AG2 handoff, or NL autoplay against Colossal Cave.

## Separate layers in your notes

| Layer | What it is | Label as |
| ----- | ---------- | -------- |
| CRT transcript lines | Fortran oracle output | **World truth** |
| Exploration map, hints | Inferred from visible text | **Draft assistance** |
| Autoplay / probe moves | Script or model-chosen commands | **Assisted play** — say whether scripted, heuristic, or model-backed |
| Cognition / FSM panels | Orchestration diagnostics | **Research chrome** — not player-facing game state |

## Honest run labels

WHEN you share a run THEN you SHALL state:

- Which **backend** produced assistance (LangGraph assist, AG2 stub, NL glue, Ollama model name, …)
- Whether moves were **manual**, **scripted probe**, or **autonomous autoplay**
- That draft maps are **not** oracle truth

IF a run used the **heuristic adapter** (no remote model) THEN say so — do not describe it as LLM play.

## Comparing backends

The webclient can target different assist and agent backends via environment variables while keeping the same visible panels. Maintainer reference: [Developer — webclient dev setup](../../developer/webclient-dev-setup.md).

WHEN AG2 or LangGraph paths differ THEN compare them on the **same transcript** and label each run separately.

## Related workflows

- [Research workflows (langgraph)](../research-workflows.md)
- [SLM configuration](../slm-configuration.md)
- [Features — backend adapters](../../features/webclient/backend-adapters.md)
