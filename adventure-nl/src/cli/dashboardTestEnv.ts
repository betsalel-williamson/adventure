import http from "node:http";
import https from "node:https";
import { resolveDashboardBindHost } from "./dashboardBindHost.js";

/**
 * Binds a test server to {@link resolveDashboardBindHost} and an ephemeral port.
 */
export async function listenDashboardTestServer(
  server: http.Server | https.Server,
): Promise<void> {
  const host = resolveDashboardBindHost();
  await new Promise<void>((resolve, reject) => {
    server.listen(0, host, () => resolve());
    server.once("error", reject);
  });
}

/**
 * Base URL for `fetch` against a server created by {@link createAutoplayDashboardServer} or a raw Node server.
 * Protocol follows the server instance (`http` vs `https`); host comes from `ADVENTURE_NL_WEB_BIND_HOST`.
 */
export function dashboardTestOrigin(
  server: http.Server | https.Server,
): string {
  const addr = server.address();
  if (addr === null || typeof addr === "string") {
    throw new Error("Server must be listening with an IPv4/IPv6 address");
  }
  const protocol = server instanceof https.Server ? "https" : "http";
  const host = resolveDashboardBindHost();
  return `${protocol}://${host}:${addr.port}`;
}
