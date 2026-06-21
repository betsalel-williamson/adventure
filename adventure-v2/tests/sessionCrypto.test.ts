import { describe, expect, it } from "vitest";
import { hashSecretHex, secureCompareHexDigests } from "../apps/server/src/session/sessionCrypto.js";

describe("sessionCrypto (OWASP: constant-time secret compare)", () => {
  it("accepts matching digests", () => {
    const digest = hashSecretHex("device-token-value");
    expect(secureCompareHexDigests(digest, digest)).toBe(true);
  });

  it("rejects non-matching digests without throwing", () => {
    const a = hashSecretHex("token-a");
    const b = hashSecretHex("token-b");
    expect(secureCompareHexDigests(a, b)).toBe(false);
  });

  it("rejects unequal-length strings without throwing", () => {
    expect(secureCompareHexDigests("abc", "abcd")).toBe(false);
  });
});
