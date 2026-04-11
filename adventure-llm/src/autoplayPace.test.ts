import { describe, expect, it } from "vitest";
import {
  AUTOPLAY_PACE_PRESETS,
  snapPaceMsToPreset,
} from "../public/autoplayPace.js";

const normalMs = AUTOPLAY_PACE_PRESETS.find((p) => p.ms === 500)?.ms ?? 500;

describe("autoplayPace", () => {
  it("snapPaceMsToPreset preserves zero for benchmark mode", () => {
    expect(snapPaceMsToPreset(0)).toBe(0);
  });

  it("snapPaceMsToPreset returns Normal ms for non-finite input", () => {
    expect(snapPaceMsToPreset(NaN)).toBe(normalMs);
    expect(snapPaceMsToPreset("x")).toBe(normalMs);
  });

  it("snapPaceMsToPreset snaps to nearest preset", () => {
    expect(snapPaceMsToPreset(100)).toBe(100);
    expect(snapPaceMsToPreset(130)).toBe(100);
    expect(snapPaceMsToPreset(170)).toBe(200);
    expect(snapPaceMsToPreset(2500)).toBe(3000);
  });
});
