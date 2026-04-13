import { describe, expect, it, vi } from "vitest";
import { GlueMcpWorkerHost } from "../browser/glueMcp/glueMcpWorkerHost.js";

type MessageListener = (event: MessageEvent<unknown>) => void;

class FakeWorker {
  private listener: MessageListener | null = null;
  readonly sent: unknown[] = [];
  terminated = false;

  addEventListener(_type: "message", listener: MessageListener): void {
    this.listener = listener;
  }

  postMessage(message: unknown): void {
    this.sent.push(message);
  }

  emit(data: unknown): void {
    this.listener?.({ data } as MessageEvent<unknown>);
  }

  terminate(): void {
    this.terminated = true;
  }
}

describe("GlueMcpWorkerHost", () => {
  it("initialize sends initialize then notifications/initialized", async () => {
    const worker = new FakeWorker();
    const host = new GlueMcpWorkerHost(worker as unknown as Worker);

    const initPromise = host.initialize();
    expect(worker.sent).toHaveLength(1);
    expect(worker.sent[0]).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
    });

    worker.emit({ jsonrpc: "2.0", id: 1, result: { ready: true } });
    await initPromise;

    expect(worker.sent).toHaveLength(2);
    expect(worker.sent[1]).toMatchObject({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
  });

  it("toolsList resolves the JSON-RPC result payload", async () => {
    const worker = new FakeWorker();
    const host = new GlueMcpWorkerHost(worker as unknown as Worker);

    const listPromise = host.toolsList();
    worker.emit({
      jsonrpc: "2.0",
      id: 1,
      result: { tools: [{ name: "map_current_state" }] },
    });

    await expect(listPromise).resolves.toEqual({
      tools: [{ name: "map_current_state" }],
    });
  });

  it("toolsCall resolves typed MCP call result payload", async () => {
    const worker = new FakeWorker();
    const host = new GlueMcpWorkerHost(worker as unknown as Worker);

    const callPromise = host.toolsCall("map_current_state", {});
    worker.emit({
      jsonrpc: "2.0",
      id: 1,
      result: { content: [{ type: "text", text: '{"ok":true}' }] },
    });

    await expect(callPromise).resolves.toEqual({
      content: [{ type: "text", text: '{"ok":true}' }],
    });
  });

  it("rejects malformed success response missing result", async () => {
    const worker = new FakeWorker();
    const host = new GlueMcpWorkerHost(worker as unknown as Worker);

    const listPromise = host.toolsList();
    worker.emit({ jsonrpc: "2.0", id: 1 });

    await expect(listPromise).rejects.toThrow(/tools\/list.*missing result/i);
  });

  it("rejects malformed tools/list result shape", async () => {
    const worker = new FakeWorker();
    const host = new GlueMcpWorkerHost(worker as unknown as Worker);

    const listPromise = host.toolsList();
    worker.emit({
      jsonrpc: "2.0",
      id: 1,
      result: { tools: [{ label: "wrong-key" }] },
    });

    await expect(listPromise).rejects.toThrow(/tools\/list.*invalid result/i);
  });

  it("rejects when worker returns JSON-RPC error", async () => {
    const worker = new FakeWorker();
    const host = new GlueMcpWorkerHost(worker as unknown as Worker);

    const callPromise = host.toolsCall("map_current_state", {});
    worker.emit({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32603, message: "boom" },
    });

    await expect(callPromise).rejects.toThrow("boom");
  });

  it("rejects timed out requests and cleans pending slots", async () => {
    vi.useFakeTimers();
    const worker = new FakeWorker();
    const host = new GlueMcpWorkerHost(worker as unknown as Worker, 50);

    const listPromise = host.toolsList();
    const rejection = expect(listPromise).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(51);
    await rejection;

    // Late responses after timeout are ignored and must not throw.
    worker.emit({ jsonrpc: "2.0", id: 1, result: { tools: [] } });
    vi.useRealTimers();
  });

  it("terminate rejects in-flight requests", async () => {
    const worker = new FakeWorker();
    const host = new GlueMcpWorkerHost(worker as unknown as Worker);

    const listPromise = host.toolsList();
    host.terminate();

    await expect(listPromise).rejects.toThrow(/terminated/);
    expect(worker.terminated).toBe(true);
  });
});
