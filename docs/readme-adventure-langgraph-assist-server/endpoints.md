# Endpoints

### `GET /assist/health`

Liveness check.

### `POST /assist/ingest`

Accepts transcript text (+ optional graph patch). Returns updated `mapJson`, Mermaid, and `suggestedNextMove`. Called by the exploration map column when `locationAgent` is enabled.

### `POST /assist/step`

Merges transcript. With `advance: true` and probe enabled (server `ASSIST_PROBE_ENABLED` + client `mapProbe`), runs LangGraph navigator.

Legacy Assist UI uses this for automated probe steps with **study first** confirmation when enabled.
