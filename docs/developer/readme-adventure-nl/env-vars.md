# Environment variables

Full list: [`.env.example`](.env.example).

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Enables NL first line; omit or use `--classic` for Fortran-only |
| `GEMINI_TEXT_MODEL` | Optional; defaults to `gemini-2.5-flash` |
| `ADVENTURE_NL_DEBUG` | `1` — JSONL interaction logs under `.cache/` |
| `ADVENTURE_NL_WEB_PORT` | Dashboard listen port (default `8787`) |
| `ADVENTURE_NL_WEB_INSECURE_HTTP` | `1` — plain HTTP, no Secure cookie |
| `ADVENTURE_NL_BROWSER_ORCHESTRATED_AUTOPLAY` | Default on for google/http providers; MLX uses Node glue |
| `ADVENTURE_NL_MLX_MODEL` | MLX checkpoint (default `mlx-community/gemma-2-2b-it`) |
| `ADVENTURE_NL_HTTP_*` | OpenAI-compatible HTTP provider settings |
| `ADVENTURE_NL_AUTOPLAY_PACE_MS` | Delay between autoplay moves (default `2000`) |
| `ADVENTURE_NL_AUTOPLAY_MAX_MOVES` | Stop after N GETIN lines (default `120`) |
| `HF_TOKEN` | Hugging Face token for smoother MLX model downloads |
| `NVD_API_KEY` | Optional; OWASP Dependency-Check NVD API |

Logs and cache default to `adventure-nl/.cache/` (gitignored).
