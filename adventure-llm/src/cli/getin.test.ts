import { describe, expect, it } from "vitest";
import { getin } from "./getin.js";

describe("getin", () => {
  it("parses single word into first five columns", () => {
    const g = getin("north");
    expect(g.a.trim()).toBe("NORTH");
    expect(g.twowds).toBe(false);
  });

  it("uppercases letters", () => {
    const g = getin("take lamp");
    expect(g.a.trim()).toBe("TAKE");
    expect(g.wd2.trim()).toBe("LAMP");
  });

  it("sets twowds when space after column 2 with remainder", () => {
    const g = getin("take lamp");
    expect(g.twowds).toBe(true);
  });
});
