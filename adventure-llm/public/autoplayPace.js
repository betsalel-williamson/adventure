/** Autoplay inter-move delay presets (ms). Slowest 3000 → fastest 100. */
export const AUTOPLAY_PACE_PRESETS = Object.freeze([
  { label: "Slowest", ms: 3000 },
  { label: "Slow", ms: 1500 },
  { label: "Normal", ms: 500 },
  { label: "Fast", ms: 200 },
  { label: "Fastest", ms: 100 },
]);

/**
 * @param {unknown} ms
 */
export function snapPaceMsToPreset(ms) {
  const presetMs = AUTOPLAY_PACE_PRESETS.map((p) => p.ms);
  const n = Number(ms);
  if (!Number.isFinite(n)) return AUTOPLAY_PACE_PRESETS[2].ms;
  let best = presetMs[0];
  let bestD = Math.abs(n - best);
  for (const p of presetMs) {
    const d = Math.abs(n - p);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}
