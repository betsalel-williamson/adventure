# Exploration map — Mermaid

The **Mermaid exploration map** is a beside-CRT panel showing a **draft** directed graph of inferred places and compass moves from the visible transcript.

## Data flow

1. Client accumulates transcript text from oracle output.
2. Transcript cues merge into a directed graph (`@adventure-langgraph/map-core`).
3. Mermaid serialization renders beside the CRT.
4. Assist backend (`langgraph`, `ag2`, `local-map-core`, or `mock`) may participate in merge — output remains draft.

When assist is unreachable, the client may fall back to in-browser merge or show last-good diagram.

## Graph semantics

Same as [Exploration map column](../exploration-map-column.md):

- **Place evidence** — `YOU ARE …` lines
- **Committed edges** — compass echo paired with the next `YOU ARE` line
- **Compass tokens** — N, E, S, W, U, D

Copy actions include a **draft / Fortran is truth** disclaimer.

## Feature flag

`explorationMapMermaid` — default **off** in webclient until migrated.

User guide: [Client — reading the exploration map](../../client/webclient/reading-the-exploration-map.md)

Contrast: [Exploration map — 3D grid](exploration-map-grid.md)
