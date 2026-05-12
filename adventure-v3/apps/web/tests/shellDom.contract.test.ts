import { describe, expect, it } from "vitest";
import { loadShellIndexBodyIntoDocument } from "./harness/loadShellDom.js";

const REQUIRED_SHELL_IDS = [
  "crt-transcript",
  "crt-viewport",
  "command-input",
  "status-strip",
  "exploration-map-panel",
  "exploration-map-mermaid-visual",
  "exploration-map-status",
  "v3-legacy-assist-panels",
  "crt-side-panel-root",
] as const;

describe("shell DOM contract (index.html)", () => {
  it("exposes ids the CRT shell and exploration map wiring expect", () => {
    loadShellIndexBodyIntoDocument();

    for (const id of REQUIRED_SHELL_IDS) {
      const el = document.getElementById(id);
      expect(
        el,
        `#${id} must exist in index.html for main / harness`,
      ).not.toBeNull();
    }
  });
});
