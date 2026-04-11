import { describe, expect, it } from "vitest";
import {
  assertRevisionEligibleForLiveTag,
  LivePromotionBlockedError,
  parseTestPassDetail,
  revisionHasQualifyingTestPass,
  SUBSYSTEM_LIVE_REVISION_TAG_NAME,
  SUBSYSTEM_PROMOTION_KIND_TEST_PASS,
} from "./subsystemPromoteGate.js";

describe("subsystemPromoteGate (ADR0009)", () => {
  it("defines the live revision tag name as live", () => {
    expect(SUBSYSTEM_LIVE_REVISION_TAG_NAME).toBe("live");
  });

  it("parses valid test_pass detail with integer counts", () => {
    const p = parseTestPassDetail({ casesRun: 3, casesFailed: 0 });
    expect(p.ok).toBe(true);
    if (!p.ok) throw new Error("expected ok");
    expect(p.casesRun).toBe(3);
    expect(p.casesFailed).toBe(0);
  });

  it("rejects non-object test_pass detail", () => {
    expect(parseTestPassDetail(null).ok).toBe(false);
    expect(parseTestPassDetail("x").ok).toBe(false);
  });

  it("rejects missing or non-finite casesRun / casesFailed", () => {
    expect(parseTestPassDetail({}).ok).toBe(false);
    expect(parseTestPassDetail({ casesRun: 1 }).ok).toBe(false);
    expect(parseTestPassDetail({ casesRun: NaN, casesFailed: 0 }).ok).toBe(
      false,
    );
  });

  it("revisionHasQualifyingTestPass is false with no events", () => {
    expect(revisionHasQualifyingTestPass([])).toBe(false);
  });

  it("fail closed: test_pass with casesRun 0 does not qualify", () => {
    expect(
      revisionHasQualifyingTestPass([
        {
          kind: SUBSYSTEM_PROMOTION_KIND_TEST_PASS,
          detail: { casesRun: 0, casesFailed: 0 },
        },
      ]),
    ).toBe(false);
  });

  it("fail closed: test_pass with casesFailed > 0 does not qualify", () => {
    expect(
      revisionHasQualifyingTestPass([
        {
          kind: SUBSYSTEM_PROMOTION_KIND_TEST_PASS,
          detail: { casesRun: 2, casesFailed: 1 },
        },
      ]),
    ).toBe(false);
  });

  it("qualifies when at least one test_pass has casesRun>=1 and casesFailed=0", () => {
    expect(
      revisionHasQualifyingTestPass([
        {
          kind: SUBSYSTEM_PROMOTION_KIND_TEST_PASS,
          detail: { casesRun: 1, casesFailed: 0 },
        },
      ]),
    ).toBe(true);
  });

  it("ignores non-test_pass kinds", () => {
    expect(
      revisionHasQualifyingTestPass([
        { kind: "note", detail: {} },
        {
          kind: SUBSYSTEM_PROMOTION_KIND_TEST_PASS,
          detail: { casesRun: 1, casesFailed: 0 },
        },
      ]),
    ).toBe(true);
  });

  it("assertRevisionEligibleForLiveTag throws LivePromotionBlockedError when gate fails", () => {
    expect(() => assertRevisionEligibleForLiveTag([])).toThrow(
      LivePromotionBlockedError,
    );
  });

  it("assertRevisionEligibleForLiveTag succeeds when gate passes", () => {
    expect(() =>
      assertRevisionEligibleForLiveTag([
        {
          kind: SUBSYSTEM_PROMOTION_KIND_TEST_PASS,
          detail: { casesRun: 1, casesFailed: 0 },
        },
      ]),
    ).not.toThrow();
  });
});
