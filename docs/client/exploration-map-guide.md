# Exploration map guide

The beside-CRT **exploration map** helps you see where you have been and which compass moves the transcript supports — as **draft assistance**.

## What the map shows

- **Nodes** — places inferred from `YOU ARE …` lines in the transcript
- **Edges** — committed when a compass echo (for example `> N`) is followed by a new room description
- **Direction labels** — N, E, S, W, U, D

## What the map does not show

- Hidden rooms you have not visited
- Items, puzzles, or inventory (unless echoed in transcript text)
- Authoritative game state — the **Fortran oracle** remains truth

## When the map updates

With **location agent** enabled (default), each relevant transcript line triggers `POST /assist/ingest`. Updates are non-blocking — typing commands is never delayed for map rendering.

## Reading Mermaid output

The column renders a directed flowchart. If assist fails, you may see an empty or stale diagram; keep playing from the CRT transcript.

## Honest research notes

When publishing results, label map output as **inferred from visible transcript**, not as ground-truth cave topology.
