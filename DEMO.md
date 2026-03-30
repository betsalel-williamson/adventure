# Demo walkthrough (judges & newcomers)

Use this script to see the **magic moment** in under a few minutes: language-model-driven
autoplay with a live map, inventory hints, and transcript.

## Prerequisites

- **GNU Fortran** (`gfortran`) and **Node.js 20+**
- At least one **text model** backend configured for `adventure-llm` (for example
  `GEMINI_API_KEY` in `adventure-llm/.env` — copy from
  [`adventure-llm/.env.example`](adventure-llm/.env.example))

## Steps

1. **Clone** the repository and `cd` into it.

2. **Build the game** (creates `./adventure` next to `adventure.dat`):

   ```sh
   make
   ```

3. **Install and build** the TypeScript package:

   ```sh
   cd adventure-llm
   npm install
   npm run build
   cd ..
   ```

   Or one shot from the root: `make install-llm` then `cd adventure-llm && npm run build`.

4. **Start the autoplay web dashboard** from the repository root:

   ```sh
   make run-autoplay-web
   ```

5. **Open** [https://127.0.0.1:8787/](https://127.0.0.1:8787/) in a browser
   (or **http://** if you use insecure HTTP; see
   [`adventure-llm/README.md`](adventure-llm/README.md)), on the port shown in the
   terminal if you set `ADVENTURE_LLM_WEB_PORT`.

   Restarting the dashboard **starts new sessions**; nothing on disk restores a
   prior run (game randomness applies). See **Sessions do not survive server
   restarts** in [`adventure-llm/README.md`](adventure-llm/README.md).

6. **What to point at during the demo**
   - The **transcript** fills as the game runs; watch for planner “thinking”
     states if shown.
   - The **inferred map** and **inventory** panels update as the session
     explores.
   - The **session / FSM** diagram (Mermaid) shows high-level state.
   - Optional: change **autoplay pace** or **max moves** in the footer; values
     sync over SSE.
   - Optional: use the **Text model** dropdown to swap provider/model if multiple
     backends are configured.

## Classic mode (no language model)

From the repo root:

```sh
make run
```

This is the original TTY experience — good to show **historical fidelity**;
the language-model dashboard is the **optional** teaching / observability layer.

## If something fails

- **“Cannot find ./adventure”** — run `make` from the repo root.
- **“No text model configured”** — set env vars per
  [`adventure-llm/README.md`](adventure-llm/README.md).
- **Port in use** — set `ADVENTURE_LLM_WEB_PORT` to a free port and restart.
