import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadDatFile } from "../dat/loadDat.js";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  adventureLlmAutoplayJsonFooter,
  buildAutoplayPlannerPrompt,
  buildInterpretSystemAndUserPrompt,
  linesForAutoplayPlannerContextBody,
  mlxAutoplaySystemPrompt,
  mlxAutoplaySystemPromptForVariant,
  resolveCompactPrompts,
  resolveFastInterpretPrompt,
  resolveInterpretPromptBuildOptions,
  resolveInterpretPromptExamples,
  recentGameTextSliceForInterpretPrompt,
  resolveMlxSystemPromptVariant,
  resolveAutoplayPromptMode,
  resolveStructuredDashboardPrompts,
  resolveVocabHintMaxWords,
} from "./adventureNlPrompts.js";

const repoRoot = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../..",
);
const datPath = path.join(repoRoot, "adventure.dat");

describe("resolveCompactPrompts", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    delete process.env.ADVENTURE_LLM_COMPACT_PROMPTS;
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("defaults mlx on and google off", () => {
    expect(resolveCompactPrompts("mlx")).toBe(true);
    expect(resolveCompactPrompts("google")).toBe(false);
    expect(resolveCompactPrompts("http")).toBe(false);
  });

  it("respects ADVENTURE_LLM_COMPACT_PROMPTS=0 and =1", () => {
    process.env.ADVENTURE_LLM_COMPACT_PROMPTS = "0";
    expect(resolveCompactPrompts("mlx")).toBe(false);
    process.env.ADVENTURE_LLM_COMPACT_PROMPTS = "1";
    expect(resolveCompactPrompts("google")).toBe(true);
  });
});

describe("resolveStructuredDashboardPrompts", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    delete process.env.ADVENTURE_LLM_STRUCTURED_PROMPTS;
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("defaults mlx on and google off", () => {
    expect(resolveStructuredDashboardPrompts("mlx")).toBe(true);
    expect(resolveStructuredDashboardPrompts("google")).toBe(false);
  });

  it("respects ADVENTURE_LLM_STRUCTURED_PROMPTS", () => {
    process.env.ADVENTURE_LLM_STRUCTURED_PROMPTS = "0";
    expect(resolveStructuredDashboardPrompts("mlx")).toBe(false);
    process.env.ADVENTURE_LLM_STRUCTURED_PROMPTS = "1";
    expect(resolveStructuredDashboardPrompts("google")).toBe(true);
  });
});

describe("MLX system prompt variants (ADVENTURE_LLM_MLX_SYSTEM_VARIANT)", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it("defaults to full when env unset", () => {
    delete process.env.ADVENTURE_LLM_MLX_SYSTEM_VARIANT;
    expect(resolveMlxSystemPromptVariant()).toBe("full");
  });

  it("respects compact, core, bare", () => {
    process.env.ADVENTURE_LLM_MLX_SYSTEM_VARIANT = "compact";
    expect(resolveMlxSystemPromptVariant()).toBe("compact");
    process.env.ADVENTURE_LLM_MLX_SYSTEM_VARIANT = "core";
    expect(resolveMlxSystemPromptVariant()).toBe("core");
    process.env.ADVENTURE_LLM_MLX_SYSTEM_VARIANT = "bare";
    expect(resolveMlxSystemPromptVariant()).toBe("bare");
  });

  it("maps unknown values to full", () => {
    process.env.ADVENTURE_LLM_MLX_SYSTEM_VARIANT = "nope";
    expect(resolveMlxSystemPromptVariant()).toBe("full");
  });

  it("orders variants by typical length: full > compact > core > bare (compact rules)", () => {
    const full = mlxAutoplaySystemPromptForVariant(true, "full", "full");
    const compact = mlxAutoplaySystemPromptForVariant(true, "compact", "full");
    const core = mlxAutoplaySystemPromptForVariant(true, "core", "full");
    const bare = mlxAutoplaySystemPromptForVariant(true, "bare", "full");
    expect(full.length).toBeGreaterThan(compact.length);
    expect(compact.length).toBeGreaterThan(core.length);
    expect(core.length).toBeGreaterThan(bare.length);
    expect(full).toContain("Cand");
    expect(compact).toContain("GETIN");
    expect(core).toContain("GETIN");
    expect(bare).toContain("JSON");
  });

  it("mlxAutoplaySystemPrompt uses env variant", () => {
    process.env.ADVENTURE_LLM_MLX_SYSTEM_VARIANT = "core";
    const p = mlxAutoplaySystemPrompt(true);
    expect(p).toBe(mlxAutoplaySystemPromptForVariant(true, "core"));
    delete process.env.ADVENTURE_LLM_MLX_SYSTEM_VARIANT;
    expect(mlxAutoplaySystemPrompt(true)).toBe(
      mlxAutoplaySystemPromptForVariant(true, "full"),
    );
  });

  it("mlxAutoplaySystemPromptForVariant appends loot funnel instructions when active", () => {
    const p = mlxAutoplaySystemPromptForVariant(true, "core", "full", true);
    expect(p).toMatch(/Loot gate/i);
    expect(p).toContain("Cand_Move");
  });
});

describe("resolveVocabHintMaxWords", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it("uses fewer words when compact and env unset", () => {
    delete process.env.ADVENTURE_LLM_VOCAB_HINT_MAX;
    expect(resolveVocabHintMaxWords(true)).toBe(48);
    expect(resolveVocabHintMaxWords(false)).toBe(120);
  });

  it("respects ADVENTURE_LLM_VOCAB_HINT_MAX", () => {
    process.env.ADVENTURE_LLM_VOCAB_HINT_MAX = "64";
    expect(resolveVocabHintMaxWords(false)).toBe(64);
    expect(resolveVocabHintMaxWords(true)).toBe(64);
  });
});

describe("compact NL prompts", () => {
  const db = loadDatFile(datPath);

  beforeEach(() => {
    process.env.ADVENTURE_LLM_VOCAB_CATEGORIES_FILE = path.join(
      tmpdir(),
      `nl-prompts-no-ai-vocab-${Date.now()}.json`,
    );
    delete process.env.ADVENTURE_LLM_VOCAB_AI_CATEGORIES;
  });

  it("compact interpret prompt uses HELP excerpt + cue, not full HELP preamble; shorter than full", () => {
    const full = buildInterpretSystemAndUserPrompt(db, "go east", "ROOM TEXT", {
      providerId: "google",
    });
    const compact = buildInterpretSystemAndUserPrompt(
      db,
      "go east",
      "ROOM TEXT",
      {
        compact: true,
        providerId: "google",
      },
    );
    expect(compact.length).toBeLessThan(full.length);
    expect(full).toMatch(/RTEXT|Official in-game HELP/i);
    expect(compact).not.toMatch(/Official in-game HELP text/);
    expect(compact).toMatch(/HELP excerpt|instructions, hints/i);
    expect(compact).toContain("JSON");
  });

  it("compact autoplay planner prompt omits HELP preamble", () => {
    const body = "vocab section only";
    const full = buildAutoplayPlannerPrompt(db, body, {});
    const compact = buildAutoplayPlannerPrompt(db, body, { compact: true });
    expect(full).toMatch(/adventure\.dat RTEXT|Official in-game HELP/i);
    expect(compact).not.toMatch(/Official in-game HELP/);
    expect(compact.startsWith(body)).toBe(true);
  });

  it("buildAutoplayPlannerPrompt omits HELP when includeDatHelpInSystem is false", () => {
    const body = "ctx";
    const p = buildAutoplayPlannerPrompt(db, body, {
      compact: false,
      includeDatHelpInSystem: false,
    });
    expect(p).not.toMatch(/Official in-game HELP/);
    expect(p.startsWith(body)).toBe(true);
  });

  it("split planner body merges without appending global JSON footer (system already defines keys)", () => {
    const footer = adventureLlmAutoplayJsonFooter();
    const stringPath = buildAutoplayPlannerPrompt(db, "body only", {
      compact: true,
    });
    expect(stringPath.endsWith(footer)).toBe(true);

    const merged = buildAutoplayPlannerPrompt(
      db,
      {
        system: mlxAutoplaySystemPrompt(true),
        user: "### STATE\nLocation: X\n",
      },
      { compact: true },
    );
    expect(merged).toContain("GETIN");
    expect(merged).toContain("### STATE");
    expect(merged.endsWith(footer)).toBe(false);
  });

  it("linesForAutoplayPlannerContextBody compact uses short role", () => {
    const lines = linesForAutoplayPlannerContextBody("EAST, WEST", {
      compact: true,
    });
    expect(lines[0]).toContain("adventurer");
    expect(lines.join("\n")).toMatch(/TAKE\/GET|TAKE or GET/);
  });

  it("structured interpret uses ### TASK and ### USER INPUT", () => {
    const p = buildInterpretSystemAndUserPrompt(db, "go east", "ROOM", {
      compact: true,
      structuredDashboard: true,
    });
    expect(p.indexOf("### TASK")).toBeLessThan(p.indexOf("### USER INPUT"));
    expect(p).toContain("### VOCABULARY HINT");
    expect(p).toContain("go east");
  });
});

describe("resolveInterpretPromptBuildOptions", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    delete process.env.ADVENTURE_LLM_COMPACT_PROMPTS;
    delete process.env.ADVENTURE_LLM_STRUCTURED_PROMPTS;
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("uses overrides when set", () => {
    expect(
      resolveInterpretPromptBuildOptions("google", {
        compact: true,
        structuredDashboard: true,
      }),
    ).toEqual({ compact: true, structuredDashboard: true });
  });

  it("falls back to env defaults for google when overrides omitted", () => {
    expect(resolveInterpretPromptBuildOptions("google", undefined)).toEqual({
      compact: false,
      structuredDashboard: false,
    });
  });
});

describe("recentGameTextSliceForInterpretPrompt", () => {
  it("returns empty for missing or blank input", () => {
    expect(recentGameTextSliceForInterpretPrompt(undefined, false)).toBe("");
    expect(recentGameTextSliceForInterpretPrompt("  \n ", true)).toBe("");
  });

  it("takes tail using compact vs full caps", () => {
    const long = "x".repeat(3000);
    const full = recentGameTextSliceForInterpretPrompt(long, false);
    const compact = recentGameTextSliceForInterpretPrompt(long, true);
    expect(full.length).toBe(2500);
    expect(compact.length).toBe(1200);
  });
});

describe("resolveInterpretPromptExamples (ADVENTURE_LLM_INTERPRET_PROMPT_EXAMPLES)", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env.ADVENTURE_LLM_VOCAB_CATEGORIES_FILE = path.join(
      tmpdir(),
      `examples-no-ai-vocab-${Date.now()}.json`,
    );
    delete process.env.ADVENTURE_LLM_VOCAB_AI_CATEGORIES;
    delete process.env.ADVENTURE_LLM_FAST_INTERPRET;
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("ADVENTURE_LLM_FAST_INTERPRET=1 disables examples for mlx", () => {
    delete process.env.ADVENTURE_LLM_INTERPRET_PROMPT_EXAMPLES;
    process.env.ADVENTURE_LLM_FAST_INTERPRET = "1";
    expect(resolveFastInterpretPrompt()).toBe(true);
    expect(resolveInterpretPromptExamples("mlx")).toBe(false);
  });

  it("defaults off when env unset and provider omitted", () => {
    delete process.env.ADVENTURE_LLM_INTERPRET_PROMPT_EXAMPLES;
    expect(resolveInterpretPromptExamples()).toBe(false);
    expect(resolveInterpretPromptExamples("google")).toBe(false);
  });

  it("defaults on for mlx when env unset", () => {
    delete process.env.ADVENTURE_LLM_INTERPRET_PROMPT_EXAMPLES;
    expect(resolveInterpretPromptExamples("mlx")).toBe(true);
  });

  it("ADVENTURE_LLM_INTERPRET_PROMPT_EXAMPLES=0 disables for mlx", () => {
    process.env.ADVENTURE_LLM_INTERPRET_PROMPT_EXAMPLES = "0";
    expect(resolveInterpretPromptExamples("mlx")).toBe(false);
  });

  it("when enabled, structured prompt includes ### EXAMPLES before ### USER INPUT", () => {
    process.env.ADVENTURE_LLM_INTERPRET_PROMPT_EXAMPLES = "1";
    const db = loadDatFile(datPath);
    const p = buildInterpretSystemAndUserPrompt(db, "north", undefined, {
      compact: true,
      structuredDashboard: true,
      providerId: "google",
    });
    expect(p).toContain("### EXAMPLES");
    expect(p.indexOf("### EXAMPLES")).toBeLessThan(p.indexOf("### USER INPUT"));
  });

  it("mlx providerId with env unset includes ### EXAMPLES in structured compact", () => {
    delete process.env.ADVENTURE_LLM_INTERPRET_PROMPT_EXAMPLES;
    const db = loadDatFile(datPath);
    const p = buildInterpretSystemAndUserPrompt(db, "north", undefined, {
      compact: true,
      structuredDashboard: true,
      providerId: "mlx",
    });
    expect(p).toContain("### EXAMPLES");
    expect(p.indexOf("### EXAMPLES")).toBeLessThan(p.indexOf("### USER INPUT"));
  });
});

describe("resolveAutoplayPromptMode", () => {
  const prev = process.env.ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE;

  afterEach(() => {
    if (prev === undefined)
      delete process.env.ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE;
    else process.env.ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE = prev;
  });

  it("defaults to explore", () => {
    delete process.env.ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE;
    expect(resolveAutoplayPromptMode()).toBe("explore");
  });

  it("returns full when env is full", () => {
    process.env.ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE = "full";
    expect(resolveAutoplayPromptMode()).toBe("full");
  });
});
