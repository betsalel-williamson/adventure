import { describe, expect, it } from "vitest";
import {
  DEFAULT_ASSISTANCE_POSTURE_ID,
  describeAssistancePosture,
  formatAssistancePostureForPanel,
  formatDefaultAssistancePostureForPanel
} from "./assistancePosture.js";

describe("assistancePosture", () => {
  it("defaults to Quick assist", () => {
    expect(DEFAULT_ASSISTANCE_POSTURE_ID).toBe("quickAssist");
    expect(describeAssistancePosture(DEFAULT_ASSISTANCE_POSTURE_ID).label).toBe("Quick assist");
  });

  it("formatAssistancePostureForPanel pins plain-language rules and draft-apply policy", () => {
    expect(formatAssistancePostureForPanel("quickAssist")).toEqual([
      "Current posture: Quick assist",
      "",
      "What to expect:",
      "· Short suggestions tied to what you already see on the CRT.",
      "· Small steps; each assist stays easy to scan before you continue playing.",
      "",
      "What this posture avoids:",
      "· Running the game for you or issuing commands without your input.",
      "· Heavy orchestration chrome on the main transcript.",
      "",
      "Draft maps and apply:",
      "· If a draft map offers an apply action in a future build, this posture asks you to confirm before anything changes beyond previews.",
      "· There is no apply control in this build — the Fortran game remains the source of truth."
    ]);
  });

  it("formatDefaultAssistancePostureForPanel matches the default id", () => {
    expect(formatDefaultAssistancePostureForPanel()).toEqual(
      formatAssistancePostureForPanel(DEFAULT_ASSISTANCE_POSTURE_ID)
    );
  });
});
