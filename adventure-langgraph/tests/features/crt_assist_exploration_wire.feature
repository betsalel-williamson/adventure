# High-level wire for exploration map backend (same contract the v3 shell uses via POST /assist/ingest).
@assist
Feature: Assist server wire for exploration map
  As an operator
  I want the assist HTTP surface to merge transcript into a draft graph
  So the beside-CRT exploration map can stay honest and testable without a browser harness

  Background:
    Given the adventure HTTP API is running for v3 shell

  Scenario: Assist health is reachable and reports probe gate
    When I request the assist health endpoint
    Then the assist health JSON has status "ok"
    And the assist health JSON has probeEnabled false

  Scenario: Assist ingest returns draft mermaid for oracle text
    When I POST assist ingest with transcript "YOU ARE IN A HALLWAY." for run "cuke-explore-wire-1"
    Then the assist ingest response status is ok
    And the assist ingest mermaid source contains "flowchart LR"
