# Step 07 — Gemini structured NL

## Objective

Map free-form English to `{ primaryToken, secondaryToken? }` with Zod validation and optional live Gemini calls.

## Acceptance criteria

- [x] `InterpretedCommandSchema` + `interpretedToGetinLine`.
- [x] `validateAgainstVocab` guards tokens against `ATAB`.
- [x] `interpretWithGemini` uses JSON response mode + schema (live API optional).

## Test strategy

`src/nl/gemini.test.ts` (offline); manual smoke with `GEMINI_API_KEY`.
