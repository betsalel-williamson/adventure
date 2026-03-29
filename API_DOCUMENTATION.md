# AdventureLLM autoplay dashboard — HTTP API

The local web server is started with `npm run web` from `adventure-llm/` (or
`make run-autoplay-web` from the repo root). It binds to **127.0.0.1** only.

**Authentication:** none. Do not expose this server to untrusted networks.

## Static UI

| Method | Path | Notes |
| ------ | ---- | ----- |
| `GET` | `/` | Dashboard (`index.html`) |
| `GET` | `/…` | Other files under `adventure-llm/public/` |

## Server-Sent Events

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/events` | `text/event-stream`; subscribing starts (or attaches to) one autoplay session |

On connect, the server may emit initial events such as `autoplay_mode`,
`autoplay_settings`, `manual_waiting`, `parser_verbs`, `text_llm`, `mlx_model`,
and `mlx_loading`. Game progress arrives as `transcript_delta`, `turn_end`,
`plan_applied`, `log_line`, etc. Errors use `session_error` with a `message`
string.

Parse SSE lines as usual: events named in `event:` lines, JSON payloads after
`data:`.

## JSON REST routes

All JSON routes accept `Content-Type: application/json` where a body is
required. Responses are JSON unless noted.

### `GET /api/autoplay-mode`

**200** — Planner / manual state.

```json
{
  "plannerEnabled": true,
  "waitingForManual": false
}
```

### `POST /api/autoplay-mode`

Body:

```json
{ "plannerEnabled": false }
```

**200** — Same shape as GET. **400** if JSON invalid or `plannerEnabled` not a boolean.

### `GET /api/autoplay-settings`

**200** — Effective pace and move cap for the web session.

```json
{
  "paceMs": 2000,
  "maxMoves": 300
}
```

### `POST /api/autoplay-settings`

Body (both fields optional; omitted fields keep previous override or env default):

```json
{
  "paceMs": 1500,
  "maxMoves": 500
}
```

**200** — Echoes applied `paceMs` and `maxMoves`. **400** for out-of-range values
(`paceMs` 0–3_600_000, `maxMoves` 1–1_000_000).

### `GET /api/parser-verbs`

**200** — Verb synonym groups from `adventure.dat`.

```json
{
  "groups": [["NORTH", "N"], ["SOUTH", "S"]]
}
```

**503** if the database file is unavailable (`{ "error": "…" }`).

### `GET /api/text-llm`

**200** — Configured backends and current provider/model (if any).

```json
{
  "current": { "providerId": "google", "modelId": "gemini-2.5-flash" },
  "backends": [],
  "canSwap": true
}
```

`current` may be `null` when no LLM is configured.

### `POST /api/text-llm`

Hot-swap text backend. Body:

```json
{
  "providerId": "google",
  "modelId": "gemini-2.5-flash"
}
```

`providerId` is one of `mlx`, `http`, `google` (lowercase). **200** returns
`providerId` and `modelId`. **400** / **503** / **500** with `{ "error": "…" }`
on validation or swap failures.

### `GET /api/mlx-model`

**200** — MLX model id and preset list when MLX swapping is relevant.

```json
{
  "canSwap": true,
  "modelId": "mlx-community/gemma-2-2b-it",
  "presets": ["mlx-community/gemma-2-2b-it"]
}
```

### `POST /api/mlx-model`

Body:

```json
{ "modelId": "mlx-community/gemma-2-2b-it" }
```

**200** — `{ "modelId": "…" }`. **400** if `modelId` is unknown or disallowed.

### `POST /api/mlx-model/cancel`

Cancels an in-flight MLX model load. **200** — `{ "ok": true, "cancelled": true }`.
**400** if nothing cancellable.

### `POST /api/manual-command`

Used when the session is waiting for manual input. Body is one of:

```json
{ "endSession": true }
```

```json
{ "getinLine": "EAST     " }
```

```json
{ "natural": "go east" }
```

**200** — `{ "ok": true, "action": "endSession" | "getinLine" | "natural" }`.
**400** / **409** / **503** with `{ "error": "…" }` when not applicable or input invalid.

---

For environment variables and CLI behavior, see
[`adventure-llm/README.md`](adventure-llm/README.md).
