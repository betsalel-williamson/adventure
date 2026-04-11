# ADR0001: adventure-nl TextLlm providers and NL pipeline

## Context

The `adventure-nl` package maps natural language to Colossal Cave GETIN tokens using multiple backends: Google Generative AI (JSON schema), OpenAI-compatible HTTP (`/v1/chat/completions`), and a local MLX worker over stdio. Each path must enforce the same post-conditions (valid ATAB tokens, shared repair heuristics), honor the same prompt-derived context for caching, and remain observable and operable (retries, log size) without leaking unbounded prompt text to disk.

## Decision

1. **Unified post-parse pipeline** — After JSON is parsed and coerced with `coerceLlmJson`, all providers run `finalizeInterpretedCommand` / `finalizeAutoplayPlannerResponse` in `textLlmInterpretPipeline.ts` so vocabulary snapping (`coerceToVocab`) and `repairInterpretedCommand` apply consistently.
2. **Interpret cache keys** — Disk cache entries use `interpretCacheKeyFromBuildOptions`, which hashes schema version (`interpretCacheSchemaVersion` / `ADVENTURE_NL_CACHE_SCHEMA_VERSION`), provider, model, user text, compact/structured layout flags, and the same recent-game tail slice as `recentGameTextSliceForInterpretPrompt`.
3. **Interactive NL session context** — By default, the CLI prepends `AutoplaySessionMemory.buildInteractiveInterpretPrefix` to recent game text so human play sees heuristic state, turn summaries, and situational candidate tokens (`ADVENTURE_NL_INTERACTIVE_SESSION=0` restores the prior thin behavior).
4. **Latency toggle** — `ADVENTURE_NL_FAST_INTERPRET=1` forces interpret few-shot examples off regardless of provider defaults.
5. **HTTP transport** — Failures use `LlmTransportError` with optional `status`. Transient statuses (429, 502, 503, 500) may retry up to `ADVENTURE_NL_HTTP_RETRY_ATTEMPTS` (1–5).
6. **Debug logs** — JSONL records pass through `sanitizeInteractionLogRecord`, truncating long `prompt` / `system` / `user` / `rawJson` fields per `ADVENTURE_NL_DEBUG_MAX_PROMPT_CHARS`.

## Alternatives Considered

- **Provider-specific post-processing** — Rejected: inconsistent tokenizer guarantees between Google and unconstrained MLX/HTTP outputs.
- **Cache keyed only on user text** — Rejected: same line in different rooms reused wrong tokens; repair could not always correct cached primaries.
- **No interactive session block** — Rejected for default UX: autoplay had richer context than human NL; optional opt-out preserves old behavior.

## Consequences

- **Positive:** One behavioral contract for interpret/autoplay across providers; safer caches; better interactive grounding; bounded debug logs; optional HTTP retries.
- **Negative:** Cache miss rate increases when recent text or layout changes; interactive prompts grow slightly (mitigated by caps); HTTP retries add latency on success paths only after failures.

## Rationale

Aligning coercion, repair, cache material, and session context with what the model actually sees reduces subtle provider drift and stale-cache bugs while keeping MLX and HTTP viable without Gemini-only enums.

## Status

Accepted.

## References

- [docs/architecture/adventure-engine.md](../architecture/adventure-engine.md) — package-level logical and process view (kept in sync with this ADR).
- [ADR0003: scoped object hints to latest room block](./ADR0003-scoped-object-hints-latest-room-block.md) — **Items** / **Cand_Obj** / loot funnel scoped to **`getObjectHintScopeText()`** (complements interactive session context from this ADR).
- [guidelines/adventure-nl/autoplay-planner-context.md](../../guidelines/adventure-nl/autoplay-planner-context.md) — autoplay prompt modes (`explore` / `full`), candidate hygiene, object scope, guards, web pace overrides.
- [adventure-nl/src/nl/textLlmContract.ts](../../adventure-nl/src/nl/textLlmContract.ts)
- [adventure-nl/src/nl/textLlmInterpretPipeline.ts](../../adventure-nl/src/nl/textLlmInterpretPipeline.ts)
- [adventure-nl/src/nl/interpretCacheKey.ts](../../adventure-nl/src/nl/interpretCacheKey.ts)
- [adventure-nl/src/nl/interpretDiskCache.ts](../../adventure-nl/src/nl/interpretDiskCache.ts)
- [adventure-nl/src/nl/llmDebug.ts](../../adventure-nl/src/nl/llmDebug.ts) — cache schema version, JSONL sanitization.
- [adventure-nl/src/nl/llmErrors.ts](../../adventure-nl/src/nl/llmErrors.ts) — `LlmTransportError`, fallback classification.
- [adventure-nl/src/nl/autoplaySessionMemory.ts](../../adventure-nl/src/nl/autoplaySessionMemory.ts) — autoplay and interactive session prefix.
- [adventure-nl/src/cli/main.ts](../../adventure-nl/src/cli/main.ts)
- [adventure-nl/.env.example](../../adventure-nl/.env.example)
