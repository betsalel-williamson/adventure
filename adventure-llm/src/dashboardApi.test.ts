import { describe, expect, it, vi } from "vitest";
import { createDashboardApi } from "../public/dashboardApi.js";

describe("createDashboardApi", () => {
  it("getAutoplayMode GETs /api/autoplay-mode", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    const api = createDashboardApi({ fetch });
    await api.getAutoplayMode();
    expect(fetch).toHaveBeenCalledWith("/api/autoplay-mode");
  });

  it("postAutoplayMode sends JSON body", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    const api = createDashboardApi({ fetch });
    await api.postAutoplayMode(true);
    expect(fetch).toHaveBeenCalledWith("/api/autoplay-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plannerEnabled: true }),
    });
  });

  it("postMlxModelCancel POSTs cancel endpoint", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    const api = createDashboardApi({ fetch });
    await api.postMlxModelCancel();
    expect(fetch).toHaveBeenCalledWith("/api/mlx-model/cancel", {
      method: "POST",
    });
  });
});
