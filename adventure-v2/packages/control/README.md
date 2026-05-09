# adventure-v2 control package (planned)

## Responsibility

- Implement the XState control machine for loop policy and operational telemetry.
- Coordinate phase routing across `act`, `think`, `test`, `chaos`, and `disorder`.
- Surface transition events for UI and benchmark analytics.

## Initial scaffold targets

- `src/machine/` control machine definitions.
- `src/policy/` transition heuristics and escalation criteria.
- `src/telemetry/` normalized transition event emitters.
