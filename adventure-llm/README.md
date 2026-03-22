# adventure-llm

TypeScript tooling for Colossal Cave Adventure: parses unchanged `adventure.dat`, runs the Fortran game as a behavioral oracle, and adds optional Gemini-based natural language mapping plus optional location imagery hooks.

## Requirements

- Node 20+
- GNU Fortran build of `../adventure` (from repo root: `make`) for oracle tests and scripted play
- Optional: `GEMINI_API_KEY` for `--nl` CLI mode

## Commands

```sh
npm install
npm run check
npm run build
```

## Environment

| Variable          | Purpose                                      |
| ----------------- | -------------------------------------------- |
| `GEMINI_API_KEY`  | Required for `interpretWithGemini` / CLI `--nl` |

## Layout

| Path                 | Role                                                |
| -------------------- | --------------------------------------------------- |
| `src/dat/loadDat.ts` | Loader for `adventure.dat` (Fortran section order) |
| `src/engine/`        | Fortran subprocess oracle + helpers                 |
| `src/cli/getin.ts`   | GETIN-compatible tokenizer                          |
| `src/nl/`            | Zod schema + Gemini JSON client                     |
| `src/images/`        | Cache keys + optional image file helpers            |

## CLI

```sh
node dist/cli/main.js          # demo script (non-interactive sample)
node dist/cli/main.js --nl       # requires GEMINI_API_KEY; one NL turn demo
```

For full interactive play with the original parser, run `./adventure` from the repository root.
