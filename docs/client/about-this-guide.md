# About this guide

**Audience:** Researchers testing SLMs and LLMs to play the game using a framework to solve the game. The project is moving toward the [AG2 (AutoGen) framework](https://github.com/ag2ai/ag2) for multi-agent orchestration; this guide describes the **current v3 play surface** and how to evaluate models honestly against the Fortran oracle.

## What you can do here

- Play Colossal Cave in a CRT-style transcript with real Fortran output
- Watch a **draft** exploration map infer places and moves from visible text
- Configure local models (Ollama) for navigator hints on the assist path
- Run fixture-based evals without mistaking draft assistance for game truth

Shared terms: [Glossary](../glossary/index.md).

## What this guide is not

- Not a substitute for parser source code or adventure-nl natural-language mapping docs
- Not a promise of full autonomous AG2 play on the default v3 surface (that integration is upcoming)

For maintainer setup, see [Developer guide — v3 dev setup](../developer/v3-dev-setup.md).
