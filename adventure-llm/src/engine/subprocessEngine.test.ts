import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { existsSync } from "node:fs";
import { normalizeTranscript, runFortranScript } from "./subprocessEngine.js";

const repoRoot = path.join(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const adventureBin = path.join(repoRoot, "adventure");

describe.runIf(existsSync(adventureBin))("runFortranScript", () => {
  it("east from start matches expected room (oracle)", () => {
    const out = normalizeTranscript(
      runFortranScript(["n", "east"], { cwd: repoRoot, adventureBinary: adventureBin }),
    );
    expect(out).toContain("WELL HOUSE");
    expect(out).toContain("END OF A ROAD");
  });
});
