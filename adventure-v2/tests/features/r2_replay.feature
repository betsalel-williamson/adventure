Feature: Deterministic replay
  Scenario: Replay from a saved checkpoint
    Given a started run
    And at least one completed turn
    When replay is requested for the checkpoint
    Then replay-ready includes checkpoint and control phase
