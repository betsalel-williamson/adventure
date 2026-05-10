# Multidisciplinary review session — pending changes (facilitator + outcomes)

**Evidence packet:** [pending-changes-review-evidence.md](pending-changes-review-evidence.md)

## Roles (fill in)

| Role | Name |
| --- | --- |
| Facilitator | |
| Note-taker | |
| Date | |

---

## 1. Product / UX (15–20 min)

- [ ] **Demo A — Synthetic:** `ADV_V2_DISABLE_AUTO_FORTRAN_ORACLE=1` API + v3 shell (`cd adventure-v3 && npm start` or `npm run dev`) — sparse oracle, status strip matches `GET /health`.
- [ ] **Demo B — Fortran:** repo-root `./adventure` built; auto persistent API + v3 — long play without replayed INIT / lost inventory.
- [ ] **Demo C — Scroll:** scroll transcript up; stream oracle lines — no jump unless tail-pinned or after **Send**.

**UX discussion notes**

- Status strip sufficiency vs v2 dev shell:

---

## 2. Architecture (15–20 min)

- [ ] `OracleBridge.observe` may be async; `RunCoordinator` awaits — no external sync-only assumption.
- [ ] Persistent Fortran child per `runId` — process lifetime / leak tradeoff (see **Decisions**).
- [ ] Idle read (`idleQuietMs` / `maxWaitMs`) — acceptable flake profile for dev/CI.

**Architecture notes**

-

---

## 3. Operations / QA (15–20 min)

- [ ] Ports: v3 default **5174** (`adventure-v3` `npm start`); v2 web **5173** — document for muscle memory.
- [ ] `GET /health` when auto-Fortran: `processOracleScript` basename is **`adventure`**, not `oracle-fortran-bridge.mjs`.
- [ ] Failure modes: API down, SSE drop, Fortran exit — what appears in transcript vs status strip.

**Ops notes**

-

---

## 4. Security / abuse (5–10 min)

- [ ] No new public routes; `POST` body cap unchanged (256 KiB).

---

## Decision prompts (recorded outcomes)

These align the repo after review; **edit if the live session chose differently.**

| # | Prompt | Outcome (this pass) |
| --- | --- | --- |
| 1 | **Docs in-merge vs follow-up** | **In-merge:** refresh [`adventure-v2/README.md`](../../adventure-v2/README.md) oracle copy and [slice-01-multidisciplinary-review.md](slice-01-multidisciplinary-review.md) as part of the same change set (this implementation). |
| 2 | **Runaway processes** | **Accept for v1:** no automatic `kill` when a run ends in the browser; children keyed by `runId` may linger until process exit. **Backlog:** explicit teardown or idle GC (see [deferred.md](deferred.md)). |
| 3 | **`GET /health` shape** | **Keep** `processOracleScript` as basename-only for now (`adventure` in persistent mode). **Backlog:** optional `oracleVariant: persistent \| bridge` if operators need machine-readable distinction without parsing banner text. |

---

## Backlog items promoted from review

See [deferred.md](deferred.md) — **“Backlog (pending-changes review)”** section.

## Sign-off (optional)

| Area | Reviewer | OK / follow-up |
| --- | --- | --- |
| UX | | |
| Architecture | | |
| Operations | | |
