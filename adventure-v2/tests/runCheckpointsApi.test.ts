import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRunCheckpoints } from "../apps/web/src/runCheckpointsApi.js";

describe("fetchRunCheckpoints", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns checkpoints when GET succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve({
          ok: true,
          json: async () => [{ checkpointId: "cp-1" }]
        })
      )
    );

    const r = await fetchRunCheckpoints("http://127.0.0.1:8787", "run-a");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.checkpoints).toEqual([{ checkpointId: "cp-1" }]);
    }
  });

  it("returns status when GET fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve({
          ok: false,
          status: 404
        })
      )
    );

    const r = await fetchRunCheckpoints("http://127.0.0.1:8787", "missing");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(404);
    }
  });
});
