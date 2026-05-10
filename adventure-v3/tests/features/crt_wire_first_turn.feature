# US-1-2 — Authentic game text or honest stub on the wire
Feature: First turn yields oracle observation text
  As a player
  I want a submitted command to produce oracle output on the stream
  So the CRT has something real to render

  Background:
    Given the adventure HTTP API is running for v3 shell

  Scenario: One look produces non-empty oracle output
    When I start a run for SLM and stream ten events for input "look"
    Then the stream includes oracle_observation with non-empty output
