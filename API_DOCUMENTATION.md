# Adventure language-model autoplay dashboard — HTTP API

The local web server is started with `npm run web` from `adventure-llm/` (or
`make run-autoplay-web` from the repo root). It binds to **127.0.0.1** only.

**Authentication:** none. Do not expose this server to untrusted networks.

**Session lifecycle:** Dashboard state (cookie **`adventure_session`** → in-memory session object, Fortran subprocess, transcript, planner memory, UI-backed settings) exists **only while the `npm run web` process runs**. A server **restart** wipes all sessions; unknown cookie ids are replaced with **new** sessions—there is **no resume** or disk snapshot of game state. Colossal Cave also uses **randomness**, so a “fresh start” is not replay-equivalent to an old run. Optional **`ADVENTURE_LLM_DEBUG=1`** writes **`.cache/llm-sessions/<uuid>.jsonl`** for LLM auditing only, not for restoring a session.

**Autoplay planner (behavior):** By default the server runs the same **`adventure-llm`** autoplay loop as the CLI: session memory, situation candidates, and planner guards. Heuristic **object** / **loot-funnel** cues follow the latest room-description block in the transcript (not the whole tail). See [`docs/architecture/adventure-engine.md`](docs/architecture/adventure-engine.md) and [`docs/decisions/ADR0003-scoped-object-hints-latest-room-block.md`](docs/decisions/ADR0003-scoped-object-hints-latest-room-block.md).

When **`ADVENTURE_LLM_BROWSER_ORCHESTRATED_AUTOPLAY=1`** is set on the server, the dashboard may use **browser-orchestrated** cognition ([`docs/decisions/ADR0005-browser-orchestrated-autoplay-cognition.md`](docs/decisions/ADR0005-browser-orchestrated-autoplay-cognition.md)): the client builds planner context, calls **`POST /api/autoplay-plan`**, and submits GETIN lines via **`POST /api/autoplay-engine-input`** while the server streams game text over SSE. **`GET /api/session`** includes **`browserOrchestratedAutoplay: true`** when that mode is active.

**Subsystem replica sync** ([`docs/decisions/ADR0008-server-subsystem-replica-and-sync.md`](docs/decisions/ADR0008-server-subsystem-replica-and-sync.md)): after establishing a session cookie, the client may **`POST /api/subsystem-sync`** with workspace-scoped revision batches; the server stores a **better-sqlite3** replica (default under `adventure-llm/.cache/subsystem-replica/`, optional env **`ADVENTURE_LLM_SUBSYSTEM_REPLICA_DIR`**). Does not require browser-orchestrated autoplay env.

## Static UI

| Method | Path | Notes                                     |
| ------ | ---- | ----------------------------------------- |
| `GET`  | `/`  | Dashboard (`index.html`)                  |
| `GET`  | `/…` | Other files under `adventure-llm/public/` |

## Server-Sent Events

| Method | Path      | Purpose                                                                       |
| ------ | --------- | ----------------------------------------------------------------------------- |
| `GET`  | `/events` | `text/event-stream`; subscribing starts (or attaches to) one autoplay session |

On connect, the server may emit initial events such as `autoplay_mode`,
`autoplay_settings`, `manual_waiting`, `parser_verbs`, `text_llm`, `mlx_model`,
and `mlx_loading`. Game progress arrives as `transcript_delta`, `turn_end`,
`plan_applied`, `log_line`, etc. When the engine is waiting for scripted input
and the idle hook runs (browser-orchestrated path), the server may emit
**`getin_prompt_ready`** so the client can advance planning without guessing from
raw text alone. Errors use `session_error` with a `message`
string.

Parse SSE lines as usual: events named in `event:` lines, JSON payloads after
`data:`.

### Browser-orchestrated autoplay (optional)

Requires server env **`ADVENTURE_LLM_BROWSER_ORCHESTRATED_AUTOPLAY=1`**. The dashboard loads extra client scripts and uses:

| Method | Path | Purpose |
| ------ | ---- | -------- |
| `GET` | `/api/session` | Returns `{ "ok": true, "browserOrchestratedAutoplay": true \| false }` (and sets session cookie when new). |
| `GET` | `/api/adventure-database` | **200** — `{ "database": … }` serialized from `adventure.dat` for client-side hints. **503** if the dat file is unavailable. |
| `POST` | `/api/autoplay-plan` | Body: `{ "plannerUserPrompt": … }` required; optional `recentGameTextForRepair`, `includeDatHelpInSystem`. **200** — `{ "plan": … }`. Uses the session’s text-model pool. **503** if no text model or dat. |
| `POST` | `/api/autoplay-engine-input` | Body: `{ "getinLine": "EAST …" }` or `{ "endSession": true }`; optional `plan`, `motionGridHint`, `moveNumber` to broadcast `plan_applied`. **404** if browser orchestration is off. |

See [`docs/decisions/ADR0005-browser-orchestrated-autoplay-cognition.md`](docs/decisions/ADR0005-browser-orchestrated-autoplay-cognition.md) and [`docs/architecture/adventure-llm-cognition-and-workspace.md`](docs/architecture/adventure-llm-cognition-and-workspace.md).

## JSON REST routes

All JSON routes accept `Content-Type: application/json` where a body is
required. Responses are JSON unless noted.

### `GET /api/session`

**200** — Session probe and cookie establishment.

```json
{
  "ok": true,
  "browserOrchestratedAutoplay": false
}
```

`browserOrchestratedAutoplay` is **`true`** when the server was started with **`ADVENTURE_LLM_BROWSER_ORCHESTRATED_AUTOPLAY=1`**.

### `POST /api/subsystem-sync`

**200** — Apply a **client-originated** subsystem history batch to the **server replica** for a workspace ([ADR0008](docs/decisions/ADR0008-server-subsystem-replica-and-sync.md)). Requires the same **`adventure_session`** cookie as other `/api/*` routes (call after **`GET /api/session`** if needed).

Body (minimum shape):

```json
{
  "workspaceId": "my-workspace",
  "clientHeadRevisionId": 2,
  "revisions": [
    {
      "id": 2,
      "parentRevisionId": 1,
      "createdAtIso": "2026-04-10T12:00:00.000Z",
      "fileChanges": [{ "path": "subsystem/foo.js", "content": "// …" }]
    }
  ]
}
```

Optional per revision: **`tags`** (`name`, `createdAtIso`, `updatedAtIso`), **`promotions`** (`id`, `kind`, `createdAtIso`, `detailJson`) aligned with the client SQLite schema.

**200** response:

```json
{
  "ok": true,
  "sync": {
    "status": "applied",
    "serverHeadRevisionId": 2,
    "appliedRevisionIds": [2],
    "clientBehindServer": false
  }
}
```

**`sync.status`** is **`applied`** (new rows written), **`noop`** (idempotent retry or no-op; **`clientBehindServer`** may be **`true`** when the batch is empty and the client head is behind the server), or **`fork`** (non-linear history; **`message`** explains the reason). Fork responses are still **HTTP 200** with **`ok: true`** so the client can branch on `sync.status`.

**400** — Invalid body or **`workspaceId`** (must match `[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}`). **500** — Apply failure.

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
  "groups": [
    ["NORTH", "N"],
    ["SOUTH", "S"]
  ]
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

`current` may be `null` when no text model is configured.

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
