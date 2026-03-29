export const AUTOPLAY_PACE_PRESETS: ReadonlyArray<{
  readonly label: string;
  readonly ms: number;
}>;

export function snapPaceMsToPreset(ms: unknown): number;
