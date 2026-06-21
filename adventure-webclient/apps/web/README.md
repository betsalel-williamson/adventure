# web — app README

## Overview

Vite shell under `apps/web/` — panel placeholders and unified feature flags for the adventure-webclient migration.

Default dev URL: `<http://127.0.0.1:5175>`.

Backend adapter types live in [`src/backends/`](src/backends) (env-driven).

Parent package: [`adventure-webclient/README.md`](../../../README.md).

## Backend adapters

Configured via Vite env — see the **Backend adapters** section in the [adventure-webclient README](../../../README.md).

Implementation: [`src/backends/`](src/backends).

## Feature flags

JSON defaults: [`webclient-feature-flags.json`](webclient-feature-flags.json)

Resolution and override order documented in [`docs/developer/webclient-feature-flags.md`](../../../docs/_build/developer.md#webclient-feature-flags).
