import { copyWithDisclaimer } from "../assist/draftMapUi.js";
import type { ExplorationMapElements } from "../assist/explorationMapUpdate.js";

/** Register copy / hide controls for the exploration map column (no feature gate). */
export const wireExplorationMapControls = (
  explorationMapEls: ExplorationMapElements,
): void => {
  document
    .querySelector<HTMLButtonElement>("#exploration-map-copy")
    ?.addEventListener("click", () => {
      const raw = explorationMapEls.mermaidPre?.textContent?.trim() ?? "";
      if (!raw) {
        if (explorationMapEls.status) {
          explorationMapEls.status.textContent = "Nothing to copy yet.";
        }
        return;
      }
      void copyWithDisclaimer(raw).then(() => {
        if (explorationMapEls.status) {
          explorationMapEls.status.textContent =
            "Copied Mermaid with draft disclaimer.";
        }
      });
    });

  document
    .querySelector<HTMLButtonElement>("#exploration-map-hide")
    ?.addEventListener("click", () => {
      if (explorationMapEls.mermaidVisual) {
        explorationMapEls.mermaidVisual.replaceChildren();
      }
      if (explorationMapEls.mermaidPre) {
        explorationMapEls.mermaidPre.textContent = "";
      }
      if (explorationMapEls.status) {
        explorationMapEls.status.textContent = "Diagram hidden.";
      }
    });
};
