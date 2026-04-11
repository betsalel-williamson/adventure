import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadDatFile } from "../../../../src/dat/loadDat.js";
import { getHelpInstructionText, walkLLineChain } from "@adventure-llm/nl-glue";
const datPath = path.join(fileURLToPath(new URL(".", import.meta.url)), "../../../../../adventure.dat");
describe("speak", () => {
    it("walks long description for location 1", () => {
        const db = loadDatFile(datPath);
        const head = db.ltext.get(1);
        const lines = [...walkLLineChain(db, head)];
        expect(lines.join(" ")).toContain("ROAD");
    });
    it("loads HELP instruction text from RTEXT (same as Fortran SPEAK for HELP)", () => {
        const db = loadDatFile(datPath);
        const help = getHelpInstructionText(db);
        expect(help.length).toBeGreaterThan(100);
        expect(help).toContain("I KNOW OF PLACES");
        expect(help).toContain("GOOD LUCK!");
    });
});
//# sourceMappingURL=speak.test.js.map