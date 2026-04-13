import { describe, expect, it } from "vitest";
import { dispatchGlueMcpJsonRpc } from "./protocol.js";

describe("Glue MCP JSON-RPC protocol (ADR0016)", () => {
  it("returns null for notifications/initialized without id", async () => {
    const res = await dispatchGlueMcpJsonRpc({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    expect(res).toBeNull();
  });

  it("initialize returns MCP protocolVersion 2025-11-25", async () => {
    const res = await dispatchGlueMcpJsonRpc({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "test", version: "0" },
      },
    });
    expect(res).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2025-11-25",
        capabilities: { tools: {} },
        serverInfo: { name: "adventure-nl-glue", version: "0.1.0" },
      },
    });
  });

  it("tools/list returns registered glue tools", async () => {
    const res = await dispatchGlueMcpJsonRpc({
      jsonrpc: "2.0",
      id: "a",
      method: "tools/list",
      params: {},
    });
    const tools = (res as { result: { tools: { name: string }[] } }).result
      .tools;
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "apply_heuristics",
      "get_exploration_summary",
      "ingest_transcript_delta",
      "map_current_state",
    ]);
  });

  it("tools/call runs map_current_state", async () => {
    const snap = {
      current: { x: 0, y: 0, z: 0 },
      currentGraphNodeId: "k_0_0_0",
      cells: [],
      exitOutcomes: {},
      directedEdges: [],
      triedCommandsByNode: {},
      nonLocationActionsByNode: {},
    };
    const res = await dispatchGlueMcpJsonRpc({
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: {
        name: "map_current_state",
        arguments: { snapshot: snap },
      },
    });
    const content = (res as { result: { content: { text: string }[] } }).result
      .content;
    expect(JSON.parse(content[0]!.text).cellCount).toBe(0);
  });

  it("rejects unknown JSON-RPC methods", async () => {
    const res = await dispatchGlueMcpJsonRpc({
      jsonrpc: "2.0",
      id: 2,
      method: "resources/list",
    });
    expect(res).toMatchObject({
      jsonrpc: "2.0",
      id: 2,
      error: { code: -32601 },
    });
  });
});
