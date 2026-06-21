# Assist server

The **assist server** is the local HTTP service (`packages/assist-server`, default port **8790**) that maintains per-run draft graph state from CRT transcript input.

**API reference:** [`openapi.yaml`](../../adventure-langgraph/packages/assist-server/openapi.yaml).

The assist server does **not** own game authority. It consumes transcript text the client already received from the oracle wire and returns **draft assistance** only.

Browser origin override: `VITE_ASSIST_URL`. Probe requires `ASSIST_PROBE_ENABLED=true` on the server and client `mapProbe` flag.
