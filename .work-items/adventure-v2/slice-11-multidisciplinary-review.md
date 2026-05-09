# Slice 11 multidisciplinary review (Adventure v2 — operational readiness)

Date: 2026-05-09

## Review lenses

### Architecture / contracts

- **`GET /health`** is stateless: no `RunCoordinator` calls; suitable for load balancer or process supervisor probes ([`createServer.ts`](../../adventure-v2/apps/server/src/http/createServer.ts)).
- **JSON body cap** applies uniformly to all `readJsonBody` callers (`POST /runs`, `/turns`, `/replay`). Limit is **`HTTP_MAX_JSON_BODY_BYTES`** (256 KiB), enforced while streaming; oversize requests fail before Zod parse.
- **Error shape** for oversize: **`413`** with `{ "error": "payload_too_large", "message": … }`, distinct from **`400`** `bad_request` validation failures.

### Testing / TDD

- Vitest [**`http.acceptance.test.ts`**](../../adventure-v2/tests/http.acceptance.test.ts) covers **`/health`** and **`413`** on oversized `POST /runs`; shares **`HTTP_MAX_JSON_BODY_BYTES`** export from the server package for alignment.
- Cucumber HTTP features unchanged; probes are optional per README (Vitest remains the primary gate).

### Security / safety

- Body limit reduces memory exhaustion from huge `POST` payloads on JSON routes.
- **`/health`** exposes only static metadata (`service` name); no secrets or run IDs.

### UX / documentation

- [**`adventure-v2/README.md`**](../../adventure-v2/README.md): HTTP table, Slice 11 bullet, **`413`** note, refined **Not yet** backlog.

### Operability

- CI unchanged: **`npm test`** then **`npm run test:cucumber`**. No oracle subprocess edits; Fortran oracle job unaffected.

## Issues identified and resolution

| Issue | Resolution |
|--------|------------|
| [**`design.md`**](design.md) §3.1 API table omitted **`/health`** and the **JSON body size limit**, drifting from the canonical README. | Updated §3.1 table and a short **Request limits** line pointing to README. |

## Sign-off

Issues above addressed; run from `adventure-v2/`:

`npm test && npm run test:cucumber`

Oracle subprocess and Fortran bridge paths were not modified; `npm run test:oracle-fortran` not required for Slice 11 verification beyond existing CI.
