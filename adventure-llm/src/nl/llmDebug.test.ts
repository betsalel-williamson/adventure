import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  appendInteractionLog,
  cacheFilePath,
  cacheKeyFor,
  readCachedInterpreted,
  writeCachedInterpreted,
} from "./llmDebug.js";

describe("llmDebug", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    delete process.env.ADVENTURE_LLM_DEBUG;
    delete process.env.ADVENTURE_LLM_DEBUG_LOG;
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("cacheKeyFor is stable for same userText and model", () => {
    expect(cacheKeyFor("go east", "gemini-2.5-flash")).toBe(
      cacheKeyFor("go east", "gemini-2.5-flash"),
    );
    expect(cacheKeyFor("go east", "gemini-2.5-flash")).not.toBe(
      cacheKeyFor("go west", "gemini-2.5-flash"),
    );
  });

  it("cacheKeyFor differs when providerId is included", () => {
    expect(cacheKeyFor("go east", "m", "google")).not.toEqual(
      cacheKeyFor("go east", "m", "http"),
    );
  });

  it("writeCachedInterpreted round-trips readCachedInterpreted", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "adv-llm-cache-"));
    try {
      const key = cacheKeyFor("x", "m");
      await writeCachedInterpreted(dir, key, {
        primaryToken: "EAST",
        confidence: 0.9,
      });
      const got = await readCachedInterpreted(dir, key);
      expect(got).toEqual({ primaryToken: "EAST", confidence: 0.9 });
      expect(cacheFilePath(dir, key)).toMatch(/\.json$/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("appendInteractionLog writes JSONL when ADVENTURE_LLM_DEBUG_LOG is set", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "adv-llm-log-"));
    const logPath = path.join(dir, "events.jsonl");
    process.env.ADVENTURE_LLM_DEBUG_LOG = logPath;

    await appendInteractionLog({ event: "test", foo: 1 });
    const text = await readFile(logPath, "utf8");
    const row = JSON.parse(text.trim()) as {
      event: string;
      foo: number;
      ts: string;
    };
    expect(row.event).toBe("test");
    expect(row.foo).toBe(1);
    expect(row.ts).toMatch(/^\d{4}-/);

    await rm(dir, { recursive: true, force: true });
  });
});
