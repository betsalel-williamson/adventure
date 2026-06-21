# CRT shell

The **CRT shell** (`apps/web`) is the primary player surface in adventure-v3.

## Wire protocol

The client connects to adventure-v2:

- `POST /runs` — start a run
- `POST /runs/:id/turns` — submit a parser command
- SSE events — turn output and phase updates

The transcript renders oracle text in an 80×24 viewport. A status strip reports API and oracle health.

## Feature flags (client)

| Flag | Env override | Default |
| --- | --- | --- |
| `explorationMap` | `VITE_V3_EXPLORATION_MAP` | on |
| `locationAgent` | `VITE_V3_LOCATION_AGENT` | on |
| `assistPanels` | `VITE_V3_ASSIST_PANELS` | off |
| `mapProbe` | `VITE_V3_MAP_PROBE` | off |
| `mapInspectors` | `VITE_V3_MAP_INSPECTORS` | off |

Override API origin: `VITE_API_URL`. Override assist origin: `VITE_ASSIST_URL`.

## Design constraint

Command input and room text stay on the hero CRT. Diagram or trace panels are ancillary and feature-flagged — they must not displace readable game output.
