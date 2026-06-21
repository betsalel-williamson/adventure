# Cartographer

The **cartographer** is the LangGraph node (and conceptual role) that merges transcript text into a **directed map graph**.

On the default path, cartographer behavior uses deterministic merge from `@adventure-v3/map-core` (`mergeGraphFromTranscript`). When probe mode is enabled server- and client-side, cartographer participates in the LangGraph pipeline before the navigator step.

Cartographer output is always **draft assistance** — it does not send commands to the Fortran oracle.
