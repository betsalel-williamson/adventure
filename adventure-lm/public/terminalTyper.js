/**
 * Unknown-style terminal typing: key clicks + character-at-a-time into a <pre>.
 */

/** After the last character, pause before “Enter” / transcript echo (ms). */
export const TERMINAL_TYPING_PRE_ENTER_MS = 200;

/** WPM when pace select is missing (matches “Normal” 500 ms pace). */
const DEFAULT_TYPING_WPM = 60;

/**
 * Standard typing-equivalent: 5 characters per word → CPM = WPM × 5.
 *
 * @param {number} wpm
 */
export function wpmToCharDelayMs(wpm) {
  const w = Math.max(1, wpm);
  return Math.round(60000 / (w * 5));
}

/**
 * Map autoplay inter-move delay (ms) to transcript typing speed (WPM).
 * Anchors: 3000 ms → 25, 500 ms → 60, 100 ms → 160; linear between.
 *
 * @param {unknown} paceMs
 */
export function paceMsToTypingWpm(paceMs) {
  const p = Number(paceMs);
  const SLOW_MS = 3000;
  const SLOW_WPM = 25;
  const NORM_MS = 500;
  const NORM_WPM = 60;
  const FAST_MS = 100;
  const FAST_WPM = 160;
  if (!Number.isFinite(p)) return NORM_WPM;
  if (p >= SLOW_MS) return SLOW_WPM;
  if (p <= FAST_MS) return FAST_WPM;
  if (p >= NORM_MS) {
    return (
      NORM_WPM + (SLOW_WPM - NORM_WPM) * ((p - NORM_MS) / (SLOW_MS - NORM_MS))
    );
  }
  return (
    FAST_WPM + (NORM_WPM - FAST_WPM) * ((p - FAST_MS) / (NORM_MS - FAST_MS))
  );
}

const DEFAULT_CHAR_DELAY_MS = wpmToCharDelayMs(DEFAULT_TYPING_WPM);

/** @type {HTMLAudioElement[]} */
let keyPool = [];
let keyPoolReady = false;

export function preloadTerminalSounds() {
  if (keyPoolReady) return;
  keyPool = [1, 2, 3, 4].map((n) => new Audio(`/sound/key${n}.mp3`));
  keyPoolReady = true;
}

export function playTypeSound() {
  preloadTerminalSounds();
  if (keyPool.length === 0) return;
  const a = keyPool[Math.floor(Math.random() * keyPool.length)];
  a.currentTime = 0;
  void a.play().catch(() => {
    /* autoplay or missing file */
  });
}

/**
 * @param {HTMLElement | null} scrollRoot
 * @param {HTMLPreElement} pre
 * @param {string} text
 * @param {{ charDelayMs?: number; finalPauseMs?: number }} [opts]
 */
export function typeTextIntoPre(scrollRoot, pre, text, opts = {}) {
  const charDelayMs = opts.charDelayMs ?? DEFAULT_CHAR_DELAY_MS;
  const finalPauseMs = opts.finalPauseMs ?? TERMINAL_TYPING_PRE_ENTER_MS;
  return new Promise((resolve) => {
    if (charDelayMs <= 0) {
      pre.textContent = text;
      if (scrollRoot) {
        scrollRoot.scrollTop = scrollRoot.scrollHeight;
      }
      window.setTimeout(resolve, finalPauseMs <= 0 ? 0 : finalPauseMs);
      return;
    }
    let i = 0;
    const step = () => {
      if (i < text.length) {
        playTypeSound();
        pre.textContent += text[i];
        i += 1;
        if (scrollRoot) {
          scrollRoot.scrollTop = scrollRoot.scrollHeight;
        }
        window.setTimeout(step, charDelayMs);
      } else {
        window.setTimeout(resolve, finalPauseMs);
      }
    };
    pre.textContent = "";
    step();
  });
}

/**
 * Character-at-a-time into the manual prompt (autoplay model typing before echo hits the transcript).
 *
 * @param {HTMLInputElement | null} input
 * @param {string} text
 * @param {{ charDelayMs?: number; finalPauseMs?: number; uppercase?: boolean }} [opts]
 */
export function typeTextIntoInput(input, text, opts = {}) {
  const charDelayMs = opts.charDelayMs ?? DEFAULT_CHAR_DELAY_MS;
  const finalPauseMs = opts.finalPauseMs ?? TERMINAL_TYPING_PRE_ENTER_MS;
  const uppercase = opts.uppercase !== false;
  const src = uppercase ? text.toUpperCase() : text;
  return new Promise((resolve) => {
    if (!input) {
      window.setTimeout(resolve, 0);
      return;
    }
    if (charDelayMs <= 0) {
      input.value = src;
      window.setTimeout(resolve, finalPauseMs <= 0 ? 0 : finalPauseMs);
      return;
    }
    input.value = "";
    let i = 0;
    const step = () => {
      if (i < src.length) {
        playTypeSound();
        input.value += src[i];
        i += 1;
        window.setTimeout(step, charDelayMs);
      } else {
        window.setTimeout(resolve, finalPauseMs);
      }
    };
    step();
  });
}
