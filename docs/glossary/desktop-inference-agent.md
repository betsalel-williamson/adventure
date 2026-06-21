# Desktop inference agent

A **desktop inference agent** is a small local application that maintains an **outbound** connection to the hosted Adventure server and executes **stateless** SLM/LLM calls (`system` + `user` prompts) against local runtimes such as Ollama.

It is **not** the game oracle, does not serve Fortran output, and does not replace XState or nl-glue orchestration in the browser.

Pairing uses a short-lived code; long-lived credentials stay in the OS keychain. See [desktop inference bridge](../architecture/cloud-deploy-mvp/desktop-inference-bridge.md).

Related: [SLM vs LLM](slm-vs-llm.md) · [Assist server](assist-server.md)
