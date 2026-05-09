import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from "node:http";
import {
  createRunRequestSchema,
  createRunResponseSchema,
  listCheckpointsResponseSchema,
  postReplayRequestSchema,
  postReplayResponseSchema,
  postTurnRequestSchema,
  sseWireEventSchema,
  type CreateRunResponse,
  type SseWireEvent
} from "../../../../packages/contracts/src/index.js";
import type { RunCoordinator } from "../run/runCoordinator.js";
import type { WireStreamItem } from "./wireStream.js";

const corsHeaders = (): Record<string, string> => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
});

const readJsonBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) {
    return {};
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Invalid JSON body");
  }
};

const sendJson = (
  res: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {}
): void => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    ...corsHeaders(),
    ...extraHeaders
  });
  res.end(payload);
};

const wireItemToSse = (item: WireStreamItem): SseWireEvent => {
  if (item.type === "turn") {
    return { event: "turn", envelope: item.envelope };
  }
  if (item.type === "trace") {
    return { event: "trace", trace: item.trace };
  }
  return {
    event: "phase",
    transition: item.transition
  };
};

const writeSse = (res: ServerResponse, wire: SseWireEvent): void => {
  sseWireEventSchema.parse(wire);
  const eventName = wire.event;
  res.write(`event: ${eventName}\ndata: ${JSON.stringify(wire)}\n\n`);
};

type Route =
  | { kind: "post-runs" }
  | { kind: "post-turn"; runId: string }
  | { kind: "get-events"; runId: string }
  | { kind: "get-checkpoints"; runId: string }
  | { kind: "post-replay"; runId: string }
  | { kind: "not-found" };

const parseRoute = (pathname: string, method: string): Route => {
  const path = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  if (method === "POST" && path === "/runs") {
    return { kind: "post-runs" };
  }
  const turnMatch = path.match(/^\/runs\/([^/]+)\/turns$/);
  if (method === "POST" && turnMatch) {
    return { kind: "post-turn", runId: turnMatch[1]! };
  }
  const eventsMatch = path.match(/^\/runs\/([^/]+)\/events$/);
  if (method === "GET" && eventsMatch) {
    return { kind: "get-events", runId: eventsMatch[1]! };
  }
  const checkpointsMatch = path.match(/^\/runs\/([^/]+)\/checkpoints$/);
  if (method === "GET" && checkpointsMatch) {
    return { kind: "get-checkpoints", runId: checkpointsMatch[1]! };
  }
  const replayMatch = path.match(/^\/runs\/([^/]+)\/replay$/);
  if (method === "POST" && replayMatch) {
    return { kind: "post-replay", runId: replayMatch[1]! };
  }
  return { kind: "not-found" };
};

const isUnknownRunError = (err: unknown): boolean =>
  err instanceof Error && err.message.startsWith("Unknown run:");

const isUnknownCheckpointError = (err: unknown): boolean =>
  err instanceof Error && err.message.startsWith("Unknown checkpoint:");

export const createAdventureHttpServer = (coordinator: RunCoordinator): Server => {
  return createServer((req, res) => {
    void handleHttp(coordinator, req, res);
  });
};

const handleHttp = async (
  coordinator: RunCoordinator,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> => {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const pathname = url.pathname;

  if (method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  const route = parseRoute(pathname, method);

  try {
    if (route.kind === "post-runs") {
      const raw = await readJsonBody(req);
      const body = createRunRequestSchema.parse(raw);
      const started = coordinator.startRun(body.config);
      const response: CreateRunResponse = createRunResponseSchema.parse({
        runId: started.runId,
        config: started.config
      });
      sendJson(res, 201, response);
      return;
    }

    if (route.kind === "post-turn") {
      const raw = await readJsonBody(req);
      const body = postTurnRequestSchema.parse(raw);
      coordinator.processTurn(route.runId, body.input, {
        forceReject: body.forceReject
      });
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }

    if (route.kind === "get-events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        ...corsHeaders()
      });
      res.flushHeaders?.();

      const unsub = coordinator.subscribeToRun(route.runId, (item: WireStreamItem) => {
        try {
          writeSse(res, wireItemToSse(item));
        } catch {
          /* ignore write-after-close */
        }
      });

      req.on("close", () => {
        unsub();
      });
      return;
    }

    if (route.kind === "get-checkpoints") {
      try {
        const checkpoints = coordinator.checkpointsForRun(route.runId);
        sendJson(res, 200, listCheckpointsResponseSchema.parse(checkpoints));
      } catch (err) {
        if (isUnknownRunError(err)) {
          sendJson(res, 404, { error: "not_found", message: (err as Error).message });
          return;
        }
        throw err;
      }
      return;
    }

    if (route.kind === "post-replay") {
      const raw = await readJsonBody(req);
      let body;
      try {
        body = postReplayRequestSchema.parse(raw);
      } catch {
        sendJson(res, 400, { error: "bad_request", message: "Invalid replay request body" });
        return;
      }
      try {
        const restore = coordinator.replay(body.checkpointId);
        if (restore.runId !== route.runId) {
          sendJson(res, 404, {
            error: "not_found",
            message: "Checkpoint does not belong to this run"
          });
          return;
        }
        sendJson(res, 200, postReplayResponseSchema.parse(restore));
      } catch (err) {
        if (isUnknownCheckpointError(err) || isUnknownRunError(err)) {
          sendJson(res, 404, { error: "not_found", message: (err as Error).message });
          return;
        }
        throw err;
      }
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendJson(res, 400, { error: "bad_request", message });
  }
};

export const listenAdventureServer = (
  coordinator: RunCoordinator,
  port: number,
  host: string = "127.0.0.1"
): Promise<{ server: Server; port: number; baseUrl: string }> => {
  const server = createAdventureHttpServer(coordinator);
  return new Promise((resolve, reject) => {
    server.listen(port, host, () => {
      const address = server.address();
      const actualPort =
        address && typeof address === "object" ? address.port : port;
      resolve({
        server,
        port: actualPort,
        baseUrl: `http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${actualPort}`
      });
    });
    server.on("error", reject);
  });
};
