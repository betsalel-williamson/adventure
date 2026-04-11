/** Autoplay inter-move delay presets (ms). None (0) for benchmarks; then slowest → fastest. */
export const AUTOPLAY_PACE_PRESETS = Object.freeze([
  { label: "None (benchmark)", ms: 0 },
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
  const n = Number(ms);
  if (Number.isFinite(n) && n === 0) return 0;
  const presetMs = AUTOPLAY_PACE_PRESETS.map((p) => p.ms).filter((x) => x > 0);
  if (!Number.isFinite(n)) return 500;
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
