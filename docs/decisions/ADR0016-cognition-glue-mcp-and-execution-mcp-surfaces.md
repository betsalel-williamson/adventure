# ADR0016: Cognition (Glue) MCP and Execution (Game) MCP surfaces

## Context

### Problem

Documentation and reviews used a **single “MCP server”** shorthand for two different concerns: **(1) authoritative game execution** (Fortran, SSE, `POST /api/engine/input`, GETIN) and **(2) client-side cognition glue** (inferred map, heuristics, mode policy, planner context built from streamed text in **`@adventure-nl/nl-glue`**). Collapsing them hides boundaries, desync risks, test seams, and the path for **IDE parity** (Cursor / VS Code) where the same **glue** should be invocable without forking policy.

[ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md) already separates **engine truth** from **inferred glue**; [ADR0014](ADR0014-two-step-nl-glue-package-then-browser.md) lands **nl-glue** in the browser bundle; [ADR0015](ADR0015-deprecate-server-forward-nl-cognition.md) makes **client-direct** vendor calls the dashboard default. The missing piece is a **named protocol story** for how **glue** and **execution** are exposed and sequenced.

### Forces

- **Clarity:** Engineers and tools must see **two capability surfaces**—**Mind** (glue) vs **Body** (execution)—not one blob.
- **MCP ecosystem:** [Model Context Protocol](https://modelcontextprotocol.io/specification/2025-11-25) (**2025-11-25**) gives **JSON-RPC 2.0**, `tools/list`, `tools/call`, **stdio** for local servers, and documented **cancellation** / security expectations; in-repo examples live in [`.cursor/guidelines/mcp/llms.txt`](../../.cursor/guidelines/mcp/llms.txt).
- **As-built constraints:** The dashboard **today** uses **HTTP + SSE** for the game, not MCP. Any **Execution MCP** is an **optional Node stdio façade** over existing session endpoints, not a second Fortran stack.
- **Security:** Vendor keys and `fetch` stay in the **privileged browser host** ([ADR0015](ADR0015-deprecate-server-forward-nl-cognition.md)); glue tools stay **pure** transforms over host-supplied refs where possible.

### Evidence baseline

Cognition ADR headers and **as-built** gaps were reconciled against the repository (see [adventure-nl-cognition-adr-index.md](adventure-nl-cognition-adr-index.md) and patched ADRs **2026-04**). **`## Status`** on some ADRs previously disagreed with their own **Implementation** tables; this ADR’s **Implementation** chain captures the **documentation** steps that lock that alignment.

## Decision

1. **Glue MCP (Mind):** Define an MCP-shaped **`tools/list` / `tools/call`** registry implemented over **`@adventure-nl/nl-glue`**, with **primary** transport **JSON-RPC over `postMessage`** to a **dedicated Worker** (same message lifecycle as stdio: `initialize` → `notifications/initialized` → tools). Provide a **Node stdio** server exposing the **same registry** for IDE hosts (`protocolVersion: "2025-11-25"`). Registry source location target: `packages/nl-glue/src/mcpTools/` (schemas + handlers); transport adapters stay outside the glue package.

2. **Execution MCP (Body, optional):** Permit a **thin Node stdio MCP** server whose tools **delegate** to existing **`webDashboard`** session operations (e.g. submit GETIN, read bounded transcript tail)—**no** duplicate simulation authority. The **default dashboard** remains **HTTP/SSE**; this façade exists for **IDE loopback** and tests when needed.

3. **Orchestrator role:** The **browser dashboard host** (per MCP architecture: host → clients → servers) sequences **Glue MCP** calls, **natural language model** calls (SLM or LLM; [ADR0015](ADR0015-deprecate-server-forward-nl-cognition.md)), and **engine** I/O (`fetch` + SSE today; optional second MCP client to Execution MCP in IDE mode). Those models do **not** directly couple mind ↔ body; the **orchestration layer** does.

4. **Reconciliation:** After each successful engine step, **new authoritative text** must feed glue (e.g. `ingest_transcript_delta` / `update_state` tool or host effect + follow-up tool)—same invariant as ADR0005 **resync** guidance (guards, `LOOK` / `INVENTORY` probes).

5. **Documentation-only scope for this ADR’s initial landing:** The **decision text** and cross-links land first; **application code** (registry module, Worker host, stdio binaries) is tracked as **future** steps **C1–C4** in **Implementation** (separate coding work-item). Move **Status** to **accepted** when the team agrees the surfaces are frozen **and** agreed code scope is shipped.

## Alternatives considered

- **Single combined MCP server** — Rejected for documentation clarity: merges execution with glue and repeats the flaw this ADR fixes.

- **Comlink / tRPC only between host and Worker** — Rejected as the **sole** contract: loses IDE **stdio** parity and a discoverable **`tools/list`** catalog; optional Comlink-style sugar may wrap the MCP contract later without replacing it.

- **Streamable HTTP MCP in the browser for glue** — Rejected for v1: adds CSRF/auth/consent surface without benefit for first-party local glue; prefer **`postMessage`** + **Node stdio** twin ([spec](https://modelcontextprotocol.io/specification/2025-11-25), [llms.txt](../../.cursor/guidelines/mcp/llms.txt)).

- **Separate ADR0017 for Execution MCP only** — Deferred: keep Execution MCP as an **optional subsection** here unless reviewers require a split.

## Consequences

**Positive**

- Clear vocabulary (**Mind / Body**) for reviews, tests, and IDE integration.
- One **registry** can back **Worker** and **stdio** without duplicating glue logic.
- Aligns with MCP **Trust & Safety** framing: tools are execution; first-party glue vs future `subsystem.*` tools can be documented separately ([ADR0011](ADR0011-subsystem-module-contract-dynamic-js.md)).

**Negative**

- Two transports to document (**postMessage** + stdio) and optional third (**Execution MCP**).
- **Serialization tax** on large transcripts over `postMessage`—mitigate with refs, bounded reads, optional SQLite read path ([ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md)); **SharedArrayBuffer** only if measured and cross-origin isolated.

## Rationale

Naming **Glue MCP** and **Execution MCP** makes the **ADR0005 / ADR0014 / ADR0015** architecture legible to humans and to MCP hosts, without changing Fortran authority or the default HTTP game wire in v1.

## Status

Proposed

*(Documentation chain S0–S4 may land while status remains **proposed**; promote to **accepted** after team review and when agreed Glue MCP / optional Execution MCP **code** is implemented.)*

## Implementation

### Documentation chain (Prev → Step → Next)

| Step id | Prev | Step (title) | Next | Primary artifact |
| ------- | ---- | ------------- | ---- | ------------------ |
| **S0** | — | Evidence audit: cognition ADRs vs `adventure-nl/` tree. | **S1** | This ADR **Context** + index note |
| **S1** | **S0** | Sync `## Status` / narrative on cognition ADRs (ADR0004–0015) per index reconciliation. | **S2** | Patched `docs/decisions/ADR*.md` |
| **S2** | **S1** | Land ADR0016 (this file) + cross-links. | **S3** | `docs/decisions/ADR0016-….md` |
| **S3** | **S2** | Patch [adventure-nl-cognition-adr-index.md](adventure-nl-cognition-adr-index.md) + [adventure-nl-cognition-and-workspace.md](../architecture/adventure-nl-cognition-and-workspace.md). | **S4** | Index + architecture |
| **S4** | **S3** | Add **Previous / Next** in References on ADR0005, ADR0014, ADR0015 (minimum). | **C1** | Same ADR files |

### Future code chain (out of scope of this documentation deliverable)

| Step id | Prev | Step (title) | Next |
| ------- | ---- | ------------- | ---- |
| **C1** | **S4** | `packages/nl-glue/src/mcpTools/` registry + Zod + Vitest. | **C2** |
| **C2** | **C1** | Browser Worker JSON-RPC host + contract tests. | **C3** |
| **C3** | **C2** | Node Glue stdio server (`@modelcontextprotocol/sdk`) + CI snapshot `tools/list`. | **C4** |
| **C4** | **C3** | Optional Execution MCP stdio façade OR explicit defer note. | — |

### Normative protocol pin

- **MCP specification:** [2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) (bump deliberately when the working group publishes a new dated revision).
- **Examples (non-normative):** [`.cursor/guidelines/mcp/llms.txt`](../../.cursor/guidelines/mcp/llms.txt).

### Target tool examples (illustrative names)

Initial Glue MCP tools may include: `map_current_state`, `apply_heuristics`, `get_exploration_summary`, plus wrappers around existing planner-context builders in **`@adventure-nl/nl-glue`**—all **pure** over host-supplied refs.

### Worker / cancellation (for implementers)

- Host wraps each `tools/call` with **timeouts** / **`AbortSignal`**; on Worker crash, **`terminate`**, respawn, re-`initialize` + `notifications/initialized`.
- Use JSON-RPC **`$/cancelRequest`** where applicable; for stdio prefer SDK cancellation behavior.

## References

- [ADR0004](ADR0004-backend-llm-packaging-and-discovery.md) — packaging discovery for logical requests.
- [ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md) — browser orchestration hub target.
- [ADR0014](ADR0014-two-step-nl-glue-package-then-browser.md) — nl-glue package + browser bundle.
- [ADR0015](ADR0015-deprecate-server-forward-nl-cognition.md) — client-direct NL.
- [ADR0006](ADR0006-client-sqlite-wal-subsystem-store.md) — durable store for glue checkpoints (forward).
- [ADR0008](ADR0008-server-subsystem-replica-and-sync.md) — `POST /api/subsystem-sync`; browser wiring forward.
- [ADR0011](ADR0011-subsystem-module-contract-dynamic-js.md) — future `subsystem.*` tool namespace.
- [ADR0013](ADR0013-dashboard-xstate-cognition-panel.md) — cognition orchestration visibility.
- [Model Context Protocol specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25)
- [`.cursor/guidelines/mcp/llms.txt`](../../.cursor/guidelines/mcp/llms.txt)

### Navigation (implementation order)

- **Previous:** [ADR0014](ADR0014-two-step-nl-glue-package-then-browser.md); [ADR0015](ADR0015-deprecate-server-forward-nl-cognition.md); [ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md).
- **Next (documentation):** [adventure-nl-cognition-adr-index.md](adventure-nl-cognition-adr-index.md); extend [ADR0005](ADR0005-browser-orchestrated-autoplay-cognition.md) **Forward work** (MCP row).
- **Next (code):** Steps **C1–C4** in **Implementation** above (separate work-item).
