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

| Variable          | Purpose                                      |
| ----------------- | -------------------------------------------- |
| `GEMINI_API_KEY`  | Required for `interpretWithGemini` / CLI `--nl` |
| `NVD_API_KEY`     | Optional; Dependency-Check reads it when set in the environment (see below) |

### NVD API key (Dependency-Check)

Do **not** commit the key. Use any of:

1. **Export in your shell** (one session): `export NVD_API_KEY='your-key'`
2. **Put it in `adventure-llm/.env`** (file is gitignored): copy [`.env.example`](.env.example) to `.env`, set `NVD_API_KEY=...`, then run `set -a && source .env && set +a && make dependency-check` from repo root, or use [direnv](https://direnv.net/) to load `.env` automatically.
3. **Add to `~/.zshrc`** if you want it available in every terminal: `export NVD_API_KEY='...'`

Then run `make dependency-check` from the repository root; the Makefile passes `--nvdApiKey "$NVD_API_KEY"` when that variable is non-empty.

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
