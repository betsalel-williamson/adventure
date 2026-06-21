# NL quick start

Play Colossal Cave with natural-language input and an autoplay research dashboard.

## Run the dashboard

```bash
make install-nl
make run-autoplay-web
```

Open <http://127.0.0.1:8787/> in your browser.

## Play

1. Type natural-language commands or classic parser tokens in the input area.
2. Watch the transcript and inferred map update over SSE.
3. For Fortran-only play, omit `GEMINI_API_KEY` or use `--classic`.

See [`adventure-nl/README.md`](../../adventure-nl/README.md) for providers and environment variables. Judge walkthrough: [`DEMO.md`](../../DEMO.md).

More detail: `docs/client/` · `docs/features/`
