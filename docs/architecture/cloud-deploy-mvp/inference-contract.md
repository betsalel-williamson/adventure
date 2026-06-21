# Cloud deploy MVP — inference contract

## Objective

One **stateless** HTTP (and internal relay) shape for all model calls in the MVP: planner, interpret (later), and assist navigator.

Aligns with [ADR0004 logical request](../../decisions/ADR0004-backend-llm-packaging-and-discovery.md) and existing `PlannerUserPromptInput` in `@adventure-nl/nl-glue`.

## Logical request (normative for MVP design)

```json
{
  "requestId": "uuid",
  "mode": "planner | interpret | navigator",
  "system": "string",
  "user": "string",
  "schemaMode": "planner | interpret | null",
  "modelHint": {
    "providerId": "google | http | ollama | mlx",
    "modelId": "optional string"
  }
}
```

| Field | Purpose |
| --- | --- |
| `requestId` | Idempotency and tracing across relay |
| `mode` | Which post-processor and schema apply |
| `system` / `user` | Full prompt split; orchestration already merged context |
| `schemaMode` | Selects JSON schema / repair path (NL planner vs interpret) |
| `modelHint` | Optional; server or desktop picks allowed model |

## Logical response

```json
{
  "requestId": "uuid",
  "ok": true,
  "json": {},
  "text": "optional raw when json parse deferred",
  "providerId": "http",
  "modelId": "llama3.2",
  "durationMs": 1200
}
```

Errors use `ok: false` with `code`, `message`, and no silent fallback to heuristic unless orchestration explicitly requests fallback (assist navigator today falls back in-graph — document as orchestration policy, not inference default).

## Fulfillment backends (MVP)

| Backend | When | Secrets |
| --- | --- | --- |
| **Hosted cloud LLM** | Server env `GEMINI_API_KEY` or HTTP proxy | Server only |
| **Server-local Ollama** | Same VM as assist (demo tier) | None in browser |
| **Paired desktop agent** | Researcher opted in; device online | Ollama/MLX on desktop; keychain device token |

The webclient and orchestration layers **must not** embed vendor keys in production builds.

## HTTP surface (planned)

| Method | Path | Auth |
| --- | --- | --- |
| `POST` | `/inference/plan` | Session principal |
| `POST` | `/inference/navigator` | Session principal |
| `POST` | `/inference/interpret` | Session principal (post-MVP) |
| `GET` | `/inference/capabilities` | Lists paired device + hosted providers for session |

OpenAPI location (implementation issue): propose `adventure-v2/openapi.yaml` extension or new `inference/openapi.yaml` at repo root — decide in inference-contract issue.

## Mapping from today’s code

| Today | MVP mapping |
| --- | --- |
| `SlmAdapter.completeNavigatorMove(transcript, mapJson)` | Orchestration builds `system`+`user`; inference returns `{ move }` JSON |
| `TextLlm.planAutoplay({ plannerUserPrompt })` | Same logical body as `mode: "planner"` |
| `planAutoplayInBrowser` + `browserPlanner` | Replaced by `POST /inference/plan` for hosted UI |
| `createOllamaSlmAdapter` internal prompt | Moves to orchestration or shared prompt builder; adapter becomes thin HTTP client |

## Packaging note

Vendor-specific wire (OpenAI `response_format`, Gemini schema, MLX merge) stays in **packager modules** on the fulfillment side — server packager for hosted API, desktop packager for Ollama. Discovery profiles from ADR0004 remain authoritative for validation UI.

## Previous / next

- Previous: [layers and boundaries](./layers-and-boundaries.md)
- Next: [desktop inference bridge](./desktop-inference-bridge.md)
