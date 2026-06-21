import { applyV3ChromeFromFlags } from "../../src/shell/applyChromeFromFlags.js";
import { loadShellIndexBodyIntoDocument } from "./loadShellDom.js";

/** Full shell markup from index.html + feature-flag chrome application (matches page boot order for layout). */
export const resetShellDomWithFlags = (): void => {
  loadShellIndexBodyIntoDocument();
  applyV3ChromeFromFlags();
};
