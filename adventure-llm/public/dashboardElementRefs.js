/**
 * Live element bag; call `bindDashboardElements` before other dashboard modules read it.
 * @type {null | ReturnType<import("./dashboardEnv.js").resolveDashboardElements>}
 */
export let elements = null;

/** @param {NonNullable<typeof elements>} next */
export function bindDashboardElements(next) {
  elements = next;
}
