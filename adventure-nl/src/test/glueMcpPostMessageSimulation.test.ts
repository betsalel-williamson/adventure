import { describe, expect, it } from "vitest";
import { dispatchGlueMcpJsonRpc } from "@adventure-nl/nl-glue";

/**
 * Contract: same JSON-RPC envelopes the Worker uses over `postMessage` (ADR0016 C2).
 */
describe("Glue MCP postMessage-shaped JSON-RPC (host ↔ Worker contract)", () => {
  it("runs initialize → tools/list → tools/call on serialized messages", async () => {
    const init = await dispatchGlueMcpJsonRpc({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "test", version: "0" },
      },
    });
    expect(init).toMatchObject({ jsonrpc: "2.0", id: 1, result: {} });

    const listed = await dispatchGlueMcpJsonRpc({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });
    const tools = (listed as { result: { tools: { name: string }[] } }).result
      .tools;
    expect(tools.length).toBeGreaterThanOrEqual(4);

    const called = await dispatchGlueMcpJsonRpc({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "ingest_transcript_delta",
        arguments: { gameOutput: "I DON'T UNDERSTAND THAT\n" },
      },
    });
    const text = (called as { result: { content: { text: string }[] } }).result
      .content[0]!.text;
    expect(JSON.parse(text).parserRejection).toBe(true);
  });
});
