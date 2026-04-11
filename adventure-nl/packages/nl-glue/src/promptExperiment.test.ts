import { describe, expect, it } from "vitest";
import {
  applyPlannerPromptExperiment,
  defaultPromptExperimentPatch,
  patchPromptExperimentPatch,
} from "@adventure-nl/nl-glue";

describe("applyPlannerPromptExperiment", () => {
  it("leaves baseline when patch is empty", () => {
    const base = { system: "SYS", user: "USR" };
    const out = applyPlannerPromptExperiment(
      base,
      defaultPromptExperimentPatch(),
    );
    expect(out).toEqual(base);
  });

  it("appends to system and wraps user", () => {
    const base = { system: "A", user: "B" };
    const out = applyPlannerPromptExperiment(base, {
      systemMode: "append",
      systemText: "more",
      userPrefix: "P",
      userSuffix: "S",
    });
    expect(out).toEqual({
      system: "A\n\nmore",
      user: "P\nB\nS",
    });
  });

  it("replaces system and prepends model notes to user_top", () => {
    const base = { system: "old", user: "body" };
    const out = applyPlannerPromptExperiment(base, {
      systemMode: "replace",
      systemText: "newsys",
      modelNotes: "NOTE",
      modelNotesTarget: "user_top",
    });
    expect(typeof out).toBe("object");
    if (typeof out === "string") throw new Error("expected object");
    expect(out.system).toBe("newsys");
    expect(out.user).toBe("NOTE\n\nbody");
  });

  it("applies model notes to system when target is system", () => {
    const base = { system: "s", user: "u" };
    const out = applyPlannerPromptExperiment(base, {
      modelNotes: "X",
      modelNotesTarget: "system",
    });
    expect(out).toEqual({ system: "s\n\nX", user: "u" });
  });

  it("handles string baseline with append", () => {
    const out = applyPlannerPromptExperiment("base", {
      systemMode: "append",
      systemText: "instr",
      userPrefix: "pre",
    });
    expect(out).toBe("pre\ninstr\n\nbase");
  });

  it("replace on string drops baseline content", () => {
    const out = applyPlannerPromptExperiment("gone", {
      systemMode: "replace",
      systemText: "only",
    });
    expect(out).toBe("only");
  });
});

describe("patchPromptExperimentPatch", () => {
  it("merges partial body", () => {
    const cur = defaultPromptExperimentPatch();
    const next = patchPromptExperimentPatch(cur, {
      systemMode: "replace",
      includeDatHelpInSystem: false,
    });
    expect(next.systemMode).toBe("replace");
    expect(next.includeDatHelpInSystem).toBe(false);
    expect(next.systemText).toBe("");
  });
});
