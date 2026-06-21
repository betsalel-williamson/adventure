# Web dashboard

After `make` at repo root (so `../adventure` exists), from **`adventure-nl/`**:

1. One-time TLS: **`npm run web:tls-init`** — writes `.cache/tls/dev-key.pem` and `dev-cert.pem`
2. **`npm run build && npm run web`** — **HTTPS** on **`127.0.0.1:8787`** (override with **`ADVENTURE_NL_WEB_PORT`**)

From repo root: **`make run-autoplay-web`** or **`make run-autoplay-web-insecure`** for plain HTTP.

Open `<https://127.0.0.1:8787/>`. Demo: [`DEMO.md`](../DEMO.md). REST/SSE: [`openapi.yaml`](openapi.yaml) · narrative: [`API_DOCUMENTATION.md`](../API_DOCUMENTATION.md).

**Browser warnings** for the self-signed dev cert are normal on localhost — use Advanced → continue, or [mkcert](https://github.com/FiloSottile/mkcert).

**Sessions do not survive server restarts** — the `adventure_session` cookie maps to in-memory state only.

Dashboard modules and test pairings: [`docs/source-map.md`](docs/source-map.md).
