# Optional: run with `npm run test:cucumber:fortran` when repo-root ./adventure exists
@fortran
Feature: Fortran subprocess oracle (when enabled)
  As an operator
  I want the Fortran binary path to produce substantive room text
  So demos match classic Colossal Cave expectations

  Background:
    Given the adventure HTTP API is running for v3 shell

  Scenario: Process oracle yields more than terse synthetic text when wired
    When I start a run for SLM and stream ten events for input "look"
    Then the stream includes oracle_observation with non-empty output
    And if the oracle is process mode the observation is longer than stub-only text
