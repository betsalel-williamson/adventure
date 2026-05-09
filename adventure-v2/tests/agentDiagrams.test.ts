import { describe, expect, it } from "vitest";
import {
  BRAIN_GRAPH_MERMAID,
  CONTROL_INVALID_ROUTING_STATE,
  CONTROL_MACHINE_MERMAID,
  CONTROL_PHASE_LABELS
} from "../apps/web/src/agentDiagrams.js";

describe("agentDiagrams", () => {
  it("includes every ControlPhase label in the XState Mermaid source", () => {
    for (const phase of CONTROL_PHASE_LABELS) {
      expect(CONTROL_MACHINE_MERMAID).toContain(phase);
    }
    expect(CONTROL_MACHINE_MERMAID).toContain(CONTROL_INVALID_ROUTING_STATE);
  });

  it("exports non-empty brain Mermaid from LangGraph codegen", () => {
    expect(BRAIN_GRAPH_MERMAID.length).toBeGreaterThan(20);
    expect(BRAIN_GRAPH_MERMAID).toMatch(/perceive/);
    expect(BRAIN_GRAPH_MERMAID).toMatch(/plan/);
    expect(BRAIN_GRAPH_MERMAID).toMatch(/act/);
  });
});
