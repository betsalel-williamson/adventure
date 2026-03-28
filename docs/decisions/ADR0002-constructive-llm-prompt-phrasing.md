# ADR0002: Constructive phrasing for adventure-llm planner and rules text

## Context

Autoplay and interpret prompts in `adventure-llm` steer small models (e.g. MLX) toward valid GETIN JSON and sensible play. Early drafts leaned on prohibitive language: “do not repeat,” “avoid LOOK,” “not motion,” long lists of dead ends mixed with imperatives. That style correlates with two problems: models overweight the negated action (same failure mode as “don’t think of a pink elephant”), and prompts read like scolding rather than a clear next step. Separately, a numbered **RECENT MOVES** block in the planner user message primed imitation of the last commands and was removed; prompt copy was updated in the same period to favor constructive instructions.

## Decision

1. **Lead with preferred actions** — Use **prefer**, **prioritize**, **try**, **rotate toward**, **lead with Try next**, and concrete examples (e.g. **TAKE**/**GET** + object, **OUT**/**BUILD**) instead of chains of “do not / avoid / unless.”
2. **Keep parser rules accurate without prohibition-first tone** — Shared rules in `adventureNlPrompts.ts` still forbid unsafe patterns (object-only primary, wrong UP sense) but describe the **correct** mapping first (“use TAKE or GET with object in secondary”) and use neutral constraints where a negative is unavoidable (“skip NULL secondaries”).
3. **Session alerts and blocks** — Parser rejection, stagnation, oscillation, and indoor hints tell the model **what to do next** (new primaryToken, fresh GETIN from **Try next** / **EXPLORATION MAP**) rather than only what failed.
4. **Exploration map copy** — “Explored from here” / “Good next options” replaces “no progress / not yet dead” where it improved clarity; graph edge hints for noun-as-primary lines use **`(use TAKE/GET + object)`** instead of **`(not motion)`**.
5. **No turn-by-turn RECENT MOVES list in the planner user body** — Documented here as an aligned choice: constructive state (**AT THIS NODE**, **Try next**, DOT) without a numbered log that biased toward repeating recent primaries (see Consequences).

## Alternatives Considered

- **Keep heavy “don’t” lists** — Rejected: reinforces taboo tokens and recent-command patterns; poor fit for small LMs.
- **Drop all negations** — Rejected: some rules are inherently exclusive (e.g. motion vs phrasal “pick up”); we keep minimal explicit constraints where precision matters.
- **ADR only for RECENT MOVES removal** — Rejected as too narrow; the constructive-phrasing change is the durable policy; log removal is one application.

## Consequences

- **Positive:** Prompts read as actionable checklists; less accidental priming of forbidden tokens; easier to extend with new “prefer X when Y” lines.
- **Negative:** Occasional redundancy between sections (**Try next** vs **EXPLORATION MAP**); longer positive sentences; reviewers must still verify that prohibitive constraints remain where the parser requires them.
- **Operational:** Planner user messages no longer include `### RECENT MOVES` / `## Turn log`; state comes from **AT THIS NODE**, map lines, **CANDIDATES**, and **LOCAL SESSION MAP**.

## Rationale

Instruction-tuned models follow explicit positive goals more reliably than long lists of negations. Aligning copy with that behavior reduces repetitive bad moves and matches the project’s preference for clear, user-facing guidance in code and prompts.

## Status

Accepted.

## References

- [ADR0001-adventure-llm-text-llm-providers.md](./ADR0001-adventure-llm-text-llm-providers.md) — provider and pipeline context for the same package.
- [adventure-llm/src/nl/adventureNlPrompts.ts](../../adventure-llm/src/nl/adventureNlPrompts.ts) — `ADVENTURE_LLM_PARSER_TOKEN_RULES`, MLX system/task blocks, `linesForAutoplayPlannerContextBody`.
- [adventure-llm/src/nl/autoplaySessionMemory.ts](../../adventure-llm/src/nl/autoplaySessionMemory.ts) — planner user assembly, alerts, **CURRENT SESSION** framing (no numbered turn log in planner body).
- [adventure-llm/src/nl/inferredExplorationMap.ts](../../adventure-llm/src/nl/inferredExplorationMap.ts) — `formatPromptLines`, `graphEdgeLabelFromCommand`.
- [guidelines/adventure-llm/autoplay-planner-context.md](../../guidelines/adventure-llm/autoplay-planner-context.md) — autoplay modes and prompt hygiene (if present).
