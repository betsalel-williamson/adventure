# Webclient

The **webclient** is the unified browser shell in `adventure-webclient/` — a single frontend for playing Colossal Cave and evaluating agent backends (LangGraph assist, AG2 handoff, NL autoplay) behind feature flags.

Until migration completes, production surfaces remain in `adventure-langgraph/apps/web` (CRT + default map) and `adventure-nl/public/` (autoplay dashboard). The webclient preserves those investments while decoupling UI from backend choice.

See [Client guide — webclient](../client/webclient/index.md) for personas and [Features — webclient](../features/webclient/index.md) for product capabilities.
