import { afterEach, describe, expect, it } from "vitest";
import {
  resolveBrowserOrchestratedAutoplayFromEnv,
  resolveEffectiveBrowserOrchestratedAutoplay,
} from "./browserOrchestrationEnv.js";

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

describe("resolveEffectiveBrowserOrchestratedAutoplay (MLX vs browser planner)", () => {
  it("returns false when env would allow browser path but provider is mlx", () => {
    expect(
      resolveEffectiveBrowserOrchestratedAutoplay(true, {
        textLlmConfigured: true,
        textLlmProviderId: "mlx",
      }),
    ).toBe(false);
  });

  it("returns true for google or http when env is on and a pool exists", () => {
    expect(
      resolveEffectiveBrowserOrchestratedAutoplay(true, {
        textLlmConfigured: true,
        textLlmProviderId: "google",
      }),
    ).toBe(true);
    expect(
      resolveEffectiveBrowserOrchestratedAutoplay(true, {
        textLlmConfigured: true,
        textLlmProviderId: "http",
      }),
    ).toBe(true);
  });

  it("returns false when env disables browser orchestration regardless of provider", () => {
    expect(
      resolveEffectiveBrowserOrchestratedAutoplay(false, {
        textLlmConfigured: true,
        textLlmProviderId: "google",
      }),
    ).toBe(false);
  });

  it("returns true when no text LLM pool is configured (session bootstrap / tests)", () => {
    expect(
      resolveEffectiveBrowserOrchestratedAutoplay(true, {
        textLlmConfigured: false,
        textLlmProviderId: "mlx",
      }),
    ).toBe(true);
  });
});
