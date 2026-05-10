# US-2-1 — API exposes oracle mode for the CRT status strip (wire contract)
Feature: Health endpoint for CRT shell trust strip
  As a demo operator
  I want GET /health to describe the oracle mode
  So the shell can say whether Fortran is active without reading logs

  Background:
    Given the adventure HTTP API is running for v3 shell

  Scenario: Default test harness uses synthetic oracle
    When I request the health endpoint
    Then the health JSON has oracleMode "synthetic"
