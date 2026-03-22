import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { existsSync } from "node:fs";
import {
  normalizeInstructionsAnswer,
  normalizeTranscript,
  runFortranOpenThenFirstCommand,
  runFortranScript,
  transcriptSuggestsCommandRejected,
} from "./subprocessEngine.js";

const repoRoot = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../..",
);
const adventureBin = path.join(repoRoot, "adventure");

describe("transcriptSuggestsCommandRejected", () => {
  it("detects RTEXT-style parser rejections", () => {
    expect(transcriptSuggestsCommandRejected("I DON'T UNDERSTAND THAT!")).toBe(
      true,
    );
    expect(
      transcriptSuggestsCommandRejected(
        "sorry, but i am not allowed to give more detail. i will",
      ),
    ).toBe(true);
    expect(transcriptSuggestsCommandRejected("YOU ARE IN A VALLEY.")).toBe(
      false,
    );
  });
});

describe("normalizeInstructionsAnswer", () => {
  it("maps yes/no variants to y/n", () => {
    expect(normalizeInstructionsAnswer("yes")).toBe("y");
    expect(normalizeInstructionsAnswer("Y")).toBe("y");
    expect(normalizeInstructionsAnswer("no thanks")).toBe("n");
    expect(normalizeInstructionsAnswer("N")).toBe("n");
  });
});

describe.runIf(existsSync(adventureBin))("runFortranScript", () => {
  it("east from start matches expected room (oracle)", () => {
    const out = normalizeTranscript(
      runFortranScript(["n", "east"], {
        cwd: repoRoot,
        adventureBinary: adventureBin,
      }),
    );
    expect(out).toContain("WELL HOUSE");
    expect(out).toContain("END OF A ROAD");
  });

  it("HELP after decline prints instruction text, not SPEAK(15) (repeat-location)", () => {
    const raw = runFortranScript(["n", "HELP    "], {
      cwd: repoRoot,
      adventureBinary: adventureBin,
    });
    const out = normalizeTranscript(raw);
    expect(out).toContain("I KNOW OF PLACES");
    expect(out).not.toContain("NOT ALLOWED TO GIVE MORE DETAIL");
  });
});

describe.runIf(existsSync(adventureBin))(
  "runFortranOpenThenFirstCommand",
  () => {
    it("shows instructions question, then n + east reaches well house", async () => {
      const raw = await runFortranOpenThenFirstCommand({
        cwd: repoRoot,
        adventureBinary: adventureBin,
        getInstructionsAnswer: async () => "n",
        getFirstCommandLine: async (ctx) => {
          expect(ctx.transcriptSoFar.length).toBeGreaterThan(50);
          expect(ctx.transcriptSoFar.toUpperCase()).toContain("INSTRUCTIONS");
          return "east    ";
        },
      });
      const out = normalizeTranscript(raw);
      expect(raw).toContain("WOULD YOU LIKE INSTRUCTIONS");
      expect(out).toContain("WELL HOUSE");
      expect(raw).not.toContain("End of file");
    });
  },
);
