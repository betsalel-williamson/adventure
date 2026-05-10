# Agent project authoring — planning hub

**Entry point** for end-user requirements about **shaping prompts and agent behavior** so an automated player can **play the text adventure**, **explore**, **solve puzzles**, and **learn**—without misleading copy about what is scripted versus adaptive.

Planning is **sharded** (small files) so reviewers can load only what they need—same idea as [Document Sharding Guide](https://docs.bmad-method.org/how-to/shard-large-documents/).

---

## North star

**Let people develop systems of prompts and agentic behaviors** that drive **playing Colossal Cave–style adventure**: **exploring** the world, **solving puzzles**, and **learning** what works—without overstating autonomy or hiding deterministic paths.

User-facing documents here (**persona**, **stories**) describe **observable behavior only**. File formats, parsers, and wire contracts belong in a future **design.md**, not in user stories.

---

## Marketing principles (accuracy, tone, consistency)

| Principle | Meaning |
| --- | --- |
| **Accurate** | Say only what the experience delivers; distinguish **watching the game**, **your agent’s choices**, and **honest labels** for scripted or stubbed paths. |
| **Modern / simple** | Short sentences, plain labels, one primary idea per section when these stories inform UI copy. |
| **Useful** | Every scenario ties to an author **behavior**: configure, run, see results, adjust prompts or policies, repeat. |
| **Consistent** | Shared vocabulary across persona, epics, and stories (modes, run outcomes, failure states). |

**Rule:** User stories **do not** specify stack technology—only what the **author or viewer can see and do**. Implementers use the glossary below and linked technical docs.

---

## Two modes (same product, different primary job)

| Mode | Primary job |
| --- | --- |
| **Play / demo** | Experience the game in the shell—readable transcript, honest status. Aligned with [adventure-v3 overview](../adventure-v3/overview.md). |
| **Author / test project** | Shape **project configuration** (what you defined: prompts, agent behaviors, reactions) and **run** automated play to **learn** what works. |

**Author mode** may foreground orchestration and iteration **without** replacing **Play mode** defaults for casual visitors ([orchestration-before-playability](../../guidelines/adventure-v3/orchestration-before-playability.md): game-first presentation stays the norm for the default shell).

---

## How to read

| Order | Document | What it is |
| --- | --- | --- |
| 1 | [persona.md](persona.md) | Agent builder persona—goals, pains, success |
| 2 | [epics/index.md](epics/index.md) | Authoring epic catalog (AP1–AP3) |
| 3 | [stories/](stories/) | One file per user story (EARS acceptance criteria) |

**Suggested implementation order (author value):** `AP-1-1` → `AP-2-1` → `AP-3-1` → `AP-3-2` (see [stories/index.md](stories/index.md)).

---

## Glossary (reviewers and implementers)

Terms here clarify **planning documents**. They **do not** belong verbatim in user-facing acceptance criteria unless the author would naturally say them.

| Term | Meaning |
| --- | --- |
| **Slice** | A shipping increment (repo Cursor plans / slices)—internal schedule concept. |
| **Epic** | A themed bundle of user stories (v3 uses **E1–E5**; this hub uses **AP1–AP3**). |
| **US-x-x** | User story IDs under [adventure-v3/stories/](../adventure-v3/stories/) (CRT-first product track). |
| **AP-x-x** | User story IDs under [stories/](stories/) (**agent project authoring** track). |
| **Project configuration** | What the author defines (prompts, behaviors, reactions)—**design.md** will specify representation; stories stay behavioral. |

---

## Mental model (author-facing)

```mermaid
flowchart LR
  author[You_shape_prompts_and_agent_behavior]
  player[Automated_player_in_the_game]
  world[Explore_solve_puzzles_learn]
  author --> player
  player --> world
```

---

## Implementer cross-links (technical bounds)

- [adventure-v3 index](../adventure-v3/index.md) — CRT-first milestones, E4/E5 assist context.
- [design-agentic-mvp.md](../adventure-v3/design-agentic-mvp.md) — Assistance boundaries; game remains authority for world truth.
- [orchestration-before-playability.md](../../guidelines/adventure-v3/orchestration-before-playability.md) — Game transcript before orchestration chrome.

**Do not** paste implementation requirements into **AP-*** acceptance criteria unless they appear as **user-visible** outcomes (for example, a clear message when the game is unavailable).

---

## Navigation

[persona.md](persona.md) · [epics/index.md](epics/index.md) · [stories/index.md](stories/index.md)
