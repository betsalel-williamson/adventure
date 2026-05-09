# adventure-v2 control package

## Responsibility

- **`xstate`** ([`src/machine/controlMachine.ts`](src/machine/controlMachine.ts)): loop policy and operational telemetry over **`act`**, **`think`**, **`test`**, **`chaos`**, **`disorder`**, plus **`invalidRouting`** for invalid-action escalation.
- Transition events match **`PhaseTransitionWire`** on SSE (`packages/contracts`).

## Layout

- `src/machine/` — `createMachine` / `createActor` wiring consumed by **`RunCoordinator`**.
