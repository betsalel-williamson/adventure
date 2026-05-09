import type { Server } from "node:http";

/** Promise wrapper for `server.close` for consistent teardown in HTTP acceptance tests. */
export const closeServer = (server: Server): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
