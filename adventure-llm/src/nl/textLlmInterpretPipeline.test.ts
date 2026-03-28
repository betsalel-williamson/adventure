import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadDatFile } from "../dat/loadDat.js";
import {
  finalizeAutoplayPlannerResponse,
  finalizeInterpretedCommand,
} from "./textLlmInterpretPipeline.js";

const datPath = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../adventure.dat",
);

describe("finalizeInterpretedCommand", () => {
  it("snaps unknown primary to fallback and applies repair", () => {
    const db = loadDatFile(datPath);
    const out = finalizeInterpretedCommand(
      db,
      "xyzzy",
      { primaryToken: "ZZZZZ" },
      undefined,
    );
    expect(out.primaryToken).toBe("EAST");
  });
});

describe("finalizeAutoplayPlannerResponse", () => {
  it("preserves continuePlaying and coerces tokens", () => {
    const db = loadDatFile(datPath);
    const out = finalizeAutoplayPlannerResponse(
      db,
      {
        primaryToken: "ZZZZZ",
        secondaryToken: undefined,
        continuePlaying: false,
      },
      undefined,
    );
    expect(out.continuePlaying).toBe(false);
    expect(out.primaryToken).toBe("EAST");
  });
});
