# Adventure V2 Architecture Overview

## 1. Introduction

Adventure v2 is a new monorepo project focused on reproducible agent benchmarking over a text-adventure oracle while preserving a virtual client-side console UX (with style options such as classic and modern) and adding explicit control/cognition observability.

## 2. Business and system context

- Benchmark engineers need side-by-side evidence across local and cloud models.
- The external adventure engine remains the ground-truth world.
- Internal runtime state must support replay, explainability, and drift diagnosis.

Related context:

- `docs/architecture/overview.md`
- `docs/architecture/adventure-engine.md`
- `docs/architecture/adventure-nl-cognition-and-workspace.md`

## 3. Architectural drivers

- Deterministic replay and reproducibility.
- Clear ownership boundaries between truth engine and inferred cognition state.
- Fast experimentation with model/config swapping.
- Console immersion plus machine-readable observability.

### Model/provider categories in scope

- `SLM`: local or compact language-model setups used for rapid iteration.
- `LLM`: larger remote language models used for higher-capability runs.
- `API`: hosted provider integrations exposed behind server-owned contracts.
- `MLX`: on-device local inference path for Apple Silicon model execution.

## 4. Architectural decisions (summary)

- Use `adventure-v2` as a separate project root from `adventure-nl`.
- Keep oracle truth external; model internal state as reconcilable belief.
- Use LangGraph for cognition orchestration and XState for control-loop governance.
- Use shared contracts package as the source of truth for runtime schemas.
- Use a Cucumber-style TDD testing strategy for acceptance-first behavior validation.

## 5. Logical/process/deployment/data references

- Logical view: `docs/architecture/adventure-v2/logical-view.md`
- Process view (actor inventory, actor-lane turn flow, scenario sequence diagrams): `docs/architecture/adventure-v2/process-view.md`
- Data view: `docs/architecture/adventure-v2/data-view.md`
- Security and operations: `docs/architecture/adventure-v2/security-and-ops.md`
- Contracts and actor ownership (with producer/consumer matrix): `docs/architecture/adventure-v2/contracts-and-actors.md`
- Session principal model (no-user baseline, 1:1 session mapping): `docs/architecture/adventure-v2/process-view.md`
- Session transaction semantics (atomicity, ordering, idempotency): `docs/architecture/adventure-v2/process-view.md` and `docs/architecture/adventure-v2/security-and-ops.md`

## 6. Deployment view (high level)

- `apps/web` renders terminal UI and state panels.
- `apps/server` manages run sessions and event streams.
- Shared packages provide contracts, cognition orchestration, and control machine logic.

## 7. References

- `.work-items/adventure-v2/user-story.md`
- `.work-items/adventure-v2/design.md`
- `.work-items/adventure-v2/task.md`
- `docs/architecture/adventure-v2/process-view.md`
- `docs/architecture/adventure-v2/security-and-ops.md`
