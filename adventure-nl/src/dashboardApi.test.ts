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
    expect(fetch).toHaveBeenCalledWith("/api/autoplay-mode", {
      credentials: "same-origin",
    });
  });

  it("postAutoplayMode sends JSON body", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    const api = createDashboardApi({ fetch });
    await api.postAutoplayMode(true);
    expect(fetch).toHaveBeenCalledWith("/api/autoplay-mode", {
      credentials: "same-origin",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plannerEnabled: true }),
    });
  });

  it("postNlInterpret POSTs /api/nl/interpret (thin NL request/response)", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, scripted: "EAST    " }),
    });
    const api = createDashboardApi({ fetch });
    await api.postNlInterpret({ natural: "go east" });
    expect(fetch).toHaveBeenCalledWith("/api/nl/interpret", {
      credentials: "same-origin",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ natural: "go east" }),
    });
  });

  it("postEngineInput POSTs /api/engine/input", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    const api = createDashboardApi({ fetch });
    await api.postEngineInput({ getinLine: "EAST    " });
    expect(fetch).toHaveBeenCalledWith("/api/engine/input", {
      credentials: "same-origin",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ getinLine: "EAST    " }),
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
      credentials: "same-origin",
      method: "POST",
    });
  });
});
