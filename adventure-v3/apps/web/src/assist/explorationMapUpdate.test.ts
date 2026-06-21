import { beforeEach, describe, expect, it, vi } from "vitest";

const postAssistIngest = vi.hoisted(() => vi.fn());

vi.mock("../api/assistClient.js", () => ({
  postAssistIngest,
}));

vi.mock("../featureFlags.js", () => ({
  v3FeatureFlags: {
    explorationMap: true,
    locationAgent: true,
    assistPanels: false,
    mapProbe: false,
    mapInspectors: false,
  },
}));

vi.mock("./draftMapMermaidRender.js", () => ({
  renderDraftMermaidMap: vi.fn().mockResolvedValue(undefined),
}));

import {
  refreshExplorationMapFromTranscript,
  resetExplorationMapState,
} from "./explorationMapUpdate.js";

const explorationEls = (): {
  mermaidVisual: HTMLDivElement;
  mermaidPre: HTMLPreElement;
  status: HTMLParagraphElement;
} => ({
  mermaidVisual: document.createElement("div"),
  mermaidPre: document.createElement("pre"),
  status: document.createElement("p"),
});

describe("refreshExplorationMapFromTranscript", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetExplorationMapState();
    postAssistIngest.mockResolvedValue({
      ok: false,
      error: "test stub — local merge",
    });
  });

  it("clears merged graph when runId changes (falls back to local merge)", async () => {
    const els = explorationEls();
    const t1 = "YOU ARE IN HALLWAY.\n> NORTH\nYOU ARE AT END OF ROAD WEST.";
    await refreshExplorationMapFromTranscript({
      runId: "run-a",
      transcript: t1,
      els,
    });
    expect(els.mermaidPre.textContent ?? "").toMatch(/HALLWAY/i);

    await refreshExplorationMapFromTranscript({
      runId: "run-b",
      transcript: "YOU ARE STANDING BEFORE A LARGE STONE HOUSE.",
      els,
    });
    expect(els.mermaidPre.textContent ?? "").toMatch(/STONE HOUSE/i);
    expect(els.mermaidPre.textContent ?? "").not.toMatch(/HALLWAY/i);
  });

  it("sets status when ingest succeeds but map JSON does not parse", async () => {
    postAssistIngest.mockResolvedValue({
      ok: true,
      mapJson: { notARealGraph: true },
      mermaid: "",
    });
    const els = explorationEls();
    await refreshExplorationMapFromTranscript({
      runId: "run-x",
      transcript: "YOU ARE IN FOYER.",
      els,
    });
    expect(els.status.textContent).toContain("unreadable");
    expect(els.status.textContent).toContain("local merge");
    expect(els.mermaidPre.textContent ?? "").toMatch(/FOYER/i);
  });
});
