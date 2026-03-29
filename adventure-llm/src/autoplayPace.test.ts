import { describe, expect, it } from "vitest";
import {
  AUTOPLAY_PACE_PRESETS,
  snapPaceMsToPreset,
} from "../public/autoplayPace.js";

describe("autoplayPace", () => {
  it("snapPaceMsToPreset returns Normal ms for non-finite input", () => {
    expect(snapPaceMsToPreset(NaN)).toBe(AUTOPLAY_PACE_PRESETS[2].ms);
    expect(snapPaceMsToPreset("x")).toBe(AUTOPLAY_PACE_PRESETS[2].ms);
  });

  it("snapPaceMsToPreset snaps to nearest preset", () => {
    expect(snapPaceMsToPreset(100)).toBe(100);
    expect(snapPaceMsToPreset(130)).toBe(100);
    expect(snapPaceMsToPreset(170)).toBe(200);
    expect(snapPaceMsToPreset(2500)).toBe(3000);
  });
});
