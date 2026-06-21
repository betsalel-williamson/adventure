# Adventure NL web dashboard — HTTP API

The local web server is started with `npm run web` from `adventure-nl/` (or
`make run-autoplay-web` from the repo root). It binds to **127.0.0.1** only.

**Thin backend:** The Node process **streams game text** (SSE), **runs the Fortran `adventure` binary**, and (for non-browser flows) **hosts** the text-model pool. **Autoplay planning** is intended to run **entirely in the browser** (Gemini or OpenAI-compatible HTTP); the server exposes **`browserPlanner`** credentials on SSE **`text_llm`** and **`GET /api/text-llm`** so the client can call those APIs **without** `POST /api/nl/planner`. **`POST /api/nl/interpret`** remains **request in → JSON out** for manual NL (free text → scripted GETIN). **`POST /api/nl/planner`** is **legacy/compat** (forward to the pool), not used by default dashboard autoplay. The **client** sends Fortran input via **`POST /api/engine/input`**; **game output** arrives on **`/events`**. Legacy aliases: **`/api/llm/plan`**, **`/api/llm/interpret`**, **`/api/autoplay-plan`**, **`/api/autoplay-engine-input`**, **`/api/manual-command`**.

**`adventure-nl` / `ADVENTURE_NL_*`:** **NL** is **natural language** (the TypeScript layer that maps player text to game commands and related cognition). **`ADVENTURE_NL_*`** environment variables configure that stack; they are not tied to a single LLM vendor.

**Authentication:** none. Do not expose this server to untrusted networks.

**Session lifecycle:** Dashboard state (cookie **`adventure_session`** → in-memory session object, Fortran subprocess, transcript, planner memory, UI-backed settings) exists **only while the `npm run web` process runs**. A server **restart** wipes all sessions; unknown cookie ids are replaced with **new** sessions—there is **no resume** or disk snapshot of game state. Colossal Cave also uses **randomness**, so a “fresh start” is not replay-equivalent to an old run. Optional **`ADVENTURE_NL_DEBUG=1`** writes **`.cache/llm-sessions/<uuid>.jsonl`** for LLM auditing only, not for restoring a session.

**NL cognition (default):** Unless opted out, **interpretation, session memory updates, planner prompt assembly, guards, scripted GETIN derivation, and autoplay planning (Gemini / HTTP to the configured provider)** run **in the browser** ([`docs/decisions/ADR0005-browser-orchestrated-autoplay-cognition.md`](docs/decisions/ADR0005-browser-orchestrated-autoplay-cognition.md), [`docs/decisions/ADR0014-two-step-nl-glue-package-then-browser.md`](docs/decisions/ADR0014-two-step-nl-glue-package-then-browser.md)). The client loads **`@adventure-nl/nl-glue`**, uses **`browserPlanner`** from **`text_llm` / `GET /api/text-llm`** to plan **without** `POST /api/nl/planner`, then **`POST /api/engine/input`** for GETIN; engine text streams on **`/events`**. **MLX** (server-side stdio worker) cannot drive browser-only planning—use **google** or **http**, or set **`ADVENTURE_NL_BROWSER_ORCHESTRATED_AUTOPLAY=0`** to run the **full** NL loop in **Node**. See [`docs/architecture/adventure-engine.md`](docs/architecture/adventure-engine.md) and [`docs/decisions/ADR0003-scoped-object-hints-latest-room-block.md`](docs/decisions/ADR0003-scoped-object-hints-latest-room-block.md).

**Subsystem replica sync** ([`docs/decisions/ADR0008-server-subsystem-replica-and-sync.md`](docs/decisions/ADR0008-server-subsystem-replica-and-sync.md)): after establishing a session cookie, the client may **`POST /api/subsystem-sync`** with workspace-scoped revision batches; the server stores a **better-sqlite3** replica (default under `adventure-nl/.cache/subsystem-replica/`, optional env **`ADVENTURE_NL_SUBSYSTEM_REPLICA_DIR`**). Independent of the client-vs-server NL flag above.

## API reference

OpenAPI spec: [`adventure-nl/openapi.yaml`](adventure-nl/openapi.yaml) (default `http://127.0.0.1:8787`; HTTPS when TLS is configured).

Path, method, request/response schemas, and SSE event notes live in the spec. For environment variables and CLI behavior, see [`adventure-nl/README.md`](adventure-nl/README.md).
