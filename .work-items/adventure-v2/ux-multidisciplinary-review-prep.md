# Multidisciplinary review prep: end-user experience (Adventure v2)

Audience: UX, product, architecture, and operations reviewers. Goal: separate **intended dev-shell behavior** from **gaps versus a v1-style interactive demo** (“pick model, watch agent play, see world output and map”).

Canonical runtime docs: [`adventure-v2/README.md`](../../adventure-v2/README.md).

---

## 1. Environment smoke matrix

Use this to rehearse demos and to debug “nothing looks like Adventure.” All API commands assume **`adventure-v2/`** as the current working directory unless noted.

| Scenario | Start the API | Prerequisites | After one manual **`look`** → **Send** (game terminal `#game-terminal`) | **Stub autoplay** (button: **Stub autoplay**) |
| --- | --- | --- | --- | --- |
| **A — Default (synthetic oracle)** | `npm run dev:server` | None | User echo `> look`, a line `[agent] …` with the proposed action, then oracle text **`OK.`** (synthetic bridge returns fixed acceptance text — see `createSyntheticOracleBridge` in `apps/server/src/oracle/oracleBridge.ts`). Feels sparse versus classic Colossal Cave prose. | Sends up to **10** turns using a fixed cycle: `look`, `north`, `south`, `east`, `west`, `inventory`, then repeats (`stubAutoplayPlanner.ts`). **Not** an LLM; same sparse oracle replies unless Fortran/process oracle is used. |
| **B — Process oracle stub (fixture)** | `ADV_V2_PROCESS_ORACLE_SCRIPT=fixtures/oracle-stub.mjs npm run dev:server` | None | Same structure; oracle **stdout** echoes `stub-echo:<action>` so the game lane shows recognizable stub output tied to the command. Good for proving the subprocess path without Fortran. | Same 10-move stub cycle; oracle lines reflect each injected command. |
| **C — Fortran game binary** | `ADV_V2_PROCESS_ORACLE_SCRIPT=fixtures/oracle-fortran-bridge.mjs npm run dev:server` | From repo root: `make adventure` so `./adventure` exists next to `adventure-v2/` | User echo, `[agent]` proposal, then **real game transcript** from the Fortran process (bridge feeds `n\n<action>\n` — see `oracle-fortran-bridge.mjs`). This is the path that matches “classic terminal Adventure” expectations. | Same stub command cycle; game terminal accumulates real room descriptions and parser feedback over multiple turns. |

**Web shell (all scenarios):** second terminal: `npm run dev:web` (default API `http://127.0.0.1:8787`). Override with `VITE_API_URL=…` if the API port differs.

**If the game terminal stays empty or stale:** confirm the API is running; check browser **raw SSE** panel for `(EventSource error — is the API running?)` in `main.ts`. Confirm **`#run-meta`** shows a **`runId`** after load (session bootstrap calls `POST /runs`).

---

## 2. 90-second demo script

Use this order so observers see **signal before noise**.

| Step | Time | Action | What to say / show |
| --- | --- | --- | --- |
| 1 | 0:00 | Open the dev shell URL (e.g. `http://127.0.0.1:5173`). Wait for loading overlay to clear. | “This is the v2 **dev shell**, not the old v1 UI: it optimizes for wire observability and checkpoints.” |
| 2 | 0:10 | Read **`#run-meta`**: `runId`, `model: SLM / slm-baseline`, `cognitionProfile`. | “Model fields are **metadata today** — the browser hardcodes SLM for `POST /runs`; real model swapping is backlog.” |
| 3 | 0:20 | Type **`look`** → **Send**. | Point at **game terminal**: `>` echo, `[agent]` line, then oracle line. Point at **raw SSE** below: every `turn` / `phase` / `trace` event. |
| 4 | 0:40 | Toggle **Show raw SSE log** off, then on. | “Casual viewers can hide debug noise; engineers turn it on.” |
| 5 | 0:50 | Optional: **Stub autoplay** → watch ~10 moves → **Stop autoplay** if needed. | “This button is a **deterministic command loop**, not an intelligent agent — label and README say **no LLM**.” |
| 6 | 0:55 | Scroll to **agent structure** (Mermaid). | “This is **agent architecture**, not a game map — LangGraph + control machine topology.” |

**Fortran demo variant:** Start scenario **C** from the matrix first, then run steps 2–5 so the game lane shows real room text.

---

## 3. Prioritized UX gaps (vs v1-style expectations)

Ordered by impact on “does this look broken?” for a first-time operator.

| Priority | Gap | User-visible symptom | Code / doc anchor |
| --- | --- | --- | --- |
| **P0** | No in-UI **oracle mode** indicator | Users assume default dev shows “the game”; synthetic oracle only prints **`OK.`** — feels broken. | `createSyntheticOracleBridge`; README Fortran table |
| **P0** | **Stub autoplay** sounds like “AI plays” | Expectation mismatch when commands are cyclic and non-adaptive. | `stubAutoplayPlanner.ts`, **Stub autoplay** button, README |
| **P1** | No **model category / name** controls | Cannot reproduce v1 “try SLM vs LLM” from the shell; run meta shows labels but POST body is fixed. | `createNewRun` in `apps/web/src/main.ts` |
| **P1** | No **explored map** or world visualization | v1 memory includes spatial/map UX; v2 only has agent Mermaid and panels. | Design § console-first + observability; no map feature |
| **P2** | **Raw SSE** defaults to **on** | Debug-first layout overwhelms visitors; obscures the CRT game lane. | `index.html` checkbox default checked |
| **P2** | Many panels without hierarchy | Phase, reconcile, checkpoints, cognition trace all compete for attention before “is the loop alive?” | `index.html` structure |
| **P2** | **Session restore** / offline API | Snapshot restore can show text while SSE is dead — message is easy to miss. | `main.ts` bootstrap + EventSource `onerror` |

---

## 4. Decision prompts for reviewers

Capture answers in meeting notes; these steer the next milestone.

1. **Primary persona for the web shell:** Should the next release optimize for **benchmark operators** (dense SSE, checkpoints, traces — current README stance) or **interactive demonstrators** (minimal panels, rich game transcript, obvious “oracle mode”)?

2. **Default demo story:** Should **local Fortran-backed** runs be the documented **default** happy path for human demos, or should the **synthetic oracle** be upgraded (richer fake prose) so the game lane never looks empty without compiling Fortran?

3. **Model selection UX (when ModelAdapter exists):** Should **`modelCategory` / `modelName`** be chosen only at **run creation** (dialog), **persisted per browser**, or **server-side profile** with the shell only picking a profile id?

---

## 5. Work queue: incremental steps

Use this section to promote work through [`.work-items/planning/plan-queues-index.md`](../planning/plan-queues-index.md) (**Draft** → **Ready** → **Implementing**). Steps are **ordered by dependency**; later coding steps assume **decision prompts (§4)** are answered or explicitly deferred.

| Step | Name | Type | Depends on | Purpose / exit criteria |
| --- | --- | --- | --- | --- |
| **U0** | Prep artifacts complete | Doc | — | This doc §§1–4 are current; links to README and code paths verified. |
| **U1** | Run multidisciplinary review session | Meeting | U0 | Demo script (§2) executed; decision prompts (§4) captured in notes or ADR stub. |
| **U2** | Record outcomes | Doc | U1 | Short **review outcomes** subsection (or link to `slice-17` / ADR) stating persona choice, demo default story, and model UX direction. |
| **U3** | UX copy: oracle mode + stub autoplay | Code | U2 (persona / messaging) | **Done (slice 17):** [`index.html`](../../adventure-v2/apps/web/index.html) intro explains oracle is **server-side**; stub autoplay **`title`** states deterministic / not LLM. |
| **U4** | Default **raw SSE** off for first-time shell | Code | U3 optional | **Done (slice 17):** Checkbox defaults **unchecked**; **[`shellUiPreferences`](../../adventure-v2/apps/web/src/shellUiPreferences.ts)** persists visibility (README notes prefs). |
| **U5** | Empty / loading states for game lane | Code | U2 | **Done (slice 17):** **[`gameTerminalBuffer.ts`](../../adventure-v2/apps/web/src/gameTerminalBuffer.ts)** + Vitest **`gameTerminalBuffer.test.ts`** — placeholder until first **`oracle_observation`** chunk. |
| **U6** | Run configuration UI (`modelCategory`, `modelName`) | Code | U2 + backend | Expose fields in `createNewRun` to match [`RunConfig`](../../adventure-v2/packages/contracts/src/api/run.ts); meaningful only when **ModelAdapter** / routing respects config — coordinate with README **Not yet**. |
| **U7** | Explored map / world viz | Feature | U2 + design | Larger slice; candidate linkage to [`.cursor/plans/graph-style_exploration_map_80518f1c.plan.md`](../../.cursor/plans/graph-style_exploration_map_80518f1c.plan.md) in **Revisit** queue — promote separately. |

**Suggested queue placement**

- After **U1–U2**: promote **U3–U5** as one **Ready** batch (“v2 dev shell clarity”) if decisions favor interactive demonstrators; keep **U6** **Ready** but blocked until model routing exists.
- **U7** stays **Draft** or **Revisit** until map scope is chosen.

**Loop snapshot hint:** When starting **U3**, set planning index **Plan / slice** to something like “post–slice 16 UX shell clarity” and point **Blocking** to any unset decision from §4.

---

## Related technical review

Slice 16 close-out (contracts, tests, security): [`.work-items/adventure-v2/slice-16-multidisciplinary-review.md`](slice-16-multidisciplinary-review.md).
