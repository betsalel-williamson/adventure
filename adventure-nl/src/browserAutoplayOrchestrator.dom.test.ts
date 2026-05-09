import { describe, expect, it, vi } from "vitest";
import { resolveStatelyInspectOption } from "../public/browserAutoplayOrchestrator.js";

function ports(overrides?: Partial<Pick<Location, "protocol" | "host">>) {
  return {
    location: {
      protocol: "https:",
      host: "127.0.0.1:8787",
      ...overrides,
    },
  };
}

describe("resolveStatelyInspectOption", () => {
  it("returns inspector.inspect when bundle exposes createWebSocketInspector", () => {
    const inspectFn = vi.fn();
    const createWebSocketInspector = vi.fn(() => ({ inspect: inspectFn }));

    const out = resolveStatelyInspectOption(ports(), {
      createWebSocketInspector,
    });

    expect(out).toBe(inspectFn);
    expect(createWebSocketInspector).toHaveBeenCalledWith({
      url: "wss://127.0.0.1:8787/api/stately-inspect/ws",
    });
  });

  it("uses ws when page is plain http", () => {
    const createWebSocketInspector = vi.fn(() => ({ inspect: vi.fn() }));
    resolveStatelyInspectOption(
      ports({ protocol: "http:", host: "127.0.0.1:8787" }),
      { createWebSocketInspector },
    );
    expect(createWebSocketInspector).toHaveBeenCalledWith({
      url: "ws://127.0.0.1:8787/api/stately-inspect/ws",
    });
  });

  it("returns undefined when createWebSocketInspector is absent", () => {
    expect(resolveStatelyInspectOption(ports(), {})).toBe(undefined);
  });

  it("returns undefined and warns when createWebSocketInspector throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const err = new Error("inspector boom");
    const createWebSocketInspector = vi.fn(() => {
      throw err;
    });

    expect(
      resolveStatelyInspectOption(ports(), { createWebSocketInspector }),
    ).toBe(undefined);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("matches the option shape passed to createBrowserAutoplayCognitionActor", () => {
    const inspect = vi.fn();
    const createWebSocketInspector = vi.fn(() => ({ inspect }));
    const createBrowserAutoplayCognitionActor = vi.fn(() => ({
      send: vi.fn(),
    }));

    const inspectOpt = resolveStatelyInspectOption(ports(), {
      createWebSocketInspector,
    });
    createBrowserAutoplayCognitionActor({}, { inspect: inspectOpt });

    expect(createBrowserAutoplayCognitionActor).toHaveBeenCalledWith(
      {},
      { inspect },
    );
  });
});
