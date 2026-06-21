import { describe, expect, it } from "vitest";
import {
  formatBackendSummary,
  readBackendConfigFromEnv,
  resolveWebclientBackends,
} from "./config.js";

describe("readBackendConfigFromEnv", () => {
  it("defaults to v2 game + langgraph assist + no agent backend", () => {
    const config = readBackendConfigFromEnv({});
    expect(config.game).toBe("v2-http");
    expect(config.assist).toBe("langgraph");
    expect(config.agent).toBe("none");
    expect(config.gameBaseUrl).toBe("http://127.0.0.1:8787");
    expect(config.assistBaseUrl).toBe("http://127.0.0.1:8790");
  });

  it("honors explicit backend env overrides", () => {
    const config = readBackendConfigFromEnv({
      VITE_WEBCLIENT_GAME_BACKEND: "nl-dashboard",
      VITE_WEBCLIENT_ASSIST_BACKEND: "ag2",
      VITE_WEBCLIENT_AGENT_BACKEND: "nl-glue-browser",
      VITE_API_URL: "http://127.0.0.1:9000",
    });
    expect(config.game).toBe("nl-dashboard");
    expect(config.assist).toBe("ag2");
    expect(config.agent).toBe("nl-glue-browser");
    expect(config.gameBaseUrl).toBe("http://127.0.0.1:9000");
  });

  it("formats a human-readable backend summary", () => {
    const summary = formatBackendSummary(
      resolveWebclientBackends({
        game: "v2-http",
        assist: "langgraph",
        agent: "none",
        gameBaseUrl: "http://127.0.0.1:8787",
        assistBaseUrl: "http://127.0.0.1:8790",
        nlDashboardBaseUrl: "https://127.0.0.1:8787",
      }),
    );
    expect(summary).toContain("game=v2-http");
    expect(summary).toContain("assist=langgraph");
    expect(summary).toContain("agent=none");
  });
});
