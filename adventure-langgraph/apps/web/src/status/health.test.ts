import { describe, expect, it } from "vitest";
import { describeHealthStatus, minimalOracleHint } from "./health.js";

describe("minimalOracleHint", () => {
  it("is short for each mode", () => {
    expect(minimalOracleHint(null, { fetchError: "x" })).toBe(
      "API unreachable",
    );
    expect(
      minimalOracleHint(
        { oracleMode: "process", processOracleScript: "x.mjs" },
        {},
      ),
    ).toBe("Fortran game");
    expect(
      minimalOracleHint(
        { oracleMode: "synthetic", processOracleScript: null },
        {},
      ),
    ).toBe("Demo oracle");
  });
});

describe("describeHealthStatus", () => {
  it("explains fetch failures", () => {
    expect(describeHealthStatus(null, { fetchError: "reset" })).toContain(
      "Not connected",
    );
  });

  it("describes Fortran bridge", () => {
    expect(
      describeHealthStatus(
        {
          oracleMode: "process",
          processOracleScript: "oracle-fortran-bridge.mjs",
        },
        {},
      ),
    ).toContain("Fortran");
  });

  it("describes synthetic oracle", () => {
    expect(
      describeHealthStatus(
        { oracleMode: "synthetic", processOracleScript: null },
        {},
      ),
    ).toContain("demo/test mode");
  });
});
