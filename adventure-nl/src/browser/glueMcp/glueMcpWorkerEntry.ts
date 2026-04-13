/**
 * Dedicated Worker entry: JSON-RPC MCP-shaped glue dispatch (ADR0016 C2).
 * Bundled to `public/generated/glueMcpWorker.js`; only this file under `src/browser/`
 * may import `@adventure-nl/nl-glue` (see `.dependency-cruiser.cjs`).
 */
import { dispatchGlueMcpJsonRpc } from "@adventure-nl/nl-glue";

addEventListener("message", (ev: MessageEvent<unknown>) => {
  void dispatchGlueMcpJsonRpc(ev.data).then((res) => {
    if (res !== null) {
      (globalThis as unknown as { postMessage(m: unknown): void }).postMessage(
        res,
      );
    }
  });
});
