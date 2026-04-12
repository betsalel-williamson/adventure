/**
 * Hostname or IP the dashboard HTTP(S) server binds to.
 * Set `ADVENTURE_NL_WEB_BIND_HOST` at launch for non-default local setups; Vitest uses the same variable for fetch URLs.
 */
export function resolveDashboardBindHost(): string {
  const h = process.env.ADVENTURE_NL_WEB_BIND_HOST?.trim();
  return h !== undefined && h !== "" ? h : "127.0.0.1";
}
