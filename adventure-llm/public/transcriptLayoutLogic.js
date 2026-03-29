/**
 * Pure helpers for terminal-style transcript ordering (dashboard).
 * @param {{ step: number; parts: string[] }} b
 */
export function blockBodyChronological(b) {
  return b.parts.slice().reverse().join("");
}

/**
 * Fortran output often ends with several newlines before the next `>` prompt. In terminal layout
 * the prompt is a separate block, so extra trailing newlines only add blank rows in the `<pre>`.
 *
 * @param {string} text
 */
export function collapseTerminalGameTrailingNewlines(text) {
  return text.replace(/\n{2,}$/, "\n");
}

/**
 * @param {{ step: number; parts: string[] }[]} blocks
 */
export function sortTranscriptBlocksChronological(blocks) {
  return [...blocks].sort((a, b) => a.step - b.step);
}

/**
 * Autoplay terminal echoes merge before the game block with step `moveNumber`. When `afterStep`
 * is too high, `firstBlockAfterEcho` finds nothing and the echo incorrectly tails after the
 * latest game text. Repair using `moveNumber` and GETIN text for the latest step.
 *
 * @param {{ afterStep: number; line: string; moveNumber?: number | null }} e
 * @param {{ step: number; parts: string[] }[]} sorted chronological game blocks (ascending step)
 * @param {Record<number, string>} getinByStep GETIN line keyed by transcript step (move number)
 */
export function effectiveTerminalEchoAfterStep(e, sorted, getinByStep) {
  if (sorted.length === 0) return e.afterStep;
  const maxS = sorted[sorted.length - 1].step;
  let after = e.afterStep;
  const mn = e.moveNumber;

  if (mn !== null && mn !== undefined && mn >= 1) {
    if (maxS === mn && after >= maxS) {
      return Math.max(0, mn - 1);
    }
    const next = sorted.find((x) => x.step > after) ?? null;
    if (next === null && maxS === mn) {
      const cmd = String(e.line || "")
        .trim()
        .toUpperCase();
      const mapped = getinByStep[maxS];
      const getinForMax =
        typeof mapped === "string" ? mapped.trim().toUpperCase() : "";
      if (cmd && getinForMax && cmd === getinForMax) {
        return Math.max(0, mn - 1);
      }
    }
  }

  return after;
}
