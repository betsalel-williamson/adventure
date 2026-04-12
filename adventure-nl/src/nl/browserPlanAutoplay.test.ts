import { afterEach, describe, expect, it, vi } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadDatFile } from "../dat/loadDat.js";
import { planAutoplayInBrowser } from "./browserPlanAutoplay.js";

const datPath = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../adventure.dat",
);

describe("planAutoplayInBrowser (http)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("parses planner JSON from OpenAI-compatible chat response", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  primaryToken: "EAST",
                  continuePlaying: true,
                }),
              },
            },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const db = loadDatFile(datPath);
    const plan = await planAutoplayInBrowser(
      db,
      {
        plannerUserPrompt: "test",
        includeDatHelpInSystem: false,
      },
      {
        providerId: "http",
        modelId: "m",
        browserPlanner: {
          httpBaseUrl: "http://127.0.0.1:11434/v1",
          httpUseJsonSchema: false,
        },
      },
    );

    expect(plan.primaryToken).toBe("EAST");
    expect(fetchSpy).toHaveBeenCalled();
    const [, init] = fetchSpy.mock.calls[0]!;
    expect(init.method).toBe("POST");
    vi.unstubAllGlobals();
  });
});
