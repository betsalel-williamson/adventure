# control — package README

## Responsibility

**XState** loop policy ([`controlMachine.ts`](src/machine/controlMachine.ts)) over phases **`act`**, **`think`**, **`test`**, **`chaos`**, **`disorder`**, plus **`invalidRouting`** for invalid-action escalation (R5).

Transition events match **`PhaseTransitionWire`** on SSE (`packages/contracts`).

## Layout

| Path | Role |
| --- | --- |
| `src/machine/` | `createMachine` / `createActor` consumed by **`RunCoordinator`** |

Diagram topology guarded by [`tests/agentDiagrams.test.ts`](../../tests/agentDiagrams.test.ts).
