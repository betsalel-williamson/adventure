# User story: adventure-nl

## Persona

**Retro text-adventure player** — enjoys Colossal Cave–style exploration, terse room descriptions, and parser-based puzzles, but finds strict two-word commands and five-letter tokens awkward on modern keyboards. They want the same game and tone with more forgiving input and optional visuals that do not change the underlying simulation.

## Story

- **As a** retro text-adventure player  
- **I want to** play Colossal Cave with natural-language commands (and optional scene imagery) backed by the original `adventure.dat`  
- **so that** I can explore without memorizing exact verbs, while still experiencing the classic game behavior and atmosphere.

## Acceptance criteria (EARS)

- **WHEN** I start the enhanced client **THEN** I **SHALL** be able to play using the same world data as the Fortran build (`adventure.dat` unchanged).  
- **WHEN** I type a command in plain English **THEN** the system **SHALL** map it to valid game vocabulary (verb/object motion) without inventing new world rules.  
- **WHEN** the interpreter cannot map my input **THEN** I **SHALL** see responses that match the classic “I don’t understand” style of the original.  
- **IF** optional images are enabled **THEN** I **SHALL** still see the primary experience as text-first; images **SHALL** not replace or rewrite room text from the data file.  
- **WHILE** playing **THE USER SHALL** experience the same effective game behavior as the Fortran oracle for the same token stream (including documented quirks; bug fixes are a separate product).

## Success metrics (verifiable)

- Automated tests demonstrate parser and engine parity against documented oracle behavior.  
- NL path is covered by contract tests (mocked LLM) without requiring live API in CI.
