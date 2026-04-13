/**
 * Host-side helper for Glue MCP over Worker `postMessage` (ADR0016 C2).
 * ADR0005 orchestration can own sequencing; this class is transport only.
 */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

type PendingRequest = {
  readonly method: string;
  readonly resolve: (v: unknown) => void;
  readonly reject: (e: Error) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
};

export type GlueMcpToolsListResult = {
  readonly tools: readonly {
    readonly name: string;
    readonly description?: string;
    readonly inputSchema?: Record<string, unknown>;
  }[];
};

export type GlueMcpToolsCallResult = {
  readonly content: readonly { readonly type: "text"; readonly text: string }[];
  readonly isError?: boolean;
};

function parseToolsListResult(
  method: string,
  raw: unknown,
): GlueMcpToolsListResult {
  if (!isRecord(raw)) {
    throw new Error(`Glue MCP ${method} invalid result: expected object`);
  }
  if (!Array.isArray(raw.tools)) {
    throw new Error(`Glue MCP ${method} invalid result: expected tools array`);
  }
  for (const tool of raw.tools) {
    if (!isRecord(tool) || typeof tool.name !== "string") {
      throw new Error(
        `Glue MCP ${method} invalid result: expected tool entries with name`,
      );
    }
  }
  return raw as GlueMcpToolsListResult;
}

function parseToolsCallResult(
  method: string,
  raw: unknown,
): GlueMcpToolsCallResult {
  if (!isRecord(raw)) {
    throw new Error(`Glue MCP ${method} invalid result: expected object`);
  }
  if (!Array.isArray(raw.content)) {
    throw new Error(
      `Glue MCP ${method} invalid result: expected content array`,
    );
  }
  for (const entry of raw.content) {
    if (
      !isRecord(entry) ||
      entry.type !== "text" ||
      typeof entry.text !== "string"
    ) {
      throw new Error(
        `Glue MCP ${method} invalid result: expected text content entries`,
      );
    }
  }
  if (Object.hasOwn(raw, "isError") && typeof raw.isError !== "boolean") {
    throw new Error(
      `Glue MCP ${method} invalid result: expected boolean isError`,
    );
  }
  return raw as GlueMcpToolsCallResult;
}

export class GlueMcpWorkerHost {
  private static readonly DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
  private nextId = 1;
  private readonly pending = new Map<number | string, PendingRequest>();

  constructor(
    private readonly worker: Worker,
    private readonly requestTimeoutMs = GlueMcpWorkerHost.DEFAULT_REQUEST_TIMEOUT_MS,
  ) {
    this.worker.addEventListener("message", (ev: MessageEvent<unknown>) => {
      const data = ev.data;
      if (!isRecord(data) || data.jsonrpc !== "2.0") return;
      if (!Object.hasOwn(data, "id")) return;
      const id = data.id as number | string | null;
      if (id === null) return;
      const slot = this.pending.get(id);
      if (!slot) return;
      clearTimeout(slot.timeout);
      this.pending.delete(id);
      if ("error" in data && data.error !== undefined) {
        const errObj = data.error;
        const message =
          isRecord(errObj) && typeof errObj.message === "string"
            ? errObj.message
            : JSON.stringify(errObj);
        slot.reject(new Error(message));
      } else {
        if (!Object.hasOwn(data, "result")) {
          slot.reject(new Error(`Glue MCP ${slot.method} missing result`));
          return;
        }
        slot.resolve(data.result);
      }
    });
  }

  private rejectAndDeletePending(id: number | string, error: Error): void {
    const pending = this.pending.get(id);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(id);
    pending.reject(error);
  }

  private rpc(method: string, params?: unknown): Promise<unknown> {
    const id = this.nextId++;
    const msg: Record<string, unknown> = {
      jsonrpc: "2.0",
      id,
      method,
      params: params ?? {},
    };
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.rejectAndDeletePending(
          id,
          new Error(
            `Glue MCP worker request timed out for method ${method} after ${this.requestTimeoutMs}ms`,
          ),
        );
      }, this.requestTimeoutMs);
      this.pending.set(id, { method, resolve, reject, timeout });
      try {
        this.worker.postMessage(msg);
      } catch (e) {
        this.rejectAndDeletePending(
          id,
          new Error(
            e instanceof Error ? e.message : "Failed to post message to worker",
          ),
        );
      }
    });
  }

  async initialize(): Promise<void> {
    await this.rpc("initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "adventure-nl-dashboard", version: "0.1.0" },
    });
    this.worker.postMessage({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
  }

  async toolsList(): Promise<GlueMcpToolsListResult> {
    const result = await this.rpc("tools/list", {});
    if (result === undefined) {
      throw new Error("Glue MCP tools/list missing result");
    }
    return parseToolsListResult("tools/list", result);
  }

  async toolsCall(
    name: string,
    args: unknown,
  ): Promise<GlueMcpToolsCallResult> {
    const result = await this.rpc("tools/call", {
      name,
      arguments: args,
    });
    if (result === undefined) {
      throw new Error("Glue MCP tools/call missing result");
    }
    return parseToolsCallResult("tools/call", result);
  }

  terminate(): void {
    for (const [id] of this.pending) {
      this.rejectAndDeletePending(
        id,
        new Error("Glue MCP worker host terminated with pending requests"),
      );
    }
    this.worker.terminate();
  }
}
