# Exploration map column

The **exploration map column** sits beside the CRT and shows a **draft** Mermaid directed graph of inferred places and compass moves.

## Data flow

1. Client accumulates transcript text from oracle SSE output.
2. Each new line (with bounded context) is sent to `POST /assist/ingest` when the location agent is enabled.
3. `@adventure-v3/map-core` merges **YOU ARE** cues and compass echo lines into a `DirectedMapGraph`.
4. Mermaid serialization renders beside the CRT.

When assist is unreachable, the client falls back to deterministic in-browser merge — still draft, not oracle truth.

## Graph semantics

- **Place evidence** — `YOU ARE …` room description lines
- **Committed edges** — compass echo (for example `> N`) paired with the next `YOU ARE` line
- **Compass tokens** — N, E, S, W, U, D

Updates are **non-blocking** for command input. On errors, show empty or last-good diagram.

## Honest labeling

Map copy describes **draft assistance**. The graph reflects visible transcript inference, not privileged game state.
