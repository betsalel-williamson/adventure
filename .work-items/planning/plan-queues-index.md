# Plan queue index (adventure repo)

Track Cursor implementation plans (`*.plan.md`) and related copies under `.work-items/` by lifecycle queue.

- **Inventory** at the bottom is authoritative for “what exists.”
- **Queues** are editable; move rows when status changes. **Finished** entries are a **best-effort audit** — confirm before archiving.

Convention: paths below are repo-relative (`adventure/` root).

---

## Current development loop snapshot

**Keep this row honest when focus changes** (starting a session or closing one). Goal: glance here and always know whether you’re implementing, gated on a human commit, blocked, or between plans.

| Field | Value |
|--------|--------|
| **Loop state** | `Implementing` |
| **Plan / slice** | **Slice 3** — HTTP checkpoints + replay: `GET /runs/:id/checkpoints`, `POST /runs/:id/replay` (Cursor plan document: `adventure-v2-slice-3-http-replay`). **Slice 2** shipped: [adventure-v2-slice-2-http-sse](../../.cursor/plans/adventure-v2-slice-2-http-sse_f4a2b91c.plan.md). |
| **Blocking** | none |
| **Next after this** | External oracle subprocess bridge / deeper R4 UI / cognition-control extraction per v2 backlog |

**Process:** Implement **Adventure v2** one increment at a time. **Slice 1** ([minimal milestones](../../.cursor/plans/adventure-v2-minimal-milestones_cba1cb3e.plan.md) M1–M8) and **slice 2** ([HTTP/SSE](../../.cursor/plans/adventure-v2-slice-2-http-sse_f4a2b91c.plan.md)) are **complete** as implemented in-tree; slice 3 extends the wire API.

*Other staffed work:* AAB LangGraph Pivot — **`Implementing`** (see [**Concurrently active**](#concurrently-active-queue)).

*Template when you reset:* set **Loop state** from the vocabulary; **Plan / slice** = `.cursor/plans/*.plan.md` + milestone or PR; **Blocking** / **Next after this** explicit.

---

### State vocabulary (development loop)

| State | Meaning | Typical queue placement |
|--------|---------|-------------------------|
| `Drafting` | No Cursor plan file yet; idea or PRD only | **Draft** |
| `Ready` | Planned, prioritized, **not** coding this slice yet | **Ready** |
| `Implementing` | Active Red/Green/Refactor against a plan (or stacked plans if two staffed) | **Concurrently active** |
| `AwaitingHILCommit` | Slice is **green** (tests passing); agent does **not** commit; waiting on human review + commit | **Awaiting commit / HIL** |
| `BetweenPlans` | Nothing staffed; consciously picking next Ready item or reordering queues | Snapshot only — queues unchanged until you promote something |
| `Blocked` | Hard stop named (dependency, decision, upstream); Implementation paused | Note in snapshot **Blocking** column + optionally keep row in Ready with blocker |
| `Paused` | Deferred on purpose with a resume trigger recorded | Often **Ready** + “PAUSED until …”, or **Revisit** |

**Rough flow:** `Ready` → `Implementing` → (`AwaitingHILCommit`) → committed → optionally **Finished** for whole plan **or** back to **Ready** for next slice on same doc.

---

## Awaiting commit / HIL gate

Slices that are **green** and awaiting **human review + version-control commit**. Remove the row once committed (or bump back to Implementing if review requests changes).

- _(vacant)_

---

## Draft queue

**Loop state:** `Drafting` — ideas / PRD **not yet** turned into a Cursor plan file.

- _(vacant)_

---

## Ready queue

**Loop state:** `Ready` — next up once promoted; dependencies clear.

- **AAB** — follow phased delivery in [`.cursor/plans/aab_langgraph_pivot_eb03f964.plan.md`](../../.cursor/plans/aab_langgraph_pivot_eb03f964.plan.md) after world+XState scaffold exists (first todo: `world-xstate-schema`).
- **Adventure v2 (slice 3+)** — active work: checkpoints/replay HTTP (see snapshot). **Slices 1–2** finished (see **Finished**). Optional backlog: oracle bridge, richer UI observability.

---

## Concurrently active queue

**Loop state:** `Implementing`. Explicitly staffed **this cycle** — keep short; if you stall, move snapshot to `Blocked` or `AwaitingHILCommit` and shrink this list accordingly.

- **Adventure v2 — slice 3** (HTTP checkpoints + replay) — no repo-local `.plan.md` copy; see snapshot **Plan / slice** for name.
- [`.cursor/plans/aab_langgraph_pivot_eb03f964.plan.md`](../../.cursor/plans/aab_langgraph_pivot_eb03f964.plan.md) — **AAB LangGraph Pivot**

---

## Finished queue

Shipped / merged / superseded to your satisfaction (**verify** before treating as archival).

- `.cursor/plans/adventure-v2-minimal-milestones_cba1cb3e.plan.md` — Adventure v2 **slice 1**: M1–M8 minimal baseline (harness, contracts, `RunCoordinator`, R1–R5 paths); **superseded by** [adventure-v2-slice-2-http-sse_f4a2b91c.plan.md](../../.cursor/plans/adventure-v2-slice-2-http-sse_f4a2b91c.plan.md)
- [`.cursor/plans/adventure-v2-slice-2-http-sse_f4a2b91c.plan.md`](../../.cursor/plans/adventure-v2-slice-2-http-sse_f4a2b91c.plan.md) — Adventure v2 **slice 2**: HTTP/SSE, oracle bridge seam, Vitest HTTP gate, minimal `apps/web`; **superseded for focus** by slice 3 (checkpoints + replay wire API)
- `.cursor/plans/adventure_v2_docs_scaffold_a6da04d7.plan.md` — Adventure v2 docs scaffold (baseline docs + `adventure-v2/` layout; **follow-on code** tracked under minimal-milestones then slice-2 plans above)
- `.cursor/plans/web_ui_autoplay_dashboard_151128c8.plan.md` — Web UI autoplay dashboard
- `.cursor/plans/web_session_cookies_tls_5a486f40.plan.md` — Web session cookies TLS
- `.cursor/plans/mlx_model_dropdown_761bb9c5.plan.md` — MLX model dropdown
- `.cursor/plans/mlx_dashboard_prompts_e180143a.plan.md` — MLX dashboard prompts
- `.cursor/plans/update_mlx_small_presets_a85844d8.plan.md` — Update MLX small presets
- `.cursor/plans/gemini_autoplay_mode_0c4d50c4.plan.md` — Gemini self-acting mode
- `.cursor/plans/multi-llm_abstraction_104aeca3.plan.md` — Multi-LLM abstraction
- `.cursor/plans/dashboard_modular_testing_276503de.plan.md` — Dashboard modular testing
- `.cursor/plans/compass_order_bias_fix_5d92450e.plan.md` — Compass order bias fix
- `.cursor/plans/graph-style_exploration_map_80518f1c.plan.md` — Graph-style exploration map
- `.cursor/plans/terminal_transcript_mode_45e22b76.plan.md` — Terminal transcript mode
- `.cursor/plans/adventure-llm_specs_tdd_4d7c2af8.plan.md` — adventure-llm specs TDD

---

## Revisit queue

Duplicates, parking lot, tooling debt, unclear completion, optional follow-ups.

- `.cursor/plans/adventure-llm-architecture-review.plan.md` — adventure-llm architecture review _(duplicate?)_
- `.cursor/plans/adventure-llm_architecture_review_06f2e1ee.plan.md` — adventure-llm architecture review _(duplicate?)_
- `.cursor/plans/web-session-cookies-tls.plan.md` — duplicate title vs `web_session_cookies_tls_*.plan.md`; keep one Finished, archive other after diff
- `.cursor/plans/interpret_example_evaluation_ba52b176.plan.md` — Interpret example evaluation _(verify relevance)_
- `.cursor/plans/interpret_prompt_evaluation_review_3746324e.plan.md` — Interpret prompt evaluation review
- `.cursor/plans/mapping_algo_suggestions_d1668ab4.plan.md` — Mapping algo suggestions
- `.cursor/plans/loot-before-exit_prompts_78a67572.plan.md` — Loot-before-exit prompts
- `.cursor/plans/z-axis_motion_clarity_355c0b19.plan.md` — Z-axis motion clarity
- `.cursor/plans/take_keys_spam_analysis_84464a41.plan.md` — Autoplay prompting and exploration
- `.cursor/plans/autoplay_exploration_context_c931dcfd.plan.md` — Autoplay exploration context
- `.cursor/plans/frontend_test_harness_4cffac1b.plan.md` — Frontend test harness _(may be partial / ongoing)_
- `.cursor/plans/review-fixes-task-map_274669c7.plan.md` — review-fixes-task-map _(one-off map)_
- `.cursor/plans/benchmark_profiles_and_runs_acab8b71.plan.md` — Benchmark profiles and runs _(promote toward AAB when extending metrics)_
- `.cursor/plans/glue_as_client_mcp_ea429146.plan.md` — Glue as client MCP _(confirm remaining scope vs done)_
- `.cursor/plans/xstate_nl-glue_actors_7545a629.plan.md` — XState nl-glue actors _(confirm vs current cognition/dashboard work)_
- **Broken symlink:** `.cursor/plans/adventure-llm-task.plan.md` → `.work-items/adventure-llm/task.md` (target **missing**). Repoint to [`.work-items/adventure-nl/task.md`](../adventure-nl/task.md) or restore the old folder layout.

---

## Master inventory — `.cursor/plans/*.plan.md`

Sorted by last modified (**newest first**). Title from plan frontmatter `name:`.

| Modified | File | Title (`name`) |
|---------|------|----------------|
| 2026-05-08 | `adventure-v2-slice-2-http-sse_f4a2b91c.plan.md` | adventure-v2-slice-2-http-sse |
| 2026-05-09 | `adventure-v2-minimal-milestones_cba1cb3e.plan.md` | adventure-v2-minimal-milestones |
| 2026-05-08 | `adventure_v2_docs_scaffold_a6da04d7.plan.md` | Adventure V2 Docs Scaffold |
| 2026-05-08 | `aab_langgraph_pivot_eb03f964.plan.md` | AAB LangGraph Pivot |
| 2026-04-14 | `xstate_nl-glue_actors_7545a629.plan.md` | XState nl-glue actors |
| 2026-04-12 | `review-fixes-task-map_274669c7.plan.md` | review-fixes-task-map |
| 2026-04-12 | `glue_as_client_mcp_ea429146.plan.md` | Glue as client MCP |
| 2026-04-09 | `benchmark_profiles_and_runs_acab8b71.plan.md` | Benchmark profiles and runs |
| 2026-03-29 | `web_session_cookies_tls_5a486f40.plan.md` | Web session cookies TLS |
| 2026-03-29 | `web-session-cookies-tls.plan.md` | Web session cookies TLS |
| 2026-03-28 | `z-axis_motion_clarity_355c0b19.plan.md` | Z-axis motion clarity |
| 2026-03-28 | `web_ui_autoplay_dashboard_151128c8.plan.md` | Web UI autoplay dashboard |
| 2026-03-28 | `update_mlx_small_presets_a85844d8.plan.md` | Update MLX small presets |
| 2026-03-28 | `terminal_transcript_mode_45e22b76.plan.md` | Terminal transcript mode |
| 2026-03-28 | `take_keys_spam_analysis_84464a41.plan.md` | Autoplay prompting and exploration |
| 2026-03-28 | `mlx_model_dropdown_761bb9c5.plan.md` | MLX model dropdown |
| 2026-03-28 | `mapping_algo_suggestions_d1668ab4.plan.md` | Mapping algo suggestions |
| 2026-03-28 | `loot-before-exit_prompts_78a67572.plan.md` | Loot-before-exit prompts |
| 2026-03-28 | `interpret_prompt_evaluation_review_3746324e.plan.md` | Interpret prompt evaluation review |
| 2026-03-28 | `graph-style_exploration_map_80518f1c.plan.md` | Graph-style exploration map |
| 2026-03-28 | `frontend_test_harness_4cffac1b.plan.md` | Frontend test harness |
| 2026-03-28 | `dashboard_modular_testing_276503de.plan.md` | Dashboard modular testing |
| 2026-03-28 | `compass_order_bias_fix_5d92450e.plan.md` | Compass order bias fix |
| 2026-03-28 | `autoplay_exploration_context_c931dcfd.plan.md` | Autoplay exploration context |
| 2026-03-27 | `adventure-llm_architecture_review_06f2e1ee.plan.md` | adventure-llm architecture review |
| 2026-03-27 | `adventure-llm-architecture-review.plan.md` | adventure-llm architecture review |
| 2026-03-25 | `interpret_example_evaluation_ba52b176.plan.md` | Interpret example evaluation |
| 2026-03-22 | `multi-llm_abstraction_104aeca3.plan.md` | Multi-LLM abstraction |
| 2026-03-22 | `mlx_dashboard_prompts_e180143a.plan.md` | MLX dashboard prompts |
| 2026-03-22 | `gemini_autoplay_mode_0c4d50c4.plan.md` | Gemini self-acting mode |
| 2026-03-22 | `adventure-llm_specs_tdd_4d7c2af8.plan.md` | adventure-llm specs TDD |

Not listed above (broken symlink — not a readable plan file):

- `adventure-llm-task.plan.md` → `../../.work-items/adventure-llm/task.md` (**target missing**)

---

## Other plan-like files

- `.work-items/adventure-nl/adventure-nl_specs_tdd_4d7c2af8.plan.md` — copy/version aligned with specs TDD; keep consistent with Finished entry above.
