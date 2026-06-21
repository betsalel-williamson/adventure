# Overview

Standalone **Vite + TypeScript** client for developing Colossal Cave UI **separate from backend choice**. Migrates panels from adventure-langgraph (CRT, Mermaid map, assist) and adventure-nl (autoplay dashboard, prompt lab, 3D grid) behind **feature flags** and env-driven backend adapters.

Backends evolve independently (v2 HTTP, LangGraph assist, AG2 handoff, NL glue). The webclient holds UI features behind flags so you can document, migrate, and point the same shell at different backends.
