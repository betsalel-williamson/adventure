import { describe, expect, it } from "vitest";
import { scriptedGetinLineFromInterpreted } from "./plannerToScriptedGetin.js";

describe("scriptedGetinLineFromInterpreted", () => {
  it("returns a plain GETIN string when there is no secondary to swap", () => {
    const line = scriptedGetinLineFromInterpreted({
      primaryToken: "EAST",
    });
    expect(line).toBe("EAST      ");
  });

  it("returns line + retry when swap yields a different GETIN line", () => {
    const line = scriptedGetinLineFromInterpreted({
      primaryToken: "LAMP",
      secondaryToken: "TAKE",
    });
    expect(line).toEqual({
      line: "LAMP TAKE ",
      retryIfRejected: "TAKE LAMP ",
    });
  });
});
