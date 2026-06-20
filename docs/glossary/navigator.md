# Navigator

The **navigator** is the LangGraph node that requests a **suggested next compass move** from an SLM adapter (Ollama) or falls back to the heuristic adapter.

Navigator hints appear as **draft assistance** — they are not auto-submitted to the game unless the player types a command or an explicit probe step (when map probe is enabled) sends one.

Configure real local models with `OLLAMA_URL` and optionally `OLLAMA_MODEL`. Without Ollama, the server uses the heuristic adapter only.
