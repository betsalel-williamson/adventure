# CRT shell

The **CRT shell** (`apps/web`) is the primary player surface in adventure-langgraph.

## Wire protocol

The client connects to adventure-v2:

- `POST /runs` — start a run
- `POST /runs/:id/turns` — submit a parser command
- SSE events — turn output and phase updates

The transcript renders oracle text in an 80×24 viewport. A status strip reports API and oracle health.

## Feature flags (defaults)

| Flag | Default |
| --- | --- |
| `explorationMap` | on |
| `locationAgent` | on |
| `assistPanels` | off |
| `mapProbe` | off |
| `mapInspectors` | off |

Operational overrides (env, `sessionStorage`, probe server flags): [Developer — LangGraph feature flags](../developer/langgraph-feature-flags.md).

Override API origin: `VITE_API_URL`. Override assist origin: `VITE_ASSIST_URL`.

## Design constraint

Command input and room text stay on the hero CRT. Diagram or trace panels are ancillary and feature-flagged — they must not displace readable game output.
