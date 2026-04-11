import { describe, expect, it, vi } from "vitest";
import { bindDashboardElements } from "../public/dashboardElementRefs.js";
import { resolveDashboardElements } from "../public/dashboardEnv.js";
import { registerDashboardEventHandlers } from "../public/dashboardEventStream.js";

/**
 * Minimal EventTarget stand-in for SSE registration tests (no network).
 * See https://html.spec.whatwg.org/multipage/server-sent-events.html#the-eventsource-interface
 */
class FakeEventSource extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  /** @type {number} */
  readyState = FakeEventSource.OPEN;
  close() {
    this.readyState = FakeEventSource.CLOSED;
  }
}

describe("registerDashboardEventHandlers", () => {
  it("dispatches parser_verbs payload to renderParserVerbHintGroups", () => {
    const doc = document.implementation.createHTMLDocument("t");
    bindDashboardElements(resolveDashboardElements(doc));

    const renderParserVerbHintGroups = vi.fn();
    const noop = vi.fn();
    const es = new FakeEventSource();
    registerDashboardEventHandlers(es as unknown as EventSource, {
      renderParserVerbHintGroups,
      setManualUiState: noop,
      applyLiveAutoplaySessionStatusFromPaceAndMax: noop,
      setAutoplayPaceSelectValue: noop,
      clearManualError: noop,
      setSessionStatus: noop,
      clearMlxLoadProgressText: noop,
      setMlxLoadOverlayVisible: noop,
      setPlannerThinking: noop,
      appendMlxLoadProgress: noop,
      formatAutoplaySessionStatusLine: noop,
      refreshModeFromServer: async () => {},
      initTextLlmPicker: async () => {},
      typingTimingFromPaceSelect: () => ({
        charDelayMs: 1,
        finalPauseMs: 0,
      }),
    });

    es.dispatchEvent(
      new MessageEvent("parser_verbs", {
        data: JSON.stringify({
          groups: [["GO", "EAST"]],
          datAvailable: true,
        }),
      }),
    );

    expect(renderParserVerbHintGroups).toHaveBeenCalledWith([["GO", "EAST"]], {
      datAvailable: true,
    });
  });
});
