# Responsibility

**XState** loop policy ([`controlMachine.ts`](../../adventure-v2/packages/control/src/machine/controlMachine.ts)) over phases **`act`**, **`think`**, **`test`**, **`chaos`**, **`disorder`**, plus **`invalidRouting`** for invalid-action escalation (R5).

Transition events match **`PhaseTransitionWire`** on SSE (`packages/contracts`).
