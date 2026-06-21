# Overview

`@adventure-langgraph/map-core` provides **directed graph merge** and **Mermaid serialization** for draft exploration maps.

When the assist server is unreachable, the CRT client falls back to deterministic merge in this package so the map column can still update from transcript cues.

Fortran game state remains authoritative — merged graphs are **draft assistance** only.
