# ADR0003: Scope object hints and loot funnel to the latest room-description block

## Context

Autoplay keeps a growing **transcript tail** (`recentRawTail`) that includes multiple room descriptions, injected `> …` command echoes, and carry feedback. Heuristics match **adventure.dat** object-class words (ATAB) against that tail for:

- **`Items`** / **Cand_Obj** in planner prompts
- **`shouldPrioritizeLootFunnel`** (TAKE/GET before travel)
- **`recentTextSuggestsVerticalPassageNavigation`** (surface DOWN/UP ahead of compass)
- Indoor-building motion ordering (`recentTextSuggestsIndoorBuildingNavigation`)

When the **current** room text (what **Loc:** reflects) no longer mentions grate/stream nouns, **older prose still in the tail** could still match **GRATE**, **WATER**, **ROCK**, and similar tokens. The planner then kept choosing **TAKE** + those nouns instead of valid travel such as **DOWN** through the grate, or compass moves in forest rooms.

## Decision

1. **Parse the latest room-description block** using the same bottom-up scan as the planner **location hint**: last line that looks like a game location header (`YOU ARE` / `YOU'RE`, plus a few legacy patterns), then forward through wrapped description lines until a breaker (blank, `>`, another location header, carrying lines, etc.). Implement as **`extractLatestRoomDescriptionBlock`** in **`autoplaySessionMemory.ts`**.
2. **`AutoplaySessionMemory.getObjectHintScopeText()`** — Apply **`stripInjectedCommandLinesForObjectHints`** to that block. If no block is found, use the stripped full tail (preserves prior behavior when headers are missing).
3. **Consumers** use this scope for:
   - **`buildItemsHereLine`** (visible object list for **Items**)
   - **`shouldPrioritizeLootFunnel`** and **`buildSituationalCandidateTokens`** option **`objectHintScopeText`** in **`autoplayRunner`** and **`buildInteractiveInterpretPrefix`**
   - Indoor and loot inputs derived from the same scope as candidates (indoor heuristic uses scoped text; full tail remains available for other prompt sections)
4. **`buildSituationalCandidateTokens`** still receives **`recentGameText`** for backward compatibility; when **`objectHintScopeText`** is non-empty after trim, **object token matching**, **vertical-passage detection**, and **visible-object counts** use the scope instead of the full tail.

## Alternatives Considered

- **Truncate the tail to the last *N* characters** — Rejected: arbitrary cutoffs drop real context or still include the wrong room.
- **Clear object hints on every successful move** — Rejected: does not distinguish “same room, new output” from “new room”; still fragile with multi-line buffers.
- **Rely on the LLM to ignore stale prose** — Rejected: small models and strong **Cand** ordering reliably overrode exploration; deterministic scoping is cheaper and stable.
- **Separate cache of “last room fingerprint” only** — Rejected: duplicates the **Loc** parser and drifts from transcript truth; reusing one block extractor keeps **Loc**, **Items**, and **Cand** aligned.

## Consequences

- **Positive:** **Items** / **Cand_Obj** / loot funnel / vertical cues align with the **current** room header the player last saw; reduces spurious **TAKE** on scenery left in old tail text.
- **Negative:** If a transcript lacks a recognizable location line, behavior falls back to the full stripped tail (same as before), which can still mix rooms until headers appear.
- **Neutral:** Interactive NL **`buildInteractiveInterpretPrefix`** now uses the same **`lootFunnel`** / **`lootFunnelDeferCandMove`** pairing as autoplay for consistent **Cand_Move** deferral.

## Rationale

**Loc** already represented “where we think we are” from the latest block; object and motion heuristics must use the **same narrative slice** so situational candidates do not contradict the location hint.

## Status

Accepted.

## References

- [`adventure-nl/src/nl/autoplaySessionMemory.ts`](../../adventure-nl/src/nl/autoplaySessionMemory.ts) — `extractLatestRoomDescriptionBlock`, `getObjectHintScopeText`, `buildItemsHereLine`, `buildInteractiveInterpretPrefix`.
- [`adventure-nl/src/nl/situationalCandidates.ts`](../../adventure-nl/src/nl/situationalCandidates.ts) — `buildSituationalCandidateTokens` (`objectHintScopeText`), `shouldPrioritizeLootFunnel`, `stripInjectedCommandLinesForObjectHints`.
- [`adventure-nl/src/cli/autoplayRunner.ts`](../../adventure-nl/src/cli/autoplayRunner.ts) — planner call wiring.
- [Guideline: autoplay planner context](../../guidelines/adventure-nl/autoplay-planner-context.md).
- [Architecture: adventure-engine.md](../architecture/adventure-engine.md) — process view for autoplay.
