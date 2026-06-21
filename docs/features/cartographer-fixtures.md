# Cartographer fixtures

The `@adventure-v3/cartographer-fixtures` package provides schema-valid JSON fixtures for benchmarking assist ingest and navigator output.

## Purpose

Researchers and CI can replay transcript snippets with **acceptableResponses** criteria instead of hand-checking Mermaid graphs each run.

Example fixture: `fixtures/hallway-first-look.json` — first-look hallway transcript with expected graph properties.

## Usage

Fixtures validate cartographer ingest behavior in unit tests (`cartographerFixtureIngest.test.ts`, `cartographerIngestCore.test.ts`) and support eval workflows documented in the client guide.

Fixtures describe **draft assistance** expectations — not oracle ground truth.

## Package layout

- `src/schema.ts` — fixture schema (Zod)
- `src/projection.ts` — helpers to project fixture data into ingest payloads
- `fixtures/*.json` — versioned eval cases
