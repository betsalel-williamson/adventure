/**
 * Feature flag for ADR0005 browser-orchestrated autoplay (engine on server, cognition in the browser).
 */
export function resolveBrowserOrchestratedAutoplayFromEnv(): boolean {
  const v =
    process.env.ADVENTURE_NL_BROWSER_ORCHESTRATED_AUTOPLAY?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
