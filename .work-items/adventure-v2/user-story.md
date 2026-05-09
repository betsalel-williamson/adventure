# Adventure V2 User Story

## User persona

**Name:** Adventure Benchmark Engineer

**Description:** A developer-researcher who runs repeated text-adventure sessions across the v2 model categories (`SLM`, `LLM`, `API`, `MLX`), compares behavior with reproducible evidence, and needs transparent state/actor traces to debug long-horizon planning failures.

## User story

- **As a** Adventure Benchmark Engineer
- **I want to** run and replay comparable adventure sessions using a new v2 runtime with explicit control-loop and cognition visibility
- **so that** I can evaluate model behavior, diagnose drift between inferred and authoritative state, and improve agent policies with confidence.

## Acceptance criteria (EARS)

- **WHEN** I select two or more model configurations for the same scenario (including `SLM`, `LLM`, `API`, and `MLX` categories) **THEN** I **SHALL** be able to run benchmark sessions with identical runtime contracts and compare outcomes.
- **WHEN** a run reaches any turn boundary **THEN** I **SHALL** be able to replay from a saved checkpoint and inspect what the system believed at that point.
- **WHEN** inferred internal state conflicts with oracle game output **THEN** I **SHALL** see drift/reconcile evidence in the run trace.
- **WHEN** I open the v2 console UI **THEN** I **SHALL** retain a game-like terminal experience while also seeing XState control state and LangGraph node/actor activity.
- **IF** the model emits invalid or unusable actions **THEN** I **SHALL** see deterministic fallback behavior (test/recovery path) and explicit failure telemetry.

## Success metrics (verifiable)

- Primary metric: A run artifact contains checkpoint identifiers, reconcile outcomes, and model config metadata for each turn.
- Secondary metric: The UI can display both console transcript and actor/control trace for the same session ID.
- Secondary metric: Contract tests validate action envelope parsing and reconcile schema handling for both valid and invalid cases.

## Requirement IDs

- **R1**: Model swap benchmark execution.
- **R2**: Deterministic checkpoint and replay support.
- **R3**: Drift-aware reconcile loop against external truth.
- **R4**: Console-first UX with state/actor observability.
- **R5**: Explicit invalid-action handling and recovery telemetry.
