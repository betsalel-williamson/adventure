import {
  applyProbeToggleLabel,
  wireDraftMapDom,
  type DraftMapElements,
} from "../assist/draftMapUi.js";
import {
  POSTURE_CHANGE_STALE_NOTICE,
  isAssistancePostureId,
  type AssistancePostureId,
} from "../posture/assistancePosture.js";
import { v3FeatureFlags } from "../featureFlags.js";

export type WireLegacyAssistControlsArgs = {
  readonly assistCoverEl: HTMLDetailsElement | null;
  readonly sessionSignalsDetailsEl: HTMLDetailsElement | null;
  readonly syncSessionSignalsAriaLive: () => void;
  readonly draftMapEls: DraftMapElements;
  readonly postureRadioInputs: readonly HTMLInputElement[];
  readonly postureStaleNoticeTextEl: HTMLElement | null;
  readonly postureStaleDismissEl: HTMLButtonElement | null;
  readonly syncPostureRadiosFromSelection: () => void;
  readonly refreshAssistancePosturePanel: () => void;
  readonly applyUserPostureChange: (nextId: AssistancePostureId) => void;
  readonly hideStalePostureNotice: () => void;
  readonly onRefreshDraftMap: () => void;
  readonly onProbeToggle: () => void;
};

/** Wire legacy Assist strip: posture, draft map DOM, refresh/probe, session-signal SR. */
export const wireLegacyAssistControls = (
  args: WireLegacyAssistControlsArgs,
): void => {
  args.assistCoverEl?.addEventListener("toggle", () => {
    args.syncSessionSignalsAriaLive();
  });

  if (!v3FeatureFlags.assistPanels) {
    return;
  }

  args.syncPostureRadiosFromSelection();

  if (args.postureStaleNoticeTextEl) {
    args.postureStaleNoticeTextEl.textContent = POSTURE_CHANGE_STALE_NOTICE;
  }

  for (const input of args.postureRadioInputs) {
    input.addEventListener("change", () => {
      if (!isAssistancePostureId(input.value)) {
        return;
      }
      args.applyUserPostureChange(input.value);
    });
  }

  args.postureStaleDismissEl?.addEventListener(
    "click",
    args.hideStalePostureNotice,
  );

  args.refreshAssistancePosturePanel();

  wireDraftMapDom(args.draftMapEls);
  applyProbeToggleLabel(args.draftMapEls.probeToggle, false);

  args.draftMapEls.refreshBtn?.addEventListener("click", () => {
    args.onRefreshDraftMap();
  });

  if (v3FeatureFlags.mapProbe) {
    args.draftMapEls.probeToggle?.addEventListener("click", () => {
      args.onProbeToggle();
    });
  }

  args.sessionSignalsDetailsEl?.addEventListener("toggle", () => {
    args.syncSessionSignalsAriaLive();
  });
};
