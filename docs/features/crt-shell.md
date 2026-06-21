# CRT shell

The **CRT shell** (`apps/web`) is the primary player surface in adventure-langgraph.

## Wire protocol

The client connects to the adventure-v2 HTTP API — see [`adventure-v2/openapi.yaml`](../../adventure-v2/openapi.yaml).

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
