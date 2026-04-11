import { describe, expect, it } from "vitest";
import { locationImageCacheKey } from "./locationImages.js";

describe("locationImages", () => {
  it("cache key is stable", () => {
    expect(locationImageCacheKey(3, "abc")).toBe(
      locationImageCacheKey(3, "abc"),
    );
    expect(locationImageCacheKey(3, "abc")).not.toBe(
      locationImageCacheKey(4, "abc"),
    );
  });
});
