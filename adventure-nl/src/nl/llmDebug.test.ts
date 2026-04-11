import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  appendInteractionLog,
  cacheFilePath,
  cacheKeyFor,
  readCachedInterpreted,
  runWithWebDashboardLlmLogContext,
  sanitizeInteractionLogRecord,
  writeCachedInterpreted,
} from "./llmDebug.js";

describe("llmDebug", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    delete process.env.ADVENTURE_NL_DEBUG;
    delete process.env.ADVENTURE_NL_DEBUG_LOG;
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

  it("sanitizeInteractionLogRecord truncates long prompt fields", () => {
    const prevMax = process.env.ADVENTURE_NL_DEBUG_MAX_PROMPT_CHARS;
    process.env.ADVENTURE_NL_DEBUG_MAX_PROMPT_CHARS = "40";
    try {
      const long = "x".repeat(100);
      const row = sanitizeInteractionLogRecord({
        event: "t",
        prompt: long,
        userText: "ok",
      }) as { prompt: string };
      expect(row.prompt.length).toBeLessThan(long.length);
      expect(row.prompt).toContain("truncated");
    } finally {
      if (prevMax === undefined) {
        delete process.env.ADVENTURE_NL_DEBUG_MAX_PROMPT_CHARS;
      } else {
        process.env.ADVENTURE_NL_DEBUG_MAX_PROMPT_CHARS = prevMax;
      }
    }
  });

  it("appendInteractionLog writes JSONL when ADVENTURE_NL_DEBUG_LOG is set", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "adv-llm-log-"));
    const logPath = path.join(dir, "events.jsonl");
    process.env.ADVENTURE_NL_DEBUG_LOG = logPath;

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

  it("appendInteractionLog writes per-session JSONL when ADVENTURE_NL_DEBUG and ALS context", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "adv-llm-sesslog-"));
    const prevCwd = process.cwd();
    process.chdir(dir);
    process.env.ADVENTURE_NL_DEBUG = "1";
    delete process.env.ADVENTURE_NL_DEBUG_LOG;
    const sid = "aaaaaaaa-bbbb-4ccc-bddd-eeeeeeeeeeee";
    try {
      await runWithWebDashboardLlmLogContext(sid, async () => {
        await appendInteractionLog({ event: "sess_test", n: 2 });
      });
      const logPath = path.join(dir, ".cache", "llm-sessions", `${sid}.jsonl`);
      const text = await readFile(logPath, "utf8");
      const row = JSON.parse(text.trim()) as {
        event: string;
        n: number;
        sessionId: string;
        ts: string;
      };
      expect(row.event).toBe("sess_test");
      expect(row.n).toBe(2);
      expect(row.sessionId).toBe(sid);
    } finally {
      process.chdir(prevCwd);
      await rm(dir, { recursive: true, force: true });
    }
  });
});
