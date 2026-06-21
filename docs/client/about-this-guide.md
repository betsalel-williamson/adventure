# About this guide

**Audience:** People who play Colossal Cave or evaluate agent behavior on the langgraph CRT surface — not maintainers wiring backends.

## Personas

### Player

You want a readable **CRT transcript** and classic parser commands that reach the real Fortran game. Room text is oracle truth; side panels are assistance.

### Map explorer

You watch the **draft exploration map** beside the transcript — inferred places and compass moves from visible text, not privileged game state.

### Agent researcher

You test **SLMs or LLMs** on the assist path (Ollama navigator, fixture evals, optional probe mode). You label runs honestly: draft maps are not world truth; scripted probes are not autonomous LLM play.

## What you can do here

- Play in the CRT shell with real Fortran output ([Quick start](quick-start.md))
- Read the draft exploration map ([Exploration map guide](exploration-map-guide.md))
- Configure local models ([SLM configuration](slm-configuration.md))
- Run research workflows and fixture evals ([Research workflows](research-workflows.md))

## What this guide is not

- Not maintainer setup — see [Developer guide — v3 dev setup](../developer/v3-dev-setup.md)
- Not the unified webclient migration shell — see [Webclient guide](webclient/index.md)
- Not a substitute for adventure-nl natural-language mapping docs

Shared terms: [Glossary](../glossary/index.md)
