import { describe, expect, it } from "vitest";
import {
  ASSISTANCE_POSTURE_STORAGE_KEY,
  DEFAULT_ASSISTANCE_POSTURE_ID,
  ORDERED_ASSISTANCE_POSTURE_IDS,
  POSTURE_CHANGE_STALE_NOTICE,
  describeAssistancePosture,
  formatAssistancePostureForPanel,
  formatDefaultAssistancePostureForPanel,
  formatPostureChangeAcknowledgment,
  isAssistancePostureId,
  parseStoredAssistancePostureId,
} from "./assistancePosture.js";

describe("assistancePosture", () => {
  it("defaults to Quick assist", () => {
    expect(DEFAULT_ASSISTANCE_POSTURE_ID).toBe("quickAssist");
    expect(describeAssistancePosture(DEFAULT_ASSISTANCE_POSTURE_ID).label).toBe(
      "Quick assist",
    );
  });

  it("exposes ordered ids for UI", () => {
    expect(ORDERED_ASSISTANCE_POSTURE_IDS).toEqual([
      "quickAssist",
      "studyFirst",
    ]);
  });

  it("storage key is namespaced", () => {
    expect(ASSISTANCE_POSTURE_STORAGE_KEY).toBe(
      "adventure-langgraph-assistance-posture",
    );
  });

  it("isAssistancePostureId narrows known ids", () => {
    expect(isAssistancePostureId("quickAssist")).toBe(true);
    expect(isAssistancePostureId("studyFirst")).toBe(true);
    expect(isAssistancePostureId("dryRun")).toBe(false);
    expect(isAssistancePostureId("")).toBe(false);
  });

  it("parseStoredAssistancePostureId falls back on invalid or null", () => {
    expect(parseStoredAssistancePostureId(null)).toBe("quickAssist");
    expect(parseStoredAssistancePostureId("")).toBe("quickAssist");
    expect(parseStoredAssistancePostureId("bogus")).toBe("quickAssist");
    expect(parseStoredAssistancePostureId("studyFirst")).toBe("studyFirst");
  });

  it("formatAssistancePostureForPanel pins plain-language rules for Quick assist", () => {
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
      "· There is no apply control in this build — the Fortran game remains the source of truth.",
    ]);
  });

  it("formatAssistancePostureForPanel pins Study first rules", () => {
    expect(formatAssistancePostureForPanel("studyFirst")).toEqual([
      "Current posture: Study first",
      "",
      "What to expect:",
      "· Confirmation before assists change drafts or suggestion stacks beyond what you already see.",
      "· Clear pauses when a step could alter previews — you stay in control of what applies.",
      "",
      "What this posture avoids:",
      "· Running the game for you or issuing commands without your input.",
      "· Silent apply of drafts or assists without an explicit confirm step while this posture is active.",
      "",
      "Draft maps and apply:",
      "· Any apply action on a draft map will wait for your confirmation while this posture is active.",
      "· There is no apply control in this build — the Fortran game remains the source of truth.",
    ]);
  });

  it("formatDefaultAssistancePostureForPanel matches the default id", () => {
    expect(formatDefaultAssistancePostureForPanel()).toEqual(
      formatAssistancePostureForPanel(DEFAULT_ASSISTANCE_POSTURE_ID),
    );
  });

  it("formatPostureChangeAcknowledgment uses everyday labels", () => {
    expect(formatPostureChangeAcknowledgment("quickAssist")).toBe(
      "Posture set to Quick assist.",
    );
    expect(formatPostureChangeAcknowledgment("studyFirst")).toBe(
      "Posture set to Study first.",
    );
  });

  it("stale notice copy is bounded and honest", () => {
    expect(POSTURE_CHANGE_STALE_NOTICE.length).toBeGreaterThan(20);
    expect(POSTURE_CHANGE_STALE_NOTICE.toLowerCase()).toContain("previews");
  });
});
