import { describe, expect, it } from "vitest";
import { stubPlanNextMove } from "../apps/web/src/stubAutoplayPlanner.js";

describe("stubAutoplayPlanner", () => {
  it("cycles deterministically by moveIndex", () => {
    expect(stubPlanNextMove({ moveIndex: 0 })).toBe("look");
    expect(stubPlanNextMove({ moveIndex: 1 })).toBe("north");
    expect(stubPlanNextMove({ moveIndex: 5 })).toBe("inventory");
    expect(stubPlanNextMove({ moveIndex: 6 })).toBe("look");
  });

  it("accepts custom cycle", () => {
    expect(stubPlanNextMove({ moveIndex: 0 }, ["a", "b"])).toBe("a");
    expect(stubPlanNextMove({ moveIndex: 1 }, ["a", "b"])).toBe("b");
    expect(stubPlanNextMove({ moveIndex: 2 }, ["a", "b"])).toBe("a");
  });
});
