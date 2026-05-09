# Adventure V2 Logical View

## Component map

```mermaid
flowchart LR
  subgraph web [apps_web]
    console[ConsoleView]
    statePanel[StateAndActorPanels]
  end
  subgraph server [apps_server]
    runApi[RunApi]
    eventStream[EventStreamSSE]
    oracleBridge[OracleBridge]
  end
  subgraph contracts [packages_contracts]
    schemas[RuntimeSchemas]
  end
  subgraph cognition [packages_cognition]
    graph[LangGraphOrchestrator]
    reconcile[ReconcileEngine]
  end
  subgraph control [packages_control]
    machine[XStateControlMachine]
  end

  console --> runApi
  runApi --> graph
  graph --> oracleBridge
  oracleBridge --> eventStream
  eventStream --> console
  graph --> reconcile
  reconcile --> machine
  machine --> statePanel
  schemas --> runApi
  schemas --> graph
  schemas --> machine
```

## Responsibilities

- `apps/web`: console transcript, controls, and observability views.
- `apps/server`: ordered run execution, oracle I/O, and stream fanout.
- `packages/contracts`: wire/event/checkpoint/reconcile schemas.
- `packages/cognition`: LangGraph nodes and replay-aware decision pipeline.
- `packages/control`: XState phase policy (`act`, `think`, `test`, `chaos`, `disorder`) and state telemetry.

## Boundary rules

- Oracle output is authoritative for world truth.
- Cognition/control state is inferred and can drift.
- Reconcile updates inferred state without rewriting oracle history.

How **control phases** connect to **game-grounded belief** (rooms, objects, oracle text) is documented in [`game-phase-semantics.md`](./game-phase-semantics.md).

## Runtime behavior

This view shows static structure only. The dynamic interactions between these
components, expressed as actor lanes and per-scenario sequence diagrams, are
documented in [`process-view.md`](./process-view.md):

- Actor inventory and ownership: `process-view.md#actor-inventory`.
- Actor-attributed turn flow: `process-view.md#actor-attributed-turn-flow`.
- Drift, recovery, replay, and session lifecycle flows: `process-view.md#scenario-flows`.
