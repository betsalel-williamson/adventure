Feature: Model swap benchmark execution
  Scenario Outline: Start a run with a model category
    Given a run config for "<category>"
    When the coordinator starts a run
    Then the run metadata includes "<category>"

    Examples:
      | category |
      | SLM      |
      | LLM      |
      | API      |
      | MLX      |
