import type { TextLlmProviderId } from "@adventure-nl/nl-glue";

/**
 * Whether the dashboard runs **NL interpretation and planner glue in the browser** (ADR0005 /
 * ADR0014). The Node server stays thin: Fortran + SSE + logical LLM API; “autoplay” in env and
 * route names refers to the **self-acting game loop**, not to hosting NL on the server.
 *
 * **Default is on** so `npm run web` loads the nl-glue bundle (`browserAutoplayCognition.js`).
 * Set `ADVENTURE_NL_BROWSER_ORCHESTRATED_AUTOPLAY=0` (or `false` / `no` / `off`) to run that glue
 * in the **Node** process instead (same overall behavior class as the CLI self-acting runner).
 *
 * **MLX:** Browser-side planning uses Gemini or OpenAI-compatible HTTP only. When a dashboard
 * session’s text provider is **mlx**, this function returns **`false`** even if the env flag is
 * on, so the server runs the Node `runAutoplaySessionWithTextLlm` loop instead of waiting on the browser.
 * When no text LLM is configured (minimal tests), the env flag alone applies so existing session
 * contracts stay stable.
 */
export function resolveBrowserOrchestratedAutoplayFromEnv(): boolean {
  const raw = process.env.ADVENTURE_NL_BROWSER_ORCHESTRATED_AUTOPLAY;
  if (raw === undefined) {
    return true;
  }
  const v = raw.trim();
  if (v === "") {
    return true;
  }
  const t = v.toLowerCase();
  if (t === "0" || t === "false" || t === "no" || t === "off") {
    return false;
  }
  return t === "1" || t === "true" || t === "yes" || t === "on";
}

export type EffectiveBrowserOrchestratedAutoplayArgs = {
  readonly textLlmConfigured: boolean;
  readonly textLlmProviderId: TextLlmProviderId;
};

/**
 * Session-visible browser orchestration: env flag plus provider compatibility.
 */
export function resolveEffectiveBrowserOrchestratedAutoplay(
  envEnabled: boolean,
  args: EffectiveBrowserOrchestratedAutoplayArgs,
): boolean {
  if (!envEnabled) return false;
  if (!args.textLlmConfigured) return true;
  if (args.textLlmProviderId === "mlx") return false;
  return true;
}
