import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  dashboardTestOrigin,
  listenDashboardTestServer,
} from "./dashboardTestEnv.js";

describe("dashboardTestEnv", () => {
  afterEach(() => {
    delete process.env.ADVENTURE_NL_WEB_BIND_HOST;
  });

  it("dashboardTestOrigin uses bind host env and http protocol for http.Server", async () => {
    process.env.ADVENTURE_NL_WEB_BIND_HOST = "localhost";
    const server = http.createServer();
    await listenDashboardTestServer(server);
    expect(dashboardTestOrigin(server)).toMatch(/^http:\/\/localhost:\d+$/);
    await new Promise<void>((resolve, reject) => {
      server.close((e) => (e ? reject(e) : resolve()));
    });
  });

  it("dashboardTestOrigin throws when server is not listening", () => {
    const server = http.createServer();
    expect(() => dashboardTestOrigin(server)).toThrow(
      "Server must be listening",
    );
  });
});
