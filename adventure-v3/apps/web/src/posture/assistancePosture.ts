/**
 * Assistance posture catalog — labels and honest rules for ancillary panels (pure; DOM-free).
 * Single source of truth for user-facing posture copy until US-4-3 adds selection.
 */

export type AssistancePostureId = "quickAssist";

export const DEFAULT_ASSISTANCE_POSTURE_ID: AssistancePostureId = "quickAssist";

export type AssistancePostureDefinition = {
  id: AssistancePostureId;
  /** Everyday words — see E4 glossary */
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
      "Small steps; each assist stays easy to scan before you continue playing."
    ],
    avoidLines: [
      "Running the game for you or issuing commands without your input.",
      "Heavy orchestration chrome on the main transcript."
    ],
    draftApplyPolicyLines: [
      "If a draft map offers an apply action in a future build, this posture asks you to confirm before anything changes beyond previews.",
      "There is no apply control in this build — the Fortran game remains the source of truth."
    ]
  }
};

export const describeAssistancePosture = (id: AssistancePostureId): AssistancePostureDefinition =>
  CATALOG[id];

export const formatAssistancePostureForPanel = (id: AssistancePostureId): string[] => {
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
