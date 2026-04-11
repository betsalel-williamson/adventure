import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadDatFile } from "../dat/loadDat.js";
import {
  instructionIntentToHelpCommand,
  interpretedToGetinLine,
} from "@adventure-nl/nl-glue";
import { validateAgainstVocab } from "./gemini.js";

const datPath = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../adventure.dat",
);

describe("instructionIntentToHelpCommand", () => {
  it("maps a natural-language request for instructions to HELP (not LOOK)", () => {
    const cmd = instructionIntentToHelpCommand(
      "I would like some instructions please",
    );
    expect(cmd).not.toBeNull();
    expect(cmd?.primaryToken).toBe("HELP");
    expect(interpretedToGetinLine(cmd!)).toMatch(/^HELP/);
  });

  it("maps explicit help and hints", () => {
    expect(instructionIntentToHelpCommand("help")?.primaryToken).toBe("HELP");
    expect(instructionIntentToHelpCommand("any hints?")?.primaryToken).toBe(
      "HELP",
    );
  });

  it("does not fire on unrelated input", () => {
    expect(instructionIntentToHelpCommand("go east")).toBeNull();
    expect(instructionIntentToHelpCommand("look")).toBeNull();
  });

  it("HELP is valid vocabulary", () => {
    const db = loadDatFile(datPath);
    const cmd = instructionIntentToHelpCommand("instructions please");
    expect(cmd).not.toBeNull();
    expect(validateAgainstVocab(db, cmd!)).toBe(true);
  });
});
