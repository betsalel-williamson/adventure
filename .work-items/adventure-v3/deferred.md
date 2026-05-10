# Deferred for v3 “first useful ship”

Work listed here is **explicitly not required** until a stranger can open the shell and **play or watch Adventure without coaching** (see [stories/](stories/)).

## Deferred themes

- LangGraph / XState **on the default demo surface**
- Reconcile, checkpoint, raw SSE, cognition trace **as mandatory chrome**
- Ambiguous **“autoplay”** naming when behavior is scripted or stubbed
- Full **repo split** (`adventure-v3/` package), ADRs, contract copy-forward from v2 — schedule **after** user-visible milestones land or in parallel only if they do not block the CRT path

## Backlog (pending-changes multidisciplinary review)

Promoted from [pending-changes-review-session-notes.md](pending-changes-review-session-notes.md); not required for slice 01 merge.

- **Fortran session teardown:** explicitly end or reap persistent `adventure` children when a run ends or after idle timeout (today processes may linger until server exit).
- **`GET /health` clarity:** optional wire field such as `oracleVariant: persistent | bridge | synthetic` so operators do not infer mode from `processOracleScript` basename alone.
- **Idle oracle read tuning:** expose or document `idleQuietMs` / `maxWaitMs` for slow hosts if truncation flakes appear.

## Navigation

[index.md](index.md) · [epics/index.md](epics/index.md)
