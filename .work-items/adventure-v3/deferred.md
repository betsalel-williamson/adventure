# Deferred for v3 “first useful ship”

Work listed here is **explicitly not required** until a stranger can open the shell and **play or watch Adventure without coaching** (see [stories/](stories/)).

## E4 — session awareness and assistance posture (default surface)

[Epic E4](epics/E4-session-awareness-and-agent-surfacing.md) and stories [US-4-1](stories/US-4-1-session-signals-visible.md) through [US-4-3](stories/US-4-3-user-chooses-assistance-posture.md) are **not** part of the **default** exploration-map product surface. Slice-02–04 implementations remain in-repo behind **feature flags** (`VITE_V3_ASSIST_PANELS` and related) for operator regression—not deleted.

## Ancillary panels vs hero CRT

**Orchestration-oriented visuals** (for example state-machine or graph traces) may appear **only** as **optional** panels beside the transcript when flags enable them. They **must not** be **mandatory** chrome or the dominant surface.

The hero **CRT transcript + input** stays primary (see [lessons-from-v2.md](lessons-from-v2.md)).

## Deferred themes

- LangGraph / XState **on the default demo surface** (hero viewport)—remain deferred; **optional depth panels** behind flags and honest labeling
- **Map probe** auto-submit loop on the default surface (flag `VITE_V3_MAP_PROBE` / server `ASSIST_PROBE_ENABLED`)
- Reconcile, checkpoint, raw SSE, cognition trace **as mandatory chrome**
- Ambiguous **“autoplay”** naming when behavior is scripted or stubbed
- Full **repo split** (`adventure-v3/` package), ADRs, contract copy-forward from v2 — schedule **after** user-visible milestones land or in parallel only if they do not block the CRT path
- **Per-node action map** (items, non-move actions, rejects at a place)—separate from the exploration directed graph; see [roadmap-next-features.md](roadmap-next-features.md)

## Backlog (pending-changes multidisciplinary review)

Promoted from [pending-changes-review-session-notes.md](pending-changes-review-session-notes.md); not required for slice 01 merge.

- **Fortran session teardown:** explicitly end or reap persistent `adventure` children when a run ends or after idle timeout (today processes may linger until server exit).
- **`GET /health` clarity:** optional wire field such as `oracleVariant: persistent | bridge | synthetic` so operators do not infer mode from `processOracleScript` basename alone.
- **Idle oracle read tuning:** expose or document `idleQuietMs` / `maxWaitMs` for slow hosts if truncation flakes appear.

## Navigation

[index.md](index.md) · [epics/index.md](epics/index.md)
