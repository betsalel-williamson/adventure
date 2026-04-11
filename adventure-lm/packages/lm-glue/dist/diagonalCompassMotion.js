/**
 * NE / NW / SE / SW are motion words in adventure.dat, but many Colossal Cave ports and
 * player expectations treat travel as cardinal (and vertical) only. The language-model layer can omit
 * them unless explicitly re-enabled.
 */
export const DIAGONAL_COMPASS_MOTION_TOKENS = ["NE", "NW", "SE", "SW"];
export const DIAGONAL_COMPASS_MOTION_TOKEN_SET = new Set(DIAGONAL_COMPASS_MOTION_TOKENS);
/**
 * When true, diagonal compass motion tokens appear in planner JSON enums, situational candidates,
 * and autoplay escape ordering (matching full adventure.dat motion vocabulary).
 *
 * @env ADVENTURE_LM_DIAGONAL_COMPASS_MOTION — `1`, `true`, or `yes` enables. Unset or other values: disabled.
 */
export function isDiagonalCompassMotionEnabled() {
    const v = typeof process !== "undefined" && process.env !== undefined
        ? process.env.ADVENTURE_LM_DIAGONAL_COMPASS_MOTION?.trim().toLowerCase()
        : undefined;
    return v === "1" || v === "true" || v === "yes";
}
//# sourceMappingURL=diagonalCompassMotion.js.map