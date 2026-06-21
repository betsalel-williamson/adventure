# NL quick start

Play Colossal Cave with natural-language input and an autoplay research dashboard.

## Run

```bash
make install-nl
make run-autoplay-web
```

Open <http://127.0.0.1:8787/> in your browser.

**Needs:** Node.js 24+, `make adventure` at repo root for the Fortran oracle. Optional: `GEMINI_API_KEY` for NL mapping (omit for classic parser tokens only).

## First visit

1. Accept the self-signed TLS certificate warning (localhost dev cert is normal).
2. Type natural-language commands or classic tokens (`N`, `GET LAMP`, …) in the input area.
3. Watch the transcript and inferred map update over SSE.

## Play modes

- **With NL:** set `GEMINI_API_KEY` (see [`adventure-nl/.env.example`](../../adventure-nl/.env.example)).
- **Classic only:** omit the API key or run with `--classic`.

Judge walkthrough: [`DEMO.md`](../../DEMO.md). Package reference: [`adventure-nl/README.md`](../../adventure-nl/README.md).

More detail: `docs/client/` · `docs/features/`
