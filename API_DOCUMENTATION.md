# Adventure NL web dashboard — HTTP API

The local web server is started with `npm run web` from `adventure-nl/` (or
`make run-autoplay-web` from the repo root). It binds to **127.0.0.1** only.

**Thin backend:** The Node process **streams game text** (SSE), **runs the Fortran `adventure` binary**, and (for non-browser flows) **hosts** the text-model pool. **Autoplay planning** is intended to run **entirely in the browser** (Gemini or OpenAI-compatible HTTP); the server exposes **`browserPlanner`** credentials on SSE **`text_llm`** and **`GET /api/text-llm`** so the client can call those APIs **without** `POST /api/nl/planner`. **`POST /api/nl/interpret`** remains **request in → JSON out** for manual NL (free text → scripted GETIN). **`POST /api/nl/planner`** is **legacy/compat** (forward to the pool), not used by default dashboard autoplay. The **client** sends Fortran input via **`POST /api/engine/input`**; **game output** arrives on **`/events`**. Legacy aliases: **`/api/llm/plan`**, **`/api/llm/interpret`**, **`/api/autoplay-plan`**, **`/api/autoplay-engine-input`**, **`/api/manual-command`**.

**`adventure-nl` / `ADVENTURE_NL_*`:** **NL** is **natural language** (the TypeScript layer that maps player text to game commands and related cognition). **`ADVENTURE_NL_*`** environment variables configure that stack; they are not tied to a single LLM vendor.

**Authentication:** none. Do not expose this server to untrusted networks.

**Session lifecycle:** Dashboard state (cookie **`adventure_session`** → in-memory session object, Fortran subprocess, transcript, planner memory, UI-backed settings) exists **only while the `npm run web` process runs**. A server **restart** wipes all sessions; unknown cookie ids are replaced with **new** sessions—there is **no resume** or disk snapshot of game state. Colossal Cave also uses **randomness**, so a “fresh start” is not replay-equivalent to an old run. Optional **`ADVENTURE_NL_DEBUG=1`** writes **`.cache/llm-sessions/<uuid>.jsonl`** for LLM auditing only, not for restoring a session.

**NL cognition (default):** Unless opted out, **interpretation, session memory updates, planner prompt assembly, guards, scripted GETIN derivation, and autoplay planning (Gemini / HTTP to the configured provider)** run **in the browser** ([`docs/decisions/ADR0005-browser-orchestrated-autoplay-cognition.md`](docs/decisions/ADR0005-browser-orchestrated-autoplay-cognition.md), [`docs/decisions/ADR0014-two-step-nl-glue-package-then-browser.md`](docs/decisions/ADR0014-two-step-nl-glue-package-then-browser.md)). The client loads **`@adventure-nl/nl-glue`**, uses **`browserPlanner`** from **`text_llm` / `GET /api/text-llm`** to plan **without** `POST /api/nl/planner`, then **`POST /api/engine/input`** for GETIN; engine text streams on **`/events`**. **MLX** (server-side stdio worker) cannot drive browser-only planning—use **google** or **http**, or set **`ADVENTURE_NL_BROWSER_ORCHESTRATED_AUTOPLAY=0`** to run the **full** NL loop in **Node**. See [`docs/architecture/adventure-engine.md`](docs/architecture/adventure-engine.md) and [`docs/decisions/ADR0003-scoped-object-hints-latest-room-block.md`](docs/decisions/ADR0003-scoped-object-hints-latest-room-block.md).

**Subsystem replica sync** ([`docs/decisions/ADR0008-server-subsystem-replica-and-sync.md`](docs/decisions/ADR0008-server-subsystem-replica-and-sync.md)): after establishing a session cookie, the client may **`POST /api/subsystem-sync`** with workspace-scoped revision batches; the server stores a **better-sqlite3** replica (default under `adventure-nl/.cache/subsystem-replica/`, optional env **`ADVENTURE_NL_SUBSYSTEM_REPLICA_DIR`**). Independent of the client-vs-server NL flag above.

## Static UI

| Method | Path | Notes                                     |
| ------ | ---- | ----------------------------------------- |
| `GET`  | `/`  | Dashboard (`index.html`)                  |
| `GET`  | `/…` | Other files under `adventure-nl/public/` |

## Server-Sent Events

| Method | Path      | Purpose                                                                       |
| ------ | --------- | ----------------------------------------------------------------------------- |
| `GET`  | `/events` | `text/event-stream`; subscribing starts (or attaches to) one dashboard session (Fortran + transcript stream for that browser client) |

On connect, the server may emit initial events such as `autoplay_mode`,
`autoplay_settings`, `manual_waiting`, `parser_verbs`, `text_llm`, `mlx_model`,
and `mlx_loading`. Game progress arrives as `transcript_delta`, `turn_end`,
`plan_applied`, `log_line`, etc. When the engine is waiting for scripted input
and the idle hook runs (client NL path), the server may emit
**`getin_prompt_ready`** so the client can advance planning without guessing from
raw text alone. Errors use `session_error` with a `message`
string.

Parse SSE lines as usual: events named in `event:` lines, JSON payloads after
`data:`.

### Client-side NL pipeline (default)

**On by default** (env unset): the browser runs **`@adventure-nl/nl-glue`** and **plans** against Gemini or OpenAI-compatible HTTP using **`browserPlanner`** (see **`text_llm`** and **`GET /api/text-llm`**); it does **not** use **`POST /api/nl/planner`** for that path. **`POST /api/nl/planner`** remains a **legacy** forward to the text pool. Set **`ADVENTURE_NL_BROWSER_ORCHESTRATED_AUTOPLAY=0`** to run NL in Node instead. Routes:

| Method | Path | Purpose |
| ------ | ---- | -------- |
| `GET` | `/api/session` | Returns `{ "ok": true, "browserOrchestratedAutoplay": true \| false }` (and sets session cookie when new). When **`true`**, the client is expected to run **NL glue in the browser**—the name reflects historical “browser orchestrated self-acting loop,” not “NL on the server.” |
| `GET` | `/api/adventure-database` | **200** — `{ "database": … }` serialized from `adventure.dat` for client-side hints. **503** if the dat file is unavailable. |
| `GET` | `/api/text-llm` | Current provider/model, backends, packaging; when a **google** or **http** session is active, may include **`browserPlanner`** (e.g. `googleApiKey`, `httpBaseUrl`) for **client-side** autoplay planning (localhost-only server). |
| `POST` | `/api/nl/planner` | **Legacy:** body `{ "plannerUserPrompt": … }` … **200** — `{ "plan": … }`. **503** if no text model or dat. Aliases: **`/api/llm/plan`**, **`/api/autoplay-plan`**. |
| `POST` | `/api/nl/interpret` | Body: `{ "natural": "go east" }`. **200** — `{ "ok": true, "scripted": … }` only. **503** if no text model or dat. Aliases: **`/api/llm/interpret`**. |
| `POST` | `/api/engine/input` | Client sends GETIN here after NL steps; body: `{ "getinLine": … }` or `{ "scripted": … }`, or `{ "endSession": true }`; optional `plan`, `motionGridHint`, `moveNumber` for `plan_applied`. Fortran output on **`/events`**. **404** in some modes. Aliases: **`/api/autoplay-engine-input`**, **`/api/manual-command`** (no **`natural`**—use **`/api/nl/interpret`** first). |

See [`docs/decisions/ADR0005-browser-orchestrated-autoplay-cognition.md`](docs/decisions/ADR0005-browser-orchestrated-autoplay-cognition.md) and [`docs/architecture/adventure-nl-cognition-and-workspace.md`](docs/architecture/adventure-nl-cognition-and-workspace.md).

## JSON REST routes

All JSON routes accept `Content-Type: application/json` where a body is
required. Responses are JSON unless noted.

### `GET /api/session`

**200** — Session probe and cookie establishment.

```json
{
  "ok": true,
  "browserOrchestratedAutoplay": true
}
```

`browserOrchestratedAutoplay` is **`true`** unless the server was started with **`ADVENTURE_NL_BROWSER_ORCHESTRATED_AUTOPLAY`** set to **`0`**, **`false`**, **`no`**, or **`off`**. When **`true`**, natural-language **interpretation and planner-side glue** are **not** intended to run in the dashboard server process; they run in the **browser bundle**.

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
  "canSwap": true,
  "packaging": {},
  "browserPlanner": { "googleApiKey": "…" }
}
```

`current` may be `null` when no text model is configured. **`browserPlanner`** appears for **google** / **http** sessions so the dashboard can run **autoplay planning in the browser** (localhost-only binding; do not expose the server broadly).

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

### `POST /api/engine/input` (aliases: `POST /api/autoplay-engine-input`, `POST /api/manual-command`)

Submit scripted GETIN to the Fortran engine (or end the session). **NL** steps (**`/api/nl/planner`**, **`/api/nl/interpret`**) are **only** JSON in/out; this route is **only** engine I/O; system output is on **`/events`**.

Body examples:

```json
{ "endSession": true }
```

```json
{ "getinLine": "EAST     " }
```

```json
{ "scripted": "EAST     " }
```

**200** — `{ "ok": true, "action": "endSession" | "scripted" | "engineInput" }`.
**400** / **404** / **503** with `{ "error": "…" }` when not applicable or input invalid.

For natural language, call **`POST /api/nl/interpret`** with `{ "natural": "…" }`, then **`POST /api/engine/input`** with `{ "scripted": … }` from the interpret response.

---

For environment variables and CLI behavior, see
[`adventure-nl/README.md`](adventure-nl/README.md).
