import { describe, expect, it } from "vitest";
import { createDashboardState } from "../public/dashboardState.js";

describe("createDashboardState", () => {
  it("returns independent mutable bags", () => {
    const a = createDashboardState();
    const b = createDashboardState();
    a.transcriptBlocks.push({ step: 1, parts: ["x"] });
    expect(b.transcriptBlocks).toHaveLength(0);
  });
});
