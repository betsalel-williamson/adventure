import {
  GLUE_MCP_SERVER_NAME,
  GLUE_MCP_SERVER_VERSION,
  callGlueMcpTool,
  listGlueMcpToolDescriptors,
} from "./registry.js";

export type JsonRpcId = string | number | null;

type JsonRpcSuccess = {
  readonly jsonrpc: "2.0";
  readonly id: JsonRpcId;
  readonly result: unknown;
};

type JsonRpcErrorBody = {
  readonly jsonrpc: "2.0";
  readonly id: JsonRpcId;
  readonly error: { readonly code: number; readonly message: string };
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function ok(id: JsonRpcId, result: unknown): JsonRpcSuccess {
  return { jsonrpc: "2.0", id, result };
}

function err(id: JsonRpcId, code: number, message: string): JsonRpcErrorBody {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

/**
 * Handle one MCP-shaped JSON-RPC 2.0 message (Worker `postMessage` or stdio line).
 * Returns `null` when the message is a notification that has no JSON-RPC response.
 */
export async function dispatchGlueMcpJsonRpc(
  raw: unknown,
): Promise<JsonRpcSuccess | JsonRpcErrorBody | null> {
  if (!isRecord(raw) || raw.jsonrpc !== "2.0") {
    return err(null, -32600, "Invalid Request");
  }

  const method = typeof raw.method === "string" ? raw.method : "";
  const hasId = Object.hasOwn(raw, "id");
  const id: JsonRpcId = hasId ? (raw.id as string | number | null) : null;

  if (!hasId) {
    if (method === "notifications/initialized") return null;
    return null;
  }

  try {
    switch (method) {
      case "initialize":
        return ok(id, {
          protocolVersion: "2025-11-25",
          capabilities: { tools: {} },
          serverInfo: {
            name: GLUE_MCP_SERVER_NAME,
            version: GLUE_MCP_SERVER_VERSION,
          },
        });
      case "tools/list":
        return ok(id, {
          tools: listGlueMcpToolDescriptors().map((d) => ({
            name: d.name,
            description: d.description,
            inputSchema: d.inputSchema,
          })),
        });
      case "tools/call": {
        const p = isRecord(raw.params) ? raw.params : {};
        const name = typeof p.name === "string" ? p.name : "";
        const toolArgs = Object.hasOwn(p, "arguments") ? p.arguments : {};
        const result = await callGlueMcpTool(name, toolArgs);
        return ok(id, result);
      }
      default:
        return err(id, -32601, `Method not found: ${method}`);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return err(id, -32603, message);
  }
}
