import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from "node:http";
import {
  createRunRequestSchema,
  createRunResponseSchema,
  createSessionResponseSchema,
  inferenceRequestSchema,
  issuePairingCodeResponseSchema,
  listCheckpointsResponseSchema,
  postReplayRequestSchema,
  postReplayResponseSchema,
  postTurnRequestSchema,
  redeemPairingCodeRequestSchema,
  redeemPairingCodeResponseSchema,
  sseWireEventSchema,
  type CreateRunResponse,
  type SseWireEvent
} from "../../../../packages/contracts/src/index.js";
import { healthOracleWireFields } from "../oracle/oracleStartupConfig.js";
import type { RunCoordinator } from "../run/runCoordinator.js";
import {
  SessionStore,
  formatSessionCookie,
  parseSessionCookie
} from "../session/sessionStore.js";
import type { WireStreamItem } from "./wireStream.js";

/** Maximum bytes read for JSON request bodies (`POST` routes using `readJsonBody`). */
export const HTTP_MAX_JSON_BODY_BYTES = 256 * 1024;

export { healthOracleWireFields };

/**
 * Comma-separated list of allowed browser `Origin` values. When unset or blank,
 * responses use `Access-Control-Allow-Origin: *`. When set, only matching
 * origins receive a reflected `Access-Control-Allow-Origin`; others omit it.
 */
export const ADV_V2_CORS_ORIGINS_ENV = "ADV_V2_CORS_ORIGINS";

class JsonBodyTooLargeError extends Error {
  constructor() {
    super("JSON body exceeds maximum size");
    this.name = "JsonBodyTooLargeError";
  }
}

const parseCorsAllowlist = (): readonly string[] | null => {
  const raw = process.env[ADV_V2_CORS_ORIGINS_ENV];
  if (raw === undefined || raw.trim() === "") {
    return null;
  }
  const parts = raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  return parts.length === 0 ? null : parts;
};

/** CORS headers for a request; reads `ADV_V2_CORS_ORIGINS` per request for tests and runtime env changes. */
export const corsHeadersForRequest = (req: IncomingMessage): Record<string, string> => {
  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  const allowlist = parseCorsAllowlist();
  if (allowlist === null) {
    return { ...base, "Access-Control-Allow-Origin": "*" };
  }
  const origin = req.headers.origin;
  if (typeof origin === "string" && allowlist.includes(origin)) {
    return { ...base, "Access-Control-Allow-Origin": origin };
  }
  return base;
};

const readJsonBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (total + buf.length > HTTP_MAX_JSON_BODY_BYTES) {
      throw new JsonBodyTooLargeError();
    }
    total += buf.length;
    chunks.push(buf);
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
  req: IncomingMessage,
  res: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {}
): void => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    ...corsHeadersForRequest(req),
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
  | { kind: "get-health" }
  | { kind: "post-session" }
  | { kind: "post-pairing-codes" }
  | { kind: "post-pairing-redeem" }
  | { kind: "post-inference-plan" }
  | { kind: "post-inference-navigator" }
  | { kind: "get-inference-capabilities" }
  | { kind: "post-runs" }
  | { kind: "post-turn"; runId: string }
  | { kind: "get-events"; runId: string }
  | { kind: "get-checkpoints"; runId: string }
  | { kind: "post-replay"; runId: string }
  | { kind: "not-found" };

const parseRoute = (pathname: string, method: string): Route => {
  const path = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  if (method === "GET" && path === "/health") {
    return { kind: "get-health" };
  }
  if (method === "POST" && path === "/session") {
    return { kind: "post-session" };
  }
  if (method === "POST" && path === "/pairing/codes") {
    return { kind: "post-pairing-codes" };
  }
  if (method === "POST" && path === "/pairing/redeem") {
    return { kind: "post-pairing-redeem" };
  }
  if (method === "POST" && path === "/inference/plan") {
    return { kind: "post-inference-plan" };
  }
  if (method === "POST" && path === "/inference/navigator") {
    return { kind: "post-inference-navigator" };
  }
  if (method === "GET" && path === "/inference/capabilities") {
    return { kind: "get-inference-capabilities" };
  }
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

export const createAdventureHttpServer = (
  coordinator: RunCoordinator,
  sessions: SessionStore = new SessionStore()
): Server => {
  return createServer((req, res) => {
    void handleHttp(coordinator, sessions, req, res);
  });
};

const requireSession = (
  req: IncomingMessage,
  res: ServerResponse,
  sessions: SessionStore
): string | null => {
  const sessionId = parseSessionCookie(req.headers.cookie);
  if (!sessionId || !sessions.hasSession(sessionId)) {
    sendJson(req, res, 401, {
      error: "unauthorized",
      message: "Valid session cookie required"
    });
    return null;
  }
  return sessionId;
};

const handleHttp = async (
  coordinator: RunCoordinator,
  sessions: SessionStore,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> => {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const pathname = url.pathname;

  if (method === "OPTIONS") {
    res.writeHead(204, corsHeadersForRequest(req));
    res.end();
    return;
  }

  const route = parseRoute(pathname, method);

  try {
    if (route.kind === "get-health") {
      sendJson(req, res, 200, {
        status: "ok",
        service: "adventure-v2",
        ...healthOracleWireFields()
      });
      return;
    }

    if (route.kind === "post-session") {
      const sessionId = sessions.createSession();
      sendJson(
        req,
        res,
        201,
        createSessionResponseSchema.parse({ sessionId }),
        { "Set-Cookie": formatSessionCookie(sessionId) }
      );
      return;
    }

    if (route.kind === "post-pairing-codes") {
      const sessionId = requireSession(req, res, sessions);
      if (!sessionId) {
        return;
      }
      const issued = sessions.issuePairingCode(sessionId);
      sendJson(req, res, 201, issuePairingCodeResponseSchema.parse(issued));
      return;
    }

    if (route.kind === "post-pairing-redeem") {
      const raw = await readJsonBody(req);
      let body;
      try {
        body = redeemPairingCodeRequestSchema.parse(raw);
      } catch {
        sendJson(req, res, 400, { error: "bad_request", message: "Invalid pairing redeem body" });
        return;
      }
      const result = sessions.redeemPairingCode(body.code, body.deviceLabel);
      if (result === "unknown") {
        sendJson(req, res, 404, { error: "not_found", message: "Unknown pairing code" });
        return;
      }
      if (result === "expired" || result === "consumed") {
        sendJson(req, res, 410, {
          error: "pairing_code_unavailable",
          message: result === "expired" ? "Pairing code expired" : "Pairing code already used"
        });
        return;
      }
      sendJson(req, res, 200, redeemPairingCodeResponseSchema.parse(result));
      return;
    }

    if (route.kind === "post-inference-plan" || route.kind === "post-inference-navigator") {
      if (!requireSession(req, res, sessions)) {
        return;
      }
      const raw = await readJsonBody(req);
      inferenceRequestSchema.parse(raw);
      sendJson(req, res, 501, {
        error: "not_implemented",
        message: "Inference relay not wired yet (see I4)"
      });
      return;
    }

    if (route.kind === "get-inference-capabilities") {
      if (!requireSession(req, res, sessions)) {
        return;
      }
      sendJson(req, res, 501, {
        error: "not_implemented",
        message: "Inference capabilities not wired yet (see I4)"
      });
      return;
    }

    if (route.kind === "post-runs") {
      const raw = await readJsonBody(req);
      const body = createRunRequestSchema.parse(raw);
      const started = coordinator.startRun(body.config);
      const response: CreateRunResponse = createRunResponseSchema.parse({
        runId: started.runId,
        config: started.config
      });
      sendJson(req, res, 201, response);
      return;
    }

    if (route.kind === "post-turn") {
      const raw = await readJsonBody(req);
      const body = postTurnRequestSchema.parse(raw);
      await coordinator.processTurn(route.runId, body.input, {
        forceReject: body.forceReject
      });
      res.writeHead(204, corsHeadersForRequest(req));
      res.end();
      return;
    }

    if (route.kind === "get-events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        ...corsHeadersForRequest(req)
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
        sendJson(req, res, 200, listCheckpointsResponseSchema.parse(checkpoints));
      } catch (err) {
        if (isUnknownRunError(err)) {
          sendJson(req, res, 404, { error: "not_found", message: (err as Error).message });
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
        sendJson(req, res, 400, { error: "bad_request", message: "Invalid replay request body" });
        return;
      }
      try {
        const restore = coordinator.replay(body.checkpointId);
        if (restore.runId !== route.runId) {
          sendJson(req, res, 404, {
            error: "not_found",
            message: "Checkpoint does not belong to this run"
          });
          return;
        }
        sendJson(req, res, 200, postReplayResponseSchema.parse(restore));
      } catch (err) {
        if (isUnknownCheckpointError(err) || isUnknownRunError(err)) {
          sendJson(req, res, 404, { error: "not_found", message: (err as Error).message });
          return;
        }
        throw err;
      }
      return;
    }

    sendJson(req, res, 404, { error: "not_found" });
  } catch (err) {
    if (err instanceof JsonBodyTooLargeError) {
      sendJson(req, res, 413, {
        error: "payload_too_large",
        message: err.message
      });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    sendJson(req, res, 400, { error: "bad_request", message });
  }
};

export const listenAdventureServer = (
  coordinator: RunCoordinator,
  port: number,
  host: string = "127.0.0.1",
  sessions: SessionStore = new SessionStore()
): Promise<{ server: Server; port: number; baseUrl: string }> => {
  const server = createAdventureHttpServer(coordinator, sessions);
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
