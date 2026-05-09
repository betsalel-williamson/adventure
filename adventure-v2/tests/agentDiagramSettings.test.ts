import { describe, expect, it } from "vitest";
import {
  effectiveBrainMermaid,
  effectiveControlMermaid,
  type AgentDiagramStorage
} from "../apps/web/src/agentDiagramSettings.js";

describe("agentDiagramSettings", () => {
  it("uses bundled when stored is null or useBundled", () => {
    expect(effectiveBrainMermaid("BUNDLED", null)).toBe("BUNDLED");
    const s: AgentDiagramStorage = { useBundled: true, brain: "x" };
    expect(effectiveBrainMermaid("BUNDLED", s)).toBe("BUNDLED");
  });

  it("uses custom brain/control when useBundled false and text non-empty", () => {
    const s: AgentDiagramStorage = {
      useBundled: false,
      brain: "graph TD\n  A-->B",
      control: "flowchart LR\n  x-->y"
    };
    expect(effectiveBrainMermaid("BUNDLED", s)).toContain("A-->B");
    expect(effectiveControlMermaid("CTRL", s)).toContain("x-->y");
  });

  it("falls back to bundled when custom text empty", () => {
    const s: AgentDiagramStorage = { useBundled: false, brain: "   ", control: "" };
    expect(effectiveBrainMermaid("BUNDLED", s)).toBe("BUNDLED");
    expect(effectiveControlMermaid("CTRL", s)).toBe("CTRL");
  });
});
