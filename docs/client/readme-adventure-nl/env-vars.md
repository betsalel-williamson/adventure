# Environment variables (researcher)

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Enables NL mapping; omit or use `--classic` for Fortran-only play |
| `GEMINI_TEXT_MODEL` | Optional; defaults to `gemini-2.5-flash` |
| `ADVENTURE_NL_WEB_PORT` | Dashboard listen port (default `8787`) |
| `ADVENTURE_NL_WEB_INSECURE_HTTP` | `1` — plain HTTP, no Secure cookie |

Full operator catalog: [`docs/developer/readme-adventure-nl/env-vars.md`](../docs/developer/readme-adventure-nl/env-vars.md). Template: [`.env.example`](.env.example).
