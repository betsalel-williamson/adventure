Feature: Invalid-action recovery
  Scenario: Repeated invalid actions escalate policy to chaos
    Given a started run
    When invalid actions exceed the threshold
    Then control telemetry includes escalation to chaos
