import { afterEach, describe, expect, it } from "vitest";
import { resolveDashboardBindHost } from "./dashboardBindHost.js";

describe("resolveDashboardBindHost", () => {
  afterEach(() => {
    delete process.env.ADVENTURE_NL_WEB_BIND_HOST;
  });

  it("uses ADVENTURE_NL_WEB_BIND_HOST when set", () => {
    process.env.ADVENTURE_NL_WEB_BIND_HOST = "localhost";
    expect(resolveDashboardBindHost()).toBe("localhost");
  });

  it("defaults when unset or empty", () => {
    delete process.env.ADVENTURE_NL_WEB_BIND_HOST;
    expect(resolveDashboardBindHost()).toBe("127.0.0.1");
    process.env.ADVENTURE_NL_WEB_BIND_HOST = "   ";
    expect(resolveDashboardBindHost()).toBe("127.0.0.1");
  });
});
