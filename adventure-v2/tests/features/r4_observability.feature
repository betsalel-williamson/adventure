Feature: Console-first observability stream
  Scenario: Nominal turn emits transcript and phase transition events
    Given a started run
    When one nominal turn is processed
    Then ordered events include checkpoint and control phase transitions
