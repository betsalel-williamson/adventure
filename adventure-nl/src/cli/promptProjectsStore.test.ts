import { describe, expect, it } from "vitest";
import {
  parsePromptProjectJson,
  upgradePromptProjectToLatest,
} from "./promptProjectsStore.js";

describe("promptProjectsStore", () => {
  it("parses legacy schema v1", () => {
    const raw = {
      schemaVersion: 1,
      id: "p1",
      name: "Legacy",
      createdAt: "a",
      updatedAt: "b",
      promptExperiment: { systemMode: "default" },
      generationParams: {},
      subsystemToggles: {},
    };
    const rec = parsePromptProjectJson(raw, "p1");
    expect(rec?.schemaVersion).toBe(1);
  });

  it("parses v2 with optional fields", () => {
    const raw = {
      schemaVersion: 2,
      id: "p2",
      name: "V2",
      createdAt: "a",
      updatedAt: "b",
      promptExperiment: { systemMode: "default" },
      generationParams: {},
      subsystemToggles: {},
      maxMoves: 99,
      tags: ["team:x"],
      strategy: { id: "explore" },
    };
    const rec = parsePromptProjectJson(raw, "p2");
    expect(rec?.maxMoves).toBe(99);
    expect(rec?.tags).toEqual(["team:x"]);
    expect(rec?.strategy?.id).toBe("explore");
  });

  it("upgradePromptProjectToLatest bumps v1 to v2", () => {
    const v1 = parsePromptProjectJson(
      {
        schemaVersion: 1,
        id: "z",
        name: "n",
        createdAt: "a",
        updatedAt: "b",
        promptExperiment: {},
        generationParams: {},
        subsystemToggles: {},
      },
      "z",
    );
    expect(v1).not.toBeNull();
    const up = upgradePromptProjectToLatest(v1!);
    expect(up.schemaVersion).toBe(2);
  });
});
