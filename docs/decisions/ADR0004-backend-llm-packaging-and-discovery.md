# ADR0004: Backend LLM packaging and discovery API

## Context

### User needs and motivations

- **Prompt experimenters** need the dashboard and future workspace to produce prompts that **actually work** with each connected model (OpenAI-compatible HTTP, Gemini, local MLX/Gemma workers) without manually copying vendor-specific rules into client code.
- **Authors** should think in terms of **what** the model should see (system vs user content, interpret vs planner), not whether JSON schema must be attached as `response_format` or `responseSchema` or merged into one MLX user turn.
- **Operators** need **one source of truth** so behavior matches today’s proven paths (`effectivePlannerSendPayload`, MLX worker merges) and does not drift between “preview” and “real” calls.

### Technical context

Today, semantic prompt text and packaging are intertwined in providers under `adventure-llm/src/nl/providers/`. Moving cognition to the browser requires a **clear boundary**: the client sends **logical** requests; the server applies **provider-specific packaging** only.

## Decision

- Introduce a **logical request** shape (interpret vs planner mode, system/user strings, repair tail references, schema mode identifiers).
- Centralize **packaging** in the Node layer: map logical requests to HTTP/stdio payloads per `TextLlm` provider, reusing existing helpers where they already encode vendor rules.
- Expose **packaging profiles** to the client via an API (e.g. extend `/api/text-llm` or add `/api/llm/packaging`) describing supported logical shapes, JSON schema capabilities, and limits per active `providerId` / `modelId`.

### Discovery payload content (for Monaco / validation before the test gate)

Profiles should include machine-usable constraints so the **workspace** can validate **before** round-tripping to the server:

- **Token / character limits** relevant to packaging (e.g. max repair tail, max merged user body) — numbers tied to the same code paths the packager enforces.
- **JSON schema dialect / subset** each provider accepts (e.g. OpenAI `json_schema` strict vs Gemini schema limitations vs MLX text-only JSON)—so editors do not emit schemas the backend will reject.
- Optional: **enum of supported `schemaMode` ids** referencing server-built schema builders (`interpret`, `planner`, …).

## Alternatives considered

- **Client sends fully formed vendor payloads** — Rejected: duplicates packaging logic in JavaScript, risks drift and security mistakes (schema injection), and duplicates MLX merge rules.
- **Server builds all prompt text end-to-end** — Rejected: conflicts with moving **semantic** assembly (memory, subsystems) to the browser; keeps server restarts and deployment coupling for behavior changes.
- **OpenAPI spec only, no runtime discovery** — Rejected: profiles must track **actual** server capabilities and env (e.g. MLX structured split), not a static file alone.

## Consequences

**Positive**

- Authors and UI can target a **stable logical contract**; vendor churn is isolated in Node.
- Packaging tests can run in Vitest against Node without a browser.

**Negative**

- Two layers to document (logical vs wire); requires clear error messages when a logical request cannot be packaged for the active provider.

## Rationale

Packaging is **integration knowledge** tied to process boundaries and secrets; it belongs on the server. Semantic content is **product behavior** and should evolve in the client subsystem workspace.

## Status

Proposed

## References

- `adventure-llm/src/nl/providers/httpOpenAiCompatibleTextLlm.ts`
- `adventure-llm/src/nl/providers/mlxLmStdioTextLlm.ts`
- `adventure-llm/src/nl/providers/googleGenerativeAiTextLlm.ts`
- `adventure-llm/src/nl/adventureNlPrompts.ts` (`effectivePlannerSendPayload`)
- [ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md) (consumer of logical requests)
