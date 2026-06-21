# Reading the exploration map

How to interpret the beside-CRT **exploration map** as a map explorer.

## What the map shows

- **Places** inferred from `YOU ARE …` lines in the transcript you can see
- **Compass moves** (N, E, S, W, U, D) when an echo pairs with a new room description
- Either a **Mermaid flowchart** (langgraph lineage) or a **3D grid** (NL lineage) depending on which panel is enabled

## What the map does not show

- Hidden rooms you have not visited
- Items, puzzles, or inventory unless echoed in transcript text
- Authoritative game state — the **Fortran oracle** remains truth

## When the map updates

While you play with the map panel enabled, the map updates from visible transcript lines without blocking your command input.

If assist or agent services are unreachable, you may see a stale diagram, a locally merged draft, or a status message — keep playing from the CRT transcript when the game API is healthy.

## Honest notes

When you record research results, label map output as **inferred from visible transcript**, not as ground-truth cave topology.

Shared terms: [Exploration map](../../glossary/exploration-map.md) · [Draft assistance](../../glossary/draft-assistance.md)

Related: [Features — exploration map column](../../features/exploration-map-column.md) · [Features — exploration map Mermaid](../../features/webclient/exploration-map-mermaid.md)
