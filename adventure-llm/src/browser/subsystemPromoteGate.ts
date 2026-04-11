/**
 * ADR0009: Pure rules for promoting a subsystem revision to the live runtime tag.
 * "Run tests" records a `test_pass` promotion; `live` tag updates require a qualifying pass.
 */

/** Tag name pointing at the revision driving browser glue/cognition (ADR0007/0009). */
export const SUBSYSTEM_LIVE_REVISION_TAG_NAME = "live" as const;

export const SUBSYSTEM_PROMOTION_KIND_TEST_PASS = "test_pass" as const;

/** Detail shape recorded alongside {@link SUBSYSTEM_PROMOTION_KIND_TEST_PASS}. */
export type SubsystemTestPassPromotionDetail = {
  /** Total test cases executed; must be >= 1 (fail closed on empty suite). */
  readonly casesRun: number;
  readonly casesFailed: number;
};

export type PromotionEventForGate = {
  readonly kind: string;
  readonly detail: unknown;
};

export class LivePromotionBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LivePromotionBlockedError";
  }
}

export function parseTestPassDetail(detail: unknown):
  | {
      readonly ok: true;
      readonly casesRun: number;
      readonly casesFailed: number;
    }
  | { readonly ok: false; readonly reason: string } {
  if (detail === null || typeof detail !== "object") {
    return { ok: false, reason: "test_pass detail must be an object" };
  }
  const d = detail as Record<string, unknown>;
  const casesRun = d.casesRun;
  const casesFailed = d.casesFailed;
  if (typeof casesRun !== "number" || !Number.isFinite(casesRun)) {
    return {
      ok: false,
      reason: "test_pass detail.casesRun must be a finite number",
    };
  }
  if (typeof casesFailed !== "number" || !Number.isFinite(casesFailed)) {
    return {
      ok: false,
      reason: "test_pass detail.casesFailed must be a finite number",
    };
  }
  if (
    !Number.isInteger(casesRun) ||
    casesRun < 0 ||
    !Number.isInteger(casesFailed) ||
    casesFailed < 0
  ) {
    return {
      ok: false,
      reason: "test counts must be non-negative integers",
    };
  }
  return { ok: true, casesRun, casesFailed };
}

/**
 * True when this revision has at least one qualifying `test_pass` row (ADR0009).
 * Fail closed: empty suite (casesRun 0) or any failed cases blocks promotion.
 */
export function revisionHasQualifyingTestPass(
  events: readonly PromotionEventForGate[],
): boolean {
  for (const e of events) {
    if (e.kind !== SUBSYSTEM_PROMOTION_KIND_TEST_PASS) continue;
    const parsed = parseTestPassDetail(e.detail);
    if (!parsed.ok) continue;
    if (parsed.casesRun < 1) continue;
    if (parsed.casesFailed !== 0) continue;
    return true;
  }
  return false;
}

export function assertRevisionEligibleForLiveTag(
  events: readonly PromotionEventForGate[],
): void {
  if (revisionHasQualifyingTestPass(events)) return;
  throw new LivePromotionBlockedError(
    "cannot promote revision to live: require at least one test_pass promotion with casesRun>=1 and casesFailed=0 (ADR0009)",
  );
}
