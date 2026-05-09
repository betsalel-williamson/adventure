/**
 * Mermaid rendering for LangGraph + XState diagrams (bundled vs localStorage override).
 */

import mermaid from "mermaid";
import {
  clearAgentDiagramStorage,
  effectiveBrainMermaid,
  effectiveControlMermaid,
  loadAgentDiagramStorage,
  saveAgentDiagramStorage,
  type AgentDiagramStorage
} from "./agentDiagramSettings.js";
import { BRAIN_GRAPH_MERMAID, CONTROL_MACHINE_MERMAID } from "./agentDiagrams.js";

const renderAgentDiagrams = async (brain: string, control: string): Promise<void> => {
  const brainEl = document.getElementById("brain-mermaid");
  const ctrlEl = document.getElementById("control-mermaid");
  if (!brainEl || !ctrlEl) {
    return;
  }
  brainEl.removeAttribute("data-processed");
  ctrlEl.removeAttribute("data-processed");
  brainEl.textContent = brain;
  ctrlEl.textContent = control;
  await mermaid.run({ nodes: [brainEl, ctrlEl] });
};

const diagramStorageFromUi = (
  useBundledEl: HTMLInputElement | null,
  brainEl: HTMLTextAreaElement | null,
  controlEl: HTMLTextAreaElement | null
): AgentDiagramStorage => ({
  useBundled: useBundledEl?.checked !== false,
  brain: brainEl?.value,
  control: controlEl?.value
});

const syncDiagramEditorVisibility = (
  bundled: boolean,
  diagramCustomEditorEl: HTMLElement | null
): void => {
  if (diagramCustomEditorEl) {
    diagramCustomEditorEl.style.display = bundled ? "none" : "";
  }
};

export const setupAgentDiagramPanel = async (): Promise<void> => {
  const useBundledDiagramsEl = document.querySelector<HTMLInputElement>("#use-bundled-diagrams");
  const diagramCustomEditorEl = document.querySelector<HTMLElement>("#diagram-custom-editor");
  const diagramBrainEditEl = document.querySelector<HTMLTextAreaElement>("#diagram-brain-edit");
  const diagramControlEditEl = document.querySelector<HTMLTextAreaElement>("#diagram-control-edit");

  mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "loose" });
  const stored = loadAgentDiagramStorage();
  if (useBundledDiagramsEl) {
    useBundledDiagramsEl.checked = stored?.useBundled !== false;
  }
  if (diagramBrainEditEl) {
    diagramBrainEditEl.value =
      stored && stored.useBundled === false && typeof stored.brain === "string"
        ? stored.brain
        : BRAIN_GRAPH_MERMAID;
  }
  if (diagramControlEditEl) {
    diagramControlEditEl.value =
      stored && stored.useBundled === false && typeof stored.control === "string"
        ? stored.control
        : CONTROL_MACHINE_MERMAID;
  }
  syncDiagramEditorVisibility(useBundledDiagramsEl?.checked !== false, diagramCustomEditorEl);

  const applyDiagramsFromUi = async (): Promise<void> => {
    const s = diagramStorageFromUi(useBundledDiagramsEl, diagramBrainEditEl, diagramControlEditEl);
    await renderAgentDiagrams(
      effectiveBrainMermaid(BRAIN_GRAPH_MERMAID, s),
      effectiveControlMermaid(CONTROL_MACHINE_MERMAID, s)
    );
  };

  useBundledDiagramsEl?.addEventListener("change", () => {
    syncDiagramEditorVisibility(useBundledDiagramsEl.checked, diagramCustomEditorEl);
    void applyDiagramsFromUi();
  });

  document.getElementById("diagram-apply")?.addEventListener("click", () => {
    void applyDiagramsFromUi();
  });

  document.getElementById("diagram-save-local")?.addEventListener("click", () => {
    saveAgentDiagramStorage({
      useBundled: useBundledDiagramsEl?.checked !== false,
      brain: diagramBrainEditEl?.value,
      control: diagramControlEditEl?.value
    });
  });

  document.getElementById("diagram-reset")?.addEventListener("click", () => {
    clearAgentDiagramStorage();
    if (useBundledDiagramsEl) {
      useBundledDiagramsEl.checked = true;
    }
    if (diagramBrainEditEl) {
      diagramBrainEditEl.value = BRAIN_GRAPH_MERMAID;
    }
    if (diagramControlEditEl) {
      diagramControlEditEl.value = CONTROL_MACHINE_MERMAID;
    }
    syncDiagramEditorVisibility(true, diagramCustomEditorEl);
    void applyDiagramsFromUi();
  });

  await applyDiagramsFromUi();
};
