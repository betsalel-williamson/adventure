import { afterEach, describe, expect, it, vi } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadDatFile } from "../../dat/loadDat.js";
import { HttpOpenAiCompatibleTextLlm } from "./httpOpenAiCompatibleTextLlm.js";

const datPath = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../adventure.dat",
);

describe("HttpOpenAiCompatibleTextLlm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("interpretPlayerInput posts chat completion and parses JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          choices: [
            {
              message: { content: '{"primaryToken":"EAST","confidence":0.9}' },
            },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const llm = new HttpOpenAiCompatibleTextLlm({
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "gemma2:2b",
      useJsonSchemaResponseFormat: false,
    });
    const db = loadDatFile(datPath);
    const r = await llm.interpretPlayerInput("walk east", db, {});

    expect(r.primaryToken).toBe("EAST");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("chat/completions");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(init?.body as string) as { model: string };
    expect(body.model).toBe("gemma2:2b");
  });

  it("planAutoplay parses continuePlaying", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content: '{"primaryToken":"QUIT","continuePlaying":false}',
              },
            },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const llm = new HttpOpenAiCompatibleTextLlm({
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "m",
      useJsonSchemaResponseFormat: false,
    });
    const db = loadDatFile(datPath);
    const r = await llm.planAutoplay(db, {
      plannerUserPrompt: "You are playing Adventure. Next move?",
    });
    expect(r.primaryToken).toBe("QUIT");
    expect(r.continuePlaying).toBe(false);
  });

  it("includes response_format json_schema when useJsonSchemaResponseFormat is true", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  '{"primaryToken":"EAST","secondaryToken":null,"confidence":null,"continuePlaying":true}',
              },
            },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const llm = new HttpOpenAiCompatibleTextLlm({
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "gpt-4o-mini",
      useJsonSchemaResponseFormat: true,
    });
    const db = loadDatFile(datPath);
    await llm.planAutoplay(db, {
      plannerUserPrompt: "Next?",
    });

    const init = fetchMock.mock.calls[0]![1] as { body: string };
    const body = JSON.parse(init.body) as {
      response_format?: { type: string; json_schema?: { strict?: boolean } };
    };
    expect(body.response_format?.type).toBe("json_schema");
    expect(body.response_format?.json_schema?.strict).toBe(true);
  });
});
