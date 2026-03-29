# Roadmap

Informal plan beyond a hackathon MVP. Priorities can change with maintainer time
and feedback.

## Short term

- Tighten dashboard UX edge cases (SSE reconnect, error surfacing in the UI).
- Keep oracle tests and Vitest coverage aligned with autoplay and interpret
  changes.
- Documentation: keep Quick Start and [`DEMO.md`](DEMO.md) in sync with real
  commands and ports.

## Mid term

- Optional integrations: export session transcripts or map snapshots for
  teaching / replay.
- Broader provider testing matrix (more OpenAI-compatible servers, clearer
  failure modes in the UI).
- Packaging: clearer one-command setup where `gfortran` and Node are already
  installed.

## Long term

- Deeper “tutor” or curriculum modes (guided prompts, structured debriefs) built
  on the same Fortran oracle.
- Localization of dashboard chrome (game text remains English unless the
  underlying dat changes).
- Optional mobile-friendly or offline-first views of session state (read-only
  consumers of the same event stream).

Pull requests that advance any of these are welcome; see
[`CONTRIBUTING.md`](CONTRIBUTING.md).
