# HTTP acceptance via the same wire API as tests/http.acceptance.test.ts
Feature: HTTP event stream shows one complete turn in order
  As an operator validating the benchmark harness
  I want one player turn to surface ordered artifacts on the stream
  So that I can trust reconcile and checkpoint ordering over the wire

  Background:
    Given the adventure HTTP API is running with the default oracle

  Scenario: One turn yields ordered turn envelopes and phase transitions
    When I start a run configured for model category "SLM"
    And I open the run event stream before submitting input
    And I submit player input "look" for that run
    Then I receive seven wire events with ordered turn kinds proposal, oracle_observation, reconcile, checkpoint
    And phase transitions end as disorder then act
    And the cognition trace includes a proposal step for input "look"

  Scenario: Reconcile visibility on the stream matches acceptance expectations
    When I start a run configured for model category "SLM"
    And I open the run event stream before submitting input
    And I submit player input "look" for that run
    Then the reconcile envelope correlates to the first turn of this run
    And the reconcile envelope reports oracle outcome "accepted"
    And the reconcile envelope has no drift summary
