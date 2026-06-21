# Exploration map — 3D grid

The **3D grid exploration map** is the NL-dashboard visualization: an xyz room grid inferred from glue state rather than a Mermaid directed graph.

## Semantics

Same assistance contract as the Mermaid map — **draft** topology from visible inference, not oracle truth. Different geometry:

| Aspect | Mermaid map | 3D grid |
| ------ | ----------- | ------- |
| Lineage | adventure-langgraph | adventure-nl |
| Layout | Directed flowchart | Spatial grid + room kinds |
| Typical user | Map explorer beside CRT | Agent researcher comparing session shape |

## Feature flag

`explorationMapGrid` — default **off** in webclient until migrated from `adventure-nl/public/mapView.js`.

User guide: [Client — reading the exploration map](../../client/webclient/reading-the-exploration-map.md)

Product counterpart: [Exploration map — Mermaid](exploration-map-mermaid.md)

Source lineage: [NL dashboard lineage](nl-dashboard-lineage.md)
