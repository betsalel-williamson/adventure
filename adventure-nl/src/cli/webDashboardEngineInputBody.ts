import type { ScriptedGetinLine } from "../engine/subprocessEngine.js";

/**
 * Parse POST /api/engine/input JSON into a {@link ScriptedGetinLine}, or `undefined` if missing.
 */
export function parseScriptedLineFromEngineJsonBody(body: {
  scripted?: unknown;
  getinLine?: unknown;
}): ScriptedGetinLine | undefined {
  if (body.scripted !== undefined && body.scripted !== null) {
    if (typeof body.scripted === "string") return body.scripted;
    if (
      typeof body.scripted === "object" &&
      body.scripted !== null &&
      "line" in body.scripted &&
      typeof (body.scripted as { line: unknown }).line === "string"
    ) {
      return body.scripted as ScriptedGetinLine;
    }
  }
  if (typeof body.getinLine === "string" && body.getinLine.trim() !== "") {
    return body.getinLine.trimEnd();
  }
  return undefined;
}

/** Primary GETIN line for SSE / logging when {@link ScriptedGetinLine} may be structured. */
export function scriptedPrimaryLine(s: ScriptedGetinLine): string {
  return typeof s === "string" ? s : s.line;
}
