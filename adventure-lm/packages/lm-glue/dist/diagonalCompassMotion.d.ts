/**
 * NE / NW / SE / SW are motion words in adventure.dat, but many Colossal Cave ports and
 * player expectations treat travel as cardinal (and vertical) only. The language-model layer can omit
 * them unless explicitly re-enabled.
 */
export declare const DIAGONAL_COMPASS_MOTION_TOKENS: readonly ["NE", "NW", "SE", "SW"];
export declare const DIAGONAL_COMPASS_MOTION_TOKEN_SET: Set<string>;
/**
 * When true, diagonal compass motion tokens appear in planner JSON enums, situational candidates,
 * and autoplay escape ordering (matching full adventure.dat motion vocabulary).
 *
 * @env ADVENTURE_LM_DIAGONAL_COMPASS_MOTION — `1`, `true`, or `yes` enables. Unset or other values: disabled.
 */
export declare function isDiagonalCompassMotionEnabled(): boolean;
//# sourceMappingURL=diagonalCompassMotion.d.ts.map