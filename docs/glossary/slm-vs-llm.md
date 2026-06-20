# SLM vs LLM

This repository uses precise labels when describing model-backed behavior:

- **LLM (large language model)** — general term for cloud or hosted text models (for example Gemini) used in the adventure-nl natural-language stack.
- **SLM (small language model)** — a **local** or lightweight model invoked on the assist path (for example via Ollama) for navigator compass hints.

**Important:** The **heuristic adapter** is **not** an SLM. It is a rule-based fallback when `OLLAMA_URL` is unset. UI copy and research notes must label heuristic behavior honestly.

The adventure-nl stack maps **natural language** player text to parser tokens. That path is separate from v3’s SLM-backed **navigator** hints on `POST /assist/ingest` and `POST /assist/step`.
