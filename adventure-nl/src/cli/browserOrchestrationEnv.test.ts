import { afterEach, describe, expect, it } from "vitest";
import { resolveBrowserOrchestratedAutoplayFromEnv } from "./browserOrchestrationEnv.js";

describe("resolveBrowserOrchestratedAutoplayFromEnv (client NL vs Node glue)", () => {
  afterEach(() => {
    delete process.env.ADVENTURE_NL_BROWSER_ORCHESTRATED_AUTOPLAY;
  });

  it("defaults to true when the env var is unset (NL glue runs in the browser)", () => {
    delete process.env.ADVENTURE_NL_BROWSER_ORCHESTRATED_AUTOPLAY;
    expect(resolveBrowserOrchestratedAutoplayFromEnv()).toBe(true);
  });

  it("defaults to true when the env var is empty or whitespace", () => {
    process.env.ADVENTURE_NL_BROWSER_ORCHESTRATED_AUTOPLAY = "   ";
    expect(resolveBrowserOrchestratedAutoplayFromEnv()).toBe(true);
  });

  it.each([
    ["0", false],
    ["false", false],
    ["no", false],
    ["off", false],
  ] as const)(
    "treats %s as server-side autoplay (no client glue path)",
    (val, expected) => {
      process.env.ADVENTURE_NL_BROWSER_ORCHESTRATED_AUTOPLAY = val;
      expect(resolveBrowserOrchestratedAutoplayFromEnv()).toBe(expected);
    },
  );

  it.each([["1"], ["true"], ["yes"], ["on"]] as const)(
    "treats %s as browser-orchestrated autoplay",
    (val) => {
      process.env.ADVENTURE_NL_BROWSER_ORCHESTRATED_AUTOPLAY = val;
      expect(resolveBrowserOrchestratedAutoplayFromEnv()).toBe(true);
    },
  );
});
