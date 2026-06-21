# Cloud deploy MVP

Hosted deployment of Adventure backend services with optional **local SLM** via a paired **desktop inference agent**.

## What the user gets

WHEN a player opens the hosted URL THEN they SHALL play Colossal Cave in the webclient with oracle text streamed from the cloud backend.

WHEN a researcher pairs a desktop agent THEN optional navigator or planner hints SHALL run on **local Ollama** without exposing localhost to the browser.

WHEN no desktop is paired THEN the operator MAY configure **hosted LLM** inference on the server instead of heuristic-only assist.

## What stays draft / not world truth

- Exploration map and navigator hints remain **draft assistance** ([Honest labeling](../client/readme-shards/honest-labeling.md)).
- Heuristic fallback is **not** an SLM ([SLM vs LLM](../glossary/slm-vs-llm.md)).

## Out of first release

Full NL research dashboard on cloud, adventure-ag2, MLX on Linux servers — see [MVP scope](../architecture/cloud-deploy-mvp/mvp-scope.md).

## Documentation

| Doc | Audience |
| --- | --- |
| [Architecture overview](../architecture/cloud-deploy-mvp/overview.md) | Design |
| [Work graph](../architecture/cloud-deploy-mvp/work-graph.md) | Implementation order |
| [GitHub issue templates](../architecture/cloud-deploy-mvp/github-issues.md) | Create linked issues when repo Issues enabled |
| [Developer index](../developer/cloud-deploy-mvp/index.md) | Operators |

Decision: [ADR0017](../decisions/ADR0017-cloud-deploy-and-desktop-inference-bridge.md)
