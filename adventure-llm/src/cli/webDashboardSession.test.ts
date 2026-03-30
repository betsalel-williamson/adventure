import { describe, expect, it } from "vitest";
import {
  ADVENTURE_SESSION_COOKIE,
  formatSessionSetCookie,
  isValidSessionId,
  parseAdventureSessionCookie,
} from "./webDashboardSession.js";

describe("webDashboardSession", () => {
  it("isValidSessionId accepts UUID v4", () => {
    expect(isValidSessionId("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isValidSessionId("not-a-uuid")).toBe(false);
    expect(isValidSessionId("")).toBe(false);
  });

  it("parseAdventureSessionCookie reads adventure_session", () => {
    expect(
      parseAdventureSessionCookie(
        `foo=1; ${ADVENTURE_SESSION_COOKIE}=abc-def-4ghi-jklm-123456789012; bar=2`,
      ),
    ).toBe("abc-def-4ghi-jklm-123456789012");
    expect(parseAdventureSessionCookie(undefined)).toBe(null);
  });

  it("formatSessionSetCookie includes HttpOnly and optional Secure", () => {
    const a = formatSessionSetCookie("u1", { secure: false });
    expect(a).toContain("HttpOnly");
    expect(a).toContain("SameSite=Lax");
    expect(a).not.toContain("Secure");
    const b = formatSessionSetCookie("u2", { secure: true });
    expect(b).toContain("Secure");
  });
});
