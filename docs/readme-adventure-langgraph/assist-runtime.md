# Assist runtime

[`packages/assist-server`](../../adventure-langgraph/packages/assist-server) merges transcript text into a **directed graph** (`@adventure-langgraph/map-core`).

- **`POST /assist/ingest`** — updates the graph from transcript (+ optional patch)
- **`POST /assist/step`** — with `advance: true` runs the LangGraph navigator only when probe is enabled server- and client-side

**Browser → assist URL:** override with **`VITE_ASSIST_URL`** (defaults to `<http://127.0.0.1:8790>`).

**Study first posture** (legacy Assist, when enabled): automated probe steps require the **Study first: confirm next probe step** checkbox before each assist-backed move.

See [Honest labeling](../readme-shards/honest-labeling.md) — heuristic runs are not SLM-backed navigation.

Full product detail: [Assist runtime](../features/assist-runtime.md).
