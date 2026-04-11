# Design: adventure-lm

## Objective

Deliver a TypeScript engine that loads unchanged [`adventure.dat`](../../adventure.dat), reproduces Fortran [`adventure.f`](../../adventure.f) behavior for parity, and adds NL input via Gemini structured output plus optional imagery—without changing core game rules (bug fixes deferred; see [`bugs.md`](./bugs.md)).

## Technical design

### `.dat` format (loader)

Sections are introduced by `IKIND` integers (see Fortran `1002`/`1003`). Each section ends with `JKIND = -1` (or `KTAB = -1` for vocabulary). Text lines use `FORMAT(I9,20A4)`: location or message key plus twenty 4-character chunks (legacy A4) assembled into display strings. Motion rows use `FORMAT(12I10)`: source location, destination group, up to ten motion keyword indices.

### Engine state

State mirrors Fortran: `LOC`, `L` (working location for describe), `IPLACE`, `IFIXED`, `IOBJ`, `ICHAIN`, `COND`, `PROP`, `ABB`, dwarf arrays, `IDWARF`, `IWEST`, `LTRUBL`, etc. Randomness uses an injectable RNG matching call order of `RAN()` in the port.

### Gemini contract

Structured JSON (Zod-validated), e.g.:

- `primaryToken: string` — five uppercase chars or shorter (padded by client).  
- `secondaryToken?: string`  
- `confidence?: number`  
- Reject unknown tokens against `ATAB` after normalization.

Prompt context includes **trimmed** verb list, motion words, and objects visible at `LOC`—not the raw full `.dat` dump.

### Images

Optional: key = `(LOC, hash of major PROP flags)`; prompt from long description text; disk cache under user cache dir; failures are silent fallback to text-only.

### Failure modes

- Gemini unavailable or invalid JSON → fall back to `getin` tokenizer path only, or show classic confusion messages (`SPEAK` 60/61/13 path).

## Key changes

### API contracts

- **CLI**: `adventure-lm run` reading stdin / writing stdout; natural language when `GEMINI_API_KEY` is set, else Fortran; optional `[--classic]` to force Fortran.  
- **Programmatic**: `createEngine(datPath)`, `engine.applyLine(line)`, transcript array.

### Data models

- `AdventureDatabase` — parsed `.dat`.  
- `GameState` — mutable runtime state.  
- `InterpretedCommand` — NL adapter output before `GETIN` normalization.

### Components

| Component | Role |
|-----------|------|
| `src/dat/loadDat.ts` | Parse `adventure.dat` |
| `src/engine/engine.ts` | Fortran-equivalent loop |
| `src/cli/getin.ts` | GETIN-compatible tokenizer |
| `src/nl/gemini.ts` | Optional Gemini client |
| `src/images/locations.ts` | Optional image hints + cache |

## Alternatives considered

- **Subprocess-only**: Run Fortran for all turns — simple but poor testability and no fine-grained NL context. Rejected for core engine; kept as **oracle** for E2E.  
- **Full rewrite with “fixes”**: Rejected; tracked as future product.

## Out of scope

- Editing `adventure.dat`.  
- Correcting historical gameplay bugs in the main track.  
- Multiplayer or cloud save.

## References

- [`docs/architecture/adventure-engine.md`](../../docs/architecture/adventure-engine.md)  
- Project standards: `.cursor/rules/standards-design.mdc` (template alignment)
