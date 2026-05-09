/**
 * Same-origin Stately inspect bridge: HTML shell + WebSocket relay, modeled on
 * `@statelyai/inspect/server` (see `createInspectorServer` in that package).
 * The inner iframe still loads the hosted Stately UI unless overridden via env.
 */
import type * as http from "node:http";
import type * as https from "node:https";
import { WebSocket, WebSocketServer } from "ws";

export const STATELY_INSPECT_WS_PATH = "/api/stately-inspect/ws";

const DEFAULT_INSPECT_UI = "https://stately.ai/inspect";

/** Public GET path for the bridge page (iframe `src` on the dashboard). */
export const STATELY_INSPECT_BRIDGE_PATH = "/stately-inspect";

function resolveStatelyInspectUiUrl(): string {
  const raw = process.env.ADVENTURE_NL_STATELY_INSPECT_UI_URL?.trim();
  if (raw && /^https:\/\//.test(raw)) {
    try {
      const u = new URL(raw);
      if (u.protocol === "https:") return u.href;
    } catch {
      /* fall through */
    }
  }
  return DEFAULT_INSPECT_UI;
}

export function buildStatelyInspectBridgeHtml(): string {
  const inspectorUrl = resolveStatelyInspectUiUrl();
  const inspectorJson = JSON.stringify(inspectorUrl);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Stately inspector (self-hosted bridge)</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    iframe { width: 100%; height: 100%; border: none; }
  </style>
</head>
<body>
  <iframe id="inspector" title="Stately inspect UI"></iframe>
  <script>
    (function () {
      var inspectorUrl = ${inspectorJson};
      document.getElementById("inspector").src = inspectorUrl;
      var iframe = document.getElementById("inspector");
      var buffer = [];
      var connected = false;

      window.addEventListener("message", function (e) {
        if (e.data && e.data.type === "@statelyai.connected") {
          connected = true;
          buffer.forEach(function (event) {
            iframe.contentWindow.postMessage(event, "*");
          });
          buffer.length = 0;
        }
      });

      var proto = location.protocol === "https:" ? "wss" : "ws";
      var ws = new WebSocket(proto + "://" + location.host + ${JSON.stringify(STATELY_INSPECT_WS_PATH)});
      ws.onmessage = function (event) {
        var data = JSON.parse(event.data);
        if (connected) {
          iframe.contentWindow.postMessage(data, "*");
        } else {
          buffer.push(data);
        }
      };
    })();
  </script>
</body>
</html>
`;
}

/**
 * Attach WebSocket upgrade handling for {@link STATELY_INSPECT_WS_PATH}.
 * Broadcasts JSON text frames between all connected clients (dashboard inspector + bridge iframes).
 */
export function attachStatelyInspectWebSocket(
  server: http.Server | https.Server,
): void {
  const wss = new WebSocketServer({ noServer: true });
  const eventBuffer: string[] = [];
  const maxBufferSize = 200;

  server.on("upgrade", (req, socket, head) => {
    try {
      const host = req.headers.host ?? "localhost";
      const u = new URL(req.url ?? "/", `http://${host}`);
      if (u.pathname !== STATELY_INSPECT_WS_PATH) {
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        for (const msg of eventBuffer) {
          if (ws.readyState === WebSocket.OPEN) ws.send(msg);
        }
        ws.on("message", (data) => {
          const msg = data.toString();
          eventBuffer.push(msg);
          if (eventBuffer.length > maxBufferSize) eventBuffer.shift();
          for (const client of wss.clients) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(msg);
            }
          }
        });
      });
    } catch {
      socket.destroy();
    }
  });
}
