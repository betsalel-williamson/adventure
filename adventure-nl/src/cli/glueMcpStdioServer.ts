import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  callGlueMcpTool,
  type GlueMcpToolDescriptor,
  listGlueMcpToolDescriptors,
} from "@adventure-nl/nl-glue";

/**
 * Node stdio MCP server for Glue (Mind) tools — same registry as Worker JSON-RPC (ADR0016 C3).
 * Execution MCP (Body) over webDashboard is deferred (ADR0016 C4); ADR0005 keeps HTTP/SSE + GETIN as the spine.
 */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Keep stdio argument shape in lockstep with nl-glue descriptors.
 * Canonical validation still happens in `callGlueMcpTool`.
 */
function zodInputShapeForDescriptor(
  descriptor: GlueMcpToolDescriptor,
): Record<string, z.ZodTypeAny> {
  const schema = descriptor.inputSchema;
  if (!isRecord(schema)) {
    return {};
  }
  const properties = isRecord(schema.properties) ? schema.properties : {};
  const required = Array.isArray(schema.required)
    ? new Set(schema.required.filter((v): v is string => typeof v === "string"))
    : new Set<string>();
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const name of Object.keys(properties)) {
    shape[name] = required.has(name) ? z.unknown() : z.unknown().optional();
  }
  return shape;
}

export async function runGlueMcpStdioServer(): Promise<void> {
  const server = new McpServer({
    name: "adventure-nl-glue",
    version: "0.1.0",
  });

  for (const d of listGlueMcpToolDescriptors()) {
    const inputSchema = zodInputShapeForDescriptor(d);
    server.registerTool(
      d.name,
      { description: d.description, inputSchema },
      async (args: Record<string, unknown>) => {
        const r = await callGlueMcpTool(d.name, args);
        if (r.isError === true) {
          return { isError: true as const, content: [...r.content] };
        }
        return { content: [...r.content] };
      },
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
