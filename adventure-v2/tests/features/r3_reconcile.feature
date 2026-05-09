Feature: Drift-aware reconcile loop
  Scenario: Parser drift is detected and surfaced
    Given a started run
    When the oracle rejects a proposed action
    Then reconcile evidence includes parser drift metadata
