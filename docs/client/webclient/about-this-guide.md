# About this guide — webclient

**Audience:** People who use the browser shell to play Colossal Cave or evaluate agent behavior — not maintainers wiring backends or migrating code.

## Personas

### Player

You want a readable **CRT transcript** and a command line that talks to the real Fortran game. You care that room text is oracle truth and that status messages are plain language when something fails.

### Map explorer

You want a **draft exploration map** beside the transcript while you play — inferred places and compass moves from visible text, clearly labeled as assistance rather than privileged game state.

### Agent researcher

You test **SLMs, LLMs, or multi-agent stacks** (LangGraph assist, AG2, NL autoplay) against the same play surface. You need honest run labels: draft maps and hints are not world truth; scripted probes are not autonomous LLM play.

## What you can do here

- Choose a surface matched to your persona ([Choose your surface](choose-your-surface.md))
- Start the webclient and play or observe ([Quick start](quick-start.md))
- Read the CRT and exploration map with correct expectations ([Playing the game](playing-the-game.md), [Reading the exploration map](reading-the-exploration-map.md))
- Evaluate agents without confusing assistance for oracle output ([Evaluating agent behavior](evaluating-agent-behavior.md))

## What this guide is not

- Not maintainer setup — see [Developer — webclient dev setup](../../developer/webclient-dev-setup.md)
- Not migration inventory or source paths — see [Developer — webclient migration catalog](../../developer/webclient-migration-catalog.md)
- Not a replacement for the langgraph or NL package READMEs while migration is in progress

Shared terms: [Glossary](../../glossary/index.md) · [Webclient (term)](../../glossary/webclient.md)
