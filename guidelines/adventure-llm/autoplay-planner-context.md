# Autoplay planner context and guards

## Problem

Autoplay planners (especially small local models) can fixate on repeated commands such as `TAKE` + an object token that appears in the transcript tail only because prior commands echoed it, or because inventory lines repeat object words. Overlong prompts mixing global narrative, indoor heuristics, and large candidate lists also dilute the signal for “what to try next from here.”

## Solution

- **`ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE`** — `explore` (default) localizes the user message: **AT THIS NODE** (place, carrying, dead primaries, try-next, known session exits), a compact **EXPLORATION MAP** block, shorter **LOCAL SESSION MAP** DOT, and exploration-first system/task copy. Set `full` for the previous long “GAME ENGINE STATE + indoor” style.
- **Situational candidates** — Object-class hints are taken from transcript text **after** stripping injected `> …` command lines; objects matching **parsed inventory** are subtracted. With **`exploreFirst`**, motion tokens are ordered before TAKE/object nouns when both appear.
- **Guards** (after JSON finalize) — `avoidRedundantTakeWhenCarrying` substitutes an escape motion when TAKE/GET targets an object already carried; stagnation logic treats repeated null **TAKE**/**GET** like other primaries (TAKE/GET are not in the “ignore map dead” exemption set). Parser-rejection and oscillation guards remain as before.
- **Location hint** — Lines that are clearly “already carrying” inventory replies are excluded from the bottom-up room line scan so they never replace real place text.
- **Web dashboard** — `GET`/`POST` **`/api/autoplay-settings`** stores **pace** and **max moves** on the server; the runner uses **`getPaceMs` / `getMaxMoves`** so values apply **during** autoplay (no reload). The footer **auto-saves** on input (debounced), persists to `localStorage`, and the server emits **`autoplay_settings`** over SSE (including on connect) so tabs stay aligned when the inputs are not focused.

## Impact

Reduces useless `TAKE` loops, keeps planner focus on the current inferred cell, and makes autoplay pacing configurable without editing shell env for every run.

## Takeaways

- Separate **room prose** from **command echoes** when inferring “visible objects” for candidate lists.
- Default **open-ended exploration** in prompts unless `full` mode is explicitly chosen.
- Prefer **deterministic guards** for redundant inventory takes; prompts alone are insufficient for small models.
