# Oracle

The **oracle** is the authoritative game process that answers parser commands with real Colossal Cave output.

In adventure-langgraph, the default oracle is the Fortran binary `./adventure` (built from the repository root with `make adventure`), orchestrated by adventure-v2 over HTTP and SSE. A **synthetic oracle** returns deterministic stub text for automated tests only.

Room descriptions, inventory changes, and puzzle outcomes from the oracle are **canonical game text**. Draft map and assist outputs never override the oracle.
