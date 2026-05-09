/**
 * Agent structure diagrams for the dev shell (Mermaid).
 * Brain: generated string from LangGraph (see `npm run codegen:brain-mermaid`).
 * Control: hand-maintained; keep in sync with `packages/control/src/machine/controlMachine.ts`.
 */
export { BRAIN_GRAPH_MERMAID } from "./brainGraphMermaid.generated.js";

/** All `ControlPhase` values (wire + machine); test guard uses this list. */
export const CONTROL_PHASE_LABELS = ["act", "think", "test", "chaos", "disorder"] as const;

/** Transient routing state in `createControlMachineLogic` (not a `ControlPhase`). */
export const CONTROL_INVALID_ROUTING_STATE = "invalidRouting";

/**
 * Simplified XState control machine: disorder hub, reconcile branches, invalid routing.
 * Must mention every `ControlPhase` and `invalidRouting` for Vitest alignment checks.
 */
export const CONTROL_MACHINE_MERMAID = `flowchart TB
  act((act))
  think((think))
  test((test))
  chaos((chaos))
  disorder((disorder))
  invalidRouting{{${CONTROL_INVALID_ROUTING_STATE}}}

  act -->|ORACLE_DISPATCHED| disorder
  think -->|ORACLE_DISPATCHED| disorder
  test -->|ORACLE_DISPATCHED| disorder
  chaos -->|ORACLE_DISPATCHED| disorder

  disorder -->|RECONCILE continue| act
  disorder -->|RECONCILE test| test
  disorder -->|RECONCILE chaos| chaos
  disorder -->|INVALID| invalidRouting
  invalidRouting -->|invalidCount > threshold| chaos
  invalidRouting -->|else| test
`;
