# R5 — invalid-action recovery over the same HTTP + SSE API as Vitest http.acceptance.test.ts
Feature: Invalid-action recovery is visible on the HTTP event stream
  As an operator validating benchmark harness behavior
  I want repeated rejected proposals to surface control escalation on the wire
  So that I can correlate recovery policy with streamed phases

  Background:
    Given the adventure HTTP API is running with the default oracle

  Scenario: Repeated rejected proposals escalate through test toward chaos
    When I start a run configured for model category "SLM"
    And I open the run event stream for three rejected proposals
    And I submit three sequential rejected proposals
    Then phase transitions on the stream include test and chaos
