# Exploration map

The **exploration map** is the beside-CRT column that renders a **draft** Mermaid directed graph of inferred places and compass moves.

The graph is built from visible transcript cues:

- **YOU ARE** lines become place evidence
- Compass **echo** lines paired with the next **YOU ARE** commit edges (N, E, S, W, U, D)

The map updates in the background via the location agent path (`POST /assist/ingest`). It is **draft assistance** — Fortran remains truth for actual room state.
