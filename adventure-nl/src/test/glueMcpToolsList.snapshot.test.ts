import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listGlueMcpToolDescriptors } from "@adventure-nl/nl-glue";

describe("Glue MCP tools/list snapshot (ADR0016 C3)", () => {
  it("matches the checked-in catalog for IDE hosts and CI drift detection", () => {
    const fixturePath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "fixtures",
      "glue-mcp-tools-list.snapshot.json",
    );
    const expected = JSON.parse(readFileSync(fixturePath, "utf8"));
    const live = listGlueMcpToolDescriptors();
    expect(live).toEqual(expected);
  });
});
