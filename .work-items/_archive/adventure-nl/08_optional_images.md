# Step 08 — Optional location images

## Objective

Cache-friendly helpers for future image generation (feature-flagged; text remains canonical).

## Acceptance criteria

- [x] Stable `locationImageCacheKey`.
- [x] `getOrCreateLocationImage` returns null when disabled.

## Test strategy

`src/images/locationImages.test.ts`.
