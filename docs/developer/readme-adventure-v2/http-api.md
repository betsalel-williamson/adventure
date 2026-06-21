# HTTP API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness JSON: `status`, `service`, **`oracleMode`**, **`processOracleScript`** |
| `POST` | `/runs` | Body `{ "config": RunConfig }` → `201` `{ runId, config }` |
| `POST` | `/runs/:runId/turns` | Body `{ "input": string, "forceReject"?: boolean }` → `204` |
| `GET` | `/runs/:runId/events` | **SSE**: `turn` / `phase` / `trace` with `SseWireEvent` payloads |
| `GET` | `/runs/:runId/checkpoints` | `200` JSON array of `CheckpointRef` |
| `POST` | `/runs/:runId/replay` | Body `{ "checkpointId": string }` → replay payload or `404` |

`POST` bodies over **256 KiB** return **`413`** `{ "error": "payload_too_large" }`.

`OPTIONS` supported for CORS. Default **`Access-Control-Allow-Origin: *`**. Set **`ADV_V2_CORS_ORIGINS`** (comma-separated) to restrict reflected origins.

One full turn yields **10** SSE wire events (4× `turn`, 4× `trace`, 2× `phase`).
