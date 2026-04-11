# Known behaviors and parity (Fortran oracle)

This list records behaviors of the **current** [`adventure.f`](../../adventure.f) + [`adventure.dat`](../../adventure.dat) build that the TypeScript engine aims to **replicate**. Items here may be historical artifacts, data quirks, or limitations; **fixing** them is out of scope for `adventure-nl` (see separate “extended / corrected edition” initiative).

| ID | Area | Observed behavior | Oracle / notes | Preserve in TS port |
|----|------|-------------------|----------------|---------------------|
| B1 | RNG | Dwarf movement, knife throws, random maze exits use `RAN()` (gfortran). | Transcripts may not match across compilers unless RNG is matched or tests avoid random branches. | Yes — injectable RNG; tests use fixed sequence where needed. |
| B2 | Data | Unimplemented CHEST/TREAS/BOX object never placed (per README). | No in-game creation path. | Yes — same object graph from `.dat`. |
| B3 | History | Prior maintainer fixes (e.g. destination 314, dwarf `DTRAV` index, blank line in descriptions) are **in** current Fortran. | README “Code changes” / “Database changes”. | Yes — replicate **this** codebase, not pre-fix Crowther-only behavior. |
| B4 | Input | `GETIN` uses first 5 + next 5 columns of a line; two-word detection via first space after column 2. | [`GETIN`](../../adventure.f) | Yes — `getin()` in TS. |

New rows should be added when oracle tests reveal a divergence; each row should cite a test name or transcript path.
