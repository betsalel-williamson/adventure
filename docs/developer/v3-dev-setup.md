# v3 dev setup

Setup for adventure-v3 local development.

## Prerequisites

- **Node.js 24+** — use root `.nvmrc` (`nvm use` / `fnm use`)
- **npm** — each package has its own `package-lock.json`
- **GNU Fortran** — for real oracle output (`gfortran`, `make adventure`)

Verify Node before install:

```bash
node --version   # expect v24.x
```

## Quick start

From `adventure-v3/`:

```bash
npm install
npm start
```

Open the CRT shell at port **5174** (default Vite dev server). The start script runs adventure-v2 API, Vite CRT, and assist server together.

**Shell only** (API + assist already running):

```bash
npm run dev
```

**Assist server only**:

```bash
npm run assist:dev
```

## Ports and overrides

| Service | Default | Override |
| --- | --- | --- |
| CRT (Vite) | 5174 | Vite config |
| Game API | 8787 | `VITE_API_URL` |
| Assist | 8790 | `VITE_ASSIST_URL`, `ASSIST_SERVER_PORT` |

## Optional Ollama

```bash
export OLLAMA_URL=http://127.0.0.1:11434
export OLLAMA_MODEL=llama3.2
npm start
```

Without `OLLAMA_URL`, navigator uses the heuristic adapter only.

## Fortran oracle

From repository root:

```bash
make adventure
```

When `./adventure` exists, adventure-v2 auto-selects the persistent Fortran oracle.
