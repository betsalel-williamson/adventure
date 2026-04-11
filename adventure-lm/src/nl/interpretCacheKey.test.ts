import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { interpretCacheKeyFromBuildOptions } from "./interpretCacheKey.js";

describe("interpretCacheKeyFromBuildOptions", () => {
  const prev = process.env.ADVENTURE_LM_CACHE_SCHEMA_VERSION;

  beforeEach(() => {
    delete process.env.ADVENTURE_LM_CACHE_SCHEMA_VERSION;
  });

  afterEach(() => {
    if (prev === undefined)
      delete process.env.ADVENTURE_LM_CACHE_SCHEMA_VERSION;
    else process.env.ADVENTURE_LM_CACHE_SCHEMA_VERSION = prev;
  });

  it("differs when recent game text differs", () => {
    const a = interpretCacheKeyFromBuildOptions({
      userText: "take it",
      modelId: "m",
      providerId: "http",
      recentGameText: "ROOM A WITH THE KEYS",
      compact: true,
      structuredDashboard: false,
    });
    const b = interpretCacheKeyFromBuildOptions({
      userText: "take it",
      modelId: "m",
      providerId: "http",
      recentGameText: "ROOM B WITH THE LAMP",
      compact: true,
      structuredDashboard: false,
    });
    expect(a).not.toBe(b);
  });

  it("differs when compact/layout flags differ", () => {
    const base = {
      userText: "east",
      modelId: "m",
      providerId: "mlx" as const,
      recentGameText: "You are outside.",
      structuredDashboard: false,
    };
    expect(
      interpretCacheKeyFromBuildOptions({ ...base, compact: true }),
    ).not.toBe(interpretCacheKeyFromBuildOptions({ ...base, compact: false }));
  });
});
