# adventure-llm

TypeScript tooling for Colossal Cave Adventure: parses unchanged `adventure.dat`, runs the Fortran game as a behavioral oracle, and adds optional Gemini-based natural language mapping plus optional location imagery hooks.

## Requirements

- Node 20+
- GNU Fortran build of `../adventure` (from repo root: `make`) for oracle tests and scripted play
- Optional: `GEMINI_API_KEY` for natural-language first line before scripted play

## Commands

```sh
npm install
npm run check
npm run build
```

## OWASP Dependency-Check (SCA)

Install the [official CLI](https://owasp.org/www-project-dependency-check/) on macOS:

```sh
brew install dependency-check
```

From the **repository root** (runs `npm install` in `adventure-llm`, then scans it):

```sh
make dependency-check
```

Or from **`adventure-llm/`** after `npm install`:

```sh
npm run dependency-check
```

Reports are written to `adventure-llm/reports/dependency-check/` (HTML + JSON; ignored by git).

The first run downloads NVD/CVE data and can take several minutes. Without an [NVD API key](https://nvd.nist.gov/developers/request-an-api-key), the public NVD API may return **HTTP 429** (rate limit) during the update. Use a key:

```sh
export NVD_API_KEY='…'
make dependency-check
```

After data exists locally—or to skip the slow update—use **`make dependency-check-quick`** or `npm run dependency-check:quick` (`--noupdate`).

Manual invocation with a key:

```sh
cd adventure-llm
dependency-check --nvdApiKey "$NVD_API_KEY" --project adventure-llm --scan . --out ./reports/dependency-check --format HTML --format JSON
```

## Environment

| Variable                               | Purpose                                                                                                                                                                                            |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY`                       | Enables natural-language first line; omit or use `--classic` for Fortran-only                                                                                                                      |
| `GEMINI_TEXT_MODEL`                    | Optional; defaults to `gemini-2.5-flash` for NL JSON mapping                                                                                                                                       |
| `GEMINI_IMAGE_MODEL`                   | Optional; defaults to `gemini-3.1-flash-image-preview` for future location imagery                                                                                                                 |
| `ADVENTURE_LLM_DEBUG`                  | Set to `1` to append JSONL interaction logs to `.cache/llm-interactions.jsonl` (under cwd, usually `adventure-llm/`); includes full Gemini request prompts                                         |
| `ADVENTURE_LLM_DEBUG_LOG`              | Optional explicit path for that JSONL file (overrides default path when set)                                                                                                                       |
| `ADVENTURE_LLM_CACHE_DIR`              | If set, cache each `InterpretedCommand` by hash of model + user line (JSON files); avoids repeat API calls                                                                                         |
| `ADVENTURE_LLM_INSTRUCTIONS`           | `y` or `n` for autoplay only: answer to “instructions?” without a prompt (default `n`)                                                                                                             |
| `ADVENTURE_LLM_AUTOPLAY_PACE_MS`       | Autoplay: delay in ms after each screen before the next Gemini call (default `2000`; `0` disables)                                                                                                 |
| `ADVENTURE_LLM_AUTOPLAY_MAX_MOVES`     | Autoplay: stop after this many GETIN lines (default `300`)                                                                                                                                         |
| `ADVENTURE_LLM_AUTOPLAY_CONTEXT_CHARS` | Autoplay: approximate max size of the planner user prompt (default `6000`; use `4000`–`6000` for very small local models)                                                                          |
| `ADVENTURE_LLM_COMPACT_PROMPTS`        | `1` / `0`: force compact or full prompts for all providers. If **unset**, compact defaults **on** for MLX only (shorter rules, smaller vocab list, no HELP preamble in planner/interpret prompts). |
| `ADVENTURE_LLM_VOCAB_HINT_MAX`         | Override word count in vocabulary hints (8–500). If unset: **48** when compact, **120** when full.                                                                                                 |
| `ADVENTURE_LLM_AUTOPLAY_TWO_STEP`      | Set to `1` **MLX only**: run a first LLM call to pick a subset of **situation candidates**, then the planner (doubles MLX calls per move). Default off.                                            |
| `ADVENTURE_LLM_MLX_MODEL`              | Hugging Face repo id for MLX (default **`mlx-community/gemma-2-9b-it-4bit`**). Use `mlx-community/gemma-2-2b-it` on low-RAM machines.                                                              |
| `NVD_API_KEY`                          | Optional; Dependency-Check reads it when set in the environment (see below)                                                                                                                        |
| `HF_TOKEN`                             | Optional; [Hugging Face access token](https://huggingface.co/docs/hub/security-tokens) for higher Hub rate limits and more reliable model downloads (MLX / `mlx_lm`)                               |

Logs and cache live under `adventure-llm/.cache/` by default; that directory is gitignored.

### Text LLM providers (reliability vs local MLX)

- **Google Generative AI** and **OpenAI-compatible HTTP** with `ADVENTURE_LLM_HTTP_JSON_SCHEMA=1` (when supported) can attach **JSON schema / enum constraints** to parser tokens, which greatly improves valid vocabulary output.
- **MLX** (default **`mlx-community/gemma-2-9b-it-4bit`**) uses **unconstrained** text generation and parses JSON from the reply. The CLI defaults to **compact prompts** and a **6000**-character autoplay context. Autoplay also injects a **situation candidate** line: motion words (from KTAB class 1), common verbs (class 3), object nouns (class 2) that appear in the recent transcript, and a few misc words (e.g. HELP). Optionally set **`ADVENTURE_LLM_AUTOPLAY_TWO_STEP=1`** so MLX runs a **first** JSON call to narrow that list before the main planner. If the 9B download or load fails (memory), set **`ADVENTURE_LLM_MLX_MODEL=mlx-community/gemma-2-2b-it`** for a lighter model. For stricter JSON, prefer a hosted provider with schema support. Use `ADVENTURE_LLM_DEBUG=1` and inspect `.cache/llm-interactions.jsonl` to compare requests and raw model output.

### Hugging Face token (`HF_TOKEN`)

Downloading MLX models (for example `mlx-community/gemma-2-9b-it-4bit` or `mlx-community/gemma-2-2b-it`) uses the [Hugging Face Hub](https://huggingface.co/). Without authentication, downloads use anonymous limits; with a token you get **higher rate limits** and generally smoother pulls.

**Do not commit the token.** Get one at [Settings → Access Tokens](https://huggingface.co/settings/tokens): create a token with at least **Read** permission (enough for public models). Set:

1. **Shell** (one session): `export HF_TOKEN='hf_…'`
2. **`adventure-llm/.env`**: add `HF_TOKEN=hf_…` next to your other secrets (see [`.env.example`](.env.example)). Load it the same way you load `NVD_API_KEY` for Dependency-Check, or use [direnv](https://direnv.net/).

The [`huggingface_hub`](https://huggingface.co/docs/huggingface_hub/package_reference/environment_variables) library also accepts `HUGGING_FACE_HUB_TOKEN` if you already use that name elsewhere.

### NVD API key (Dependency-Check)

Do **not** commit the key. Use any of:

1. **Export in your shell** (one session): `export NVD_API_KEY='your-key'`
2. **Put it in `adventure-llm/.env`** (file is gitignored): copy [`.env.example`](.env.example) to `.env`, set `NVD_API_KEY=...`, then run `set -a && source .env && set +a && make dependency-check` from repo root, or use [direnv](https://direnv.net/) to load `.env` automatically.
3. **Add to `~/.zshrc`** if you want it available in every terminal: `export NVD_API_KEY='...'`

Then run `make dependency-check` from the repository root; the Makefile passes `--nvdApiKey "$NVD_API_KEY"` when that variable is non-empty.

## Layout

| Path                 | Role                                               |
| -------------------- | -------------------------------------------------- |
| `src/dat/loadDat.ts` | Loader for `adventure.dat` (Fortran section order) |
| `src/engine/`        | Fortran subprocess oracle + helpers                |
| `src/cli/getin.ts`   | GETIN-compatible tokenizer                         |
| `src/nl/`            | Zod schema + Gemini JSON client                    |
| `src/images/`        | Cache keys + optional image file helpers           |

## CLI

From `adventure-llm/` after `npm run build`:

```sh
npm start
```

Or: `node dist/cli/main.js`

**With `GEMINI_API_KEY` set** (for example in `adventure-llm/.env`), `npm start` streams the opening through **“WOULD YOU LIKE INSTRUCTIONS?”**; on **stderr** you answer `y`/`n`, then **`> `** for the **first** line in natural language (Gemini maps it to parser tokens). After that, **`> `** accepts **classic game input** until you type **`.quit`** / **`:q`**, the game ends, or you interrupt. The wrapper only sends **SIGTERM** when ending the session so stdin is not closed mid-game (which would trigger a Fortran EOF error).

Use **`npm start -- --debug`** (or set `ADVENTURE_LLM_DEBUG=1`) to append structured JSON lines (requests, responses, intent shortcuts, cache hits) to the log file under `.cache/`. Set `ADVENTURE_LLM_CACHE_DIR` to reuse stored interpretations for the same line and model.

After the first NL-mapped move, further lines are sent as **classic typed commands** (GETIN). Type **`.quit`** or **`:q`** to end the session.

**Without the key**, or when you pass **`--classic`**, the CLI runs the original Fortran `./adventure` in full TTY (same idea as `make run` from repo root). A short notice is printed when the key is missing.

**Self-acting mode:** with `GEMINI_API_KEY` set, run **`npm start -- --autoplay`**. Gemini plans each move from session memory (event log, heuristic inventory/location hints) plus recent game output and vocabulary; the process streams like normal play, with a configurable pause between moves so you can read the screen. Use **`ADVENTURE_LLM_INSTRUCTIONS`**, **`ADVENTURE_LLM_AUTOPLAY_*`** in `.env` as needed (see table above). Not compatible with **`--classic`**.

You can still run `./adventure` directly from the repository root if you prefer.
