/**
 * Assistance posture catalog — labels and honest rules for ancillary panels (pure; DOM-free).
 * Single source of truth for user-facing posture copy (US-4-2, US-4-3).
 */

export type AssistancePostureId = "quickAssist" | "studyFirst";

export const DEFAULT_ASSISTANCE_POSTURE_ID: AssistancePostureId = "quickAssist";

/** Persisted choice (`sessionStorage`) — namespaced to avoid collisions. */
export const ASSISTANCE_POSTURE_STORAGE_KEY = "adventure-v3-assistance-posture";

/** Display / tab order for radio controls (subset of catalog). */
export const ORDERED_ASSISTANCE_POSTURE_IDS: readonly AssistancePostureId[] = [
  "quickAssist",
  "studyFirst",
];

export type AssistancePostureDefinition = {
  id: AssistancePostureId;
  /** Everyday words — see E4 glossary (radio label + “Current posture” line) */
  label: string;
  /** What the user should expect from assists in this posture */
  expectLines: readonly string[];
  /** What this posture does not do */
  avoidLines: readonly string[];
  /** How draft / apply behaves — visible before any apply control exists (US-4-2) */
  draftApplyPolicyLines: readonly string[];
};

const CATALOG: Record<AssistancePostureId, AssistancePostureDefinition> = {
  quickAssist: {
    id: "quickAssist",
    label: "Quick assist",
    expectLines: [
      "Short suggestions tied to what you already see on the CRT.",
      "Small steps; each assist stays easy to scan before you continue playing.",
    ],
    avoidLines: [
      "Running the game for you or issuing commands without your input.",
      "Heavy orchestration chrome on the main transcript.",
    ],
    draftApplyPolicyLines: [
      "If a draft map offers an apply action in a future build, this posture asks you to confirm before anything changes beyond previews.",
      "There is no apply control in this build — the Fortran game remains the source of truth.",
    ],
  },
  studyFirst: {
    id: "studyFirst",
    label: "Study first",
    expectLines: [
      "Confirmation before assists change drafts or suggestion stacks beyond what you already see.",
      "Clear pauses when a step could alter previews — you stay in control of what applies.",
    ],
    avoidLines: [
      "Running the game for you or issuing commands without your input.",
      "Silent apply of drafts or assists without an explicit confirm step while this posture is active.",
    ],
    draftApplyPolicyLines: [
      "Any apply action on a draft map will wait for your confirmation while this posture is active.",
      "There is no apply control in this build — the Fortran game remains the source of truth.",
    ],
  },
};

export const isAssistancePostureId = (
  value: string,
): value is AssistancePostureId => value in CATALOG;

export const parseStoredAssistancePostureId = (
  raw: string | null,
): AssistancePostureId => {
  if (raw !== null && isAssistancePostureId(raw)) {
    return raw;
  }
  return DEFAULT_ASSISTANCE_POSTURE_ID;
};

export const describeAssistancePosture = (
  id: AssistancePostureId,
): AssistancePostureDefinition => CATALOG[id];

export const formatAssistancePostureForPanel = (
  id: AssistancePostureId,
): string[] => {
  const d = describeAssistancePosture(id);
  const lines: string[] = [];
  lines.push(`Current posture: ${d.label}`);
  lines.push("");
  lines.push("What to expect:");
  for (const line of d.expectLines) {
    lines.push(`· ${line}`);
  }
  lines.push("");
  lines.push("What this posture avoids:");
  for (const line of d.avoidLines) {
    lines.push(`· ${line}`);
  }
  lines.push("");
  lines.push("Draft maps and apply:");
  for (const line of d.draftApplyPolicyLines) {
    lines.push(`· ${line}`);
  }
  return lines;
};

export const formatDefaultAssistancePostureForPanel = (): string[] =>
  formatAssistancePostureForPanel(DEFAULT_ASSISTANCE_POSTURE_ID);

/** Compact acknowledgment after the user changes posture (aria-live friendly). */
export const formatPostureChangeAcknowledgment = (
  id: AssistancePostureId,
): string => {
  const label = describeAssistancePosture(id).label;
  return `Posture set to ${label}.`;
};

/**
 * Shown after a posture change — previews/drafts may not match the new policy until refreshed.
 * US-4-3: clear notice when prior previews may no longer apply.
 */
export const POSTURE_CHANGE_STALE_NOTICE =
  "Earlier previews or assists may not match this posture. Regenerate or reopen drafts after you switch modes.";
