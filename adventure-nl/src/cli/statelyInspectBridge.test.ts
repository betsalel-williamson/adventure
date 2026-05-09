import { afterEach, describe, expect, it } from "vitest";
import {
  buildStatelyInspectBridgeHtml,
  STATELY_INSPECT_WS_PATH,
} from "./statelyInspectBridge.js";

describe("statelyInspectBridge", () => {
  afterEach(() => {
    delete process.env.ADVENTURE_NL_STATELY_INSPECT_UI_URL;
  });

  it("embeds the websocket path", () => {
    const html = buildStatelyInspectBridgeHtml();
    expect(html).toContain(STATELY_INSPECT_WS_PATH);
  });

  it("defaults inner iframe URL to stately when env is unset", () => {
    const html = buildStatelyInspectBridgeHtml();
    expect(html).toContain("https://stately.ai/inspect");
  });

  it("uses ADVENTURE_NL_STATELY_INSPECT_UI_URL when set to a valid https URL", () => {
    process.env.ADVENTURE_NL_STATELY_INSPECT_UI_URL =
      "https://example.com/custom-inspect";
    const html = buildStatelyInspectBridgeHtml();
    expect(html).toContain("https://example.com/custom-inspect");
  });

  it("ignores non-https ADVENTURE_NL_STATELY_INSPECT_UI_URL", () => {
    process.env.ADVENTURE_NL_STATELY_INSPECT_UI_URL =
      "http://evil.example/phish";
    const html = buildStatelyInspectBridgeHtml();
    expect(html).toContain("https://stately.ai/inspect");
    expect(html).not.toContain("evil.example");
  });
});
