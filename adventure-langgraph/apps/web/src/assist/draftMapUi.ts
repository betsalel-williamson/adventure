import { postAssistStep } from "../api/assistClient.js";
import type { AssistancePostureId } from "../posture/assistancePosture.js";
import { DRAFT_MAP_CLIPBOARD_DISCLAIMER } from "./draftMapCopy.js";
import { renderDraftMermaidMap } from "./draftMapMermaidRender.js";

export type DraftMapElements = {
  readonly status: HTMLElement | null;
  /** Rendered Mermaid SVG (primary map view). */
  readonly mermaidVisual: HTMLElement | null;
  readonly mermaidPre: HTMLElement | null;
  readonly jsonPre: HTMLElement | null;
  readonly probeToggle: HTMLButtonElement | null;
  readonly refreshBtn: HTMLButtonElement | null;
  readonly studyConfirm: HTMLInputElement | null;
  readonly copyMermaid: HTMLButtonElement | null;
  readonly copyJson: HTMLButtonElement | null;
  readonly dismiss: HTMLButtonElement | null;
};

const PROBE_START = "Start map probe";
const PROBE_STOP = "Stop map probe";

export const applyProbeToggleLabel = (
  button: HTMLButtonElement | null,
  running: boolean,
): void => {
  if (!button) {
    return;
  }
  button.textContent = running ? PROBE_STOP : PROBE_START;
};

export const renderDraftMapPanels = async (
  els: DraftMapElements,
  mermaid: string,
  mapJson: unknown,
): Promise<void> => {
  if (els.mermaidPre) {
    els.mermaidPre.textContent = mermaid;
  }
  if (els.jsonPre) {
    els.jsonPre.textContent =
      mapJson === null || mapJson === undefined
        ? ""
        : JSON.stringify(mapJson, null, 2);
  }
  await renderDraftMermaidMap(els.mermaidVisual, mermaid);
};

export const setDraftMapStatus = (
  el: HTMLElement | null,
  text: string,
): void => {
  if (el) {
    el.textContent = text;
  }
};

export type AssistRequestArgs = {
  readonly runId: string;
  readonly transcript: string;
  readonly posture: AssistancePostureId;
  readonly studyConfirmChecked: boolean;
  readonly advance: boolean;
};

export const requestAssistStep = async (
  args: AssistRequestArgs,
): Promise<{
  readonly ok: boolean;
  readonly nextMove: string | null;
  readonly mermaid: string;
  readonly mapJson: unknown;
  readonly notice?: string;
  readonly error?: string;
}> => {
  const studyFirstConfirmed =
    args.posture !== "studyFirst" || args.studyConfirmChecked;
  const r = await postAssistStep({
    runId: args.runId,
    transcript: args.transcript,
    assistancePosture: args.posture,
    studyFirstConfirmed,
    advance: args.advance,
  });
  if (!r.ok) {
    return {
      ok: false,
      nextMove: null,
      mermaid: "",
      mapJson: null,
      error: r.error,
    };
  }
  return {
    ok: true,
    nextMove: r.nextMove,
    mermaid: r.mermaid,
    mapJson: r.mapJson,
    notice: r.notice,
  };
};

export const copyWithDisclaimer = async (body: string): Promise<void> => {
  const text = `${DRAFT_MAP_CLIPBOARD_DISCLAIMER}${body}`;
  await navigator.clipboard.writeText(text);
};

export const wireDraftMapDom = (els: DraftMapElements): void => {
  els.copyMermaid?.addEventListener("click", () => {
    const raw = els.mermaidPre?.textContent?.trim() ?? "";
    if (!raw) {
      setDraftMapStatus(els.status, "Nothing to copy yet.");
      return;
    }
    void copyWithDisclaimer(raw).then(() => {
      setDraftMapStatus(els.status, "Copied Mermaid with draft disclaimer.");
    });
  });

  els.copyJson?.addEventListener("click", () => {
    const raw = els.jsonPre?.textContent?.trim() ?? "";
    if (!raw) {
      setDraftMapStatus(els.status, "Nothing to copy yet.");
      return;
    }
    void copyWithDisclaimer(raw).then(() => {
      setDraftMapStatus(els.status, "Copied JSON with draft disclaimer.");
    });
  });

  els.dismiss?.addEventListener("click", () => {
    void renderDraftMapPanels(els, "", null).then(() => {
      setDraftMapStatus(
        els.status,
        "Diagram panels cleared (probe state unchanged).",
      );
    });
  });
};
