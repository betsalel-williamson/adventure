# adventure

**Classic Colossal Cave Adventure, restored for modern Fortran, plus optional
TypeScript tooling** (natural-language play, text-model backends, autoplay, and a
local web dashboard: transcript, inferred map, session diagram).

![Autoplay web dashboard: transcript, state panels, map, and Mermaid FSM](docs/adventure-nl-dashboard.png)

**Naming:** In this repo, **NL** means **natural language** (free-form player text mapped to parser tokens, plus prompts and planner glue). The TypeScript package directory is **`adventure-nl/`**; environment variables for that stack use the prefix **`ADVENTURE_NL_`** (see `adventure-nl/.env.example`). Backends are still **text / language models** (Gemini, MLX, OpenAI-compatible HTTP)—the **`-nl`** suffix marks the **natural-language product surface**, not the model family.

## The problem

The original game is a landmark of computing history, but running it in a
classroom or demo setting often means a plain terminal — hard for newcomers to
see structure, state, or how an AI agent reasons move-by-move.

## The solution

This repository ships a **buildable Fortran port** (same `adventure.dat`
mechanics) and, in [`adventure-nl/`](adventure-nl/) (**NL** = **natural language**;
see note above), an **optional layer** that uses the compiled game as an oracle:
scripted GETIN-compatible play, optional natural-language mapping, and a
**local autoplay dashboard** with SSE updates.

## Tech stack

- **Fortran 77** — game engine (`gfortran`, `make`)
- **TypeScript / Node 24+** — `adventure-nl` CLI, tests (Vitest), local HTTP
  dashboard (static ES modules)
- **Optional text models** — Google Gemini, local MLX weights, or OpenAI-compatible HTTP (hosted LLMs or smaller local models)
  (see [`adventure-nl/.env.example`](adventure-nl/.env.example))

## Quick start

**Classic game only** (no Node):

```sh
git clone https://github.com/betsalel-williamson/adventure.git
cd adventure
make
./adventure
```

**Autoplay web dashboard** (needs Node + a configured text-model backend):

```sh
make install-nl
make run-autoplay-web
```

Open [http://127.0.0.1:8787/](http://127.0.0.1:8787/) — see
[`DEMO.md`](DEMO.md) for a judge-oriented walkthrough.

**adventure-v2** (orchestration shell + SSE dev UI — separate from NL dashboard):

```sh
make adventure-v2-dev
```

See [`adventure-v2/README.md`](adventure-v2/README.md).

## Docs & community

| Doc | Purpose |
| --- | ------- |
| [`docs/index.md`](docs/index.md) | **Start here** — play paths, doc tiers, contribute |
| [`DEMO.md`](DEMO.md) | Step-by-step demo script |
| [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md) | Dashboard HTTP + SSE |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How to contribute, PR checks |
| [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) | Contributor Covenant |
| [`ROADMAP.md`](ROADMAP.md) | Near- and long-term direction |
| [`LICENSE`](LICENSE) | MIT |

## Team

*(Hackathon or course submission: add names and roles here.)*

---

The original Fortran version of Adventure by Will Crowther, restored to
functionality when compiled with a modern Fortran compiler.  For a history of
this program, see the
[Wikipedia article](https://en.wikipedia.org/wiki/Colossal_Cave_Adventure)
on it.

## Build and run (macOS and other Unix-like systems)

You need [GNU Fortran](https://gcc.gnu.org/fortran/) (`gfortran`). On macOS with [Homebrew](https://brew.sh/):

```sh
brew install gcc
```

That installs `gfortran` (often as `gfortran` in your `PATH`). From the repository root:

```sh
make
./adventure
```

Or `make run`, which builds if needed and starts the game. Run the program from this directory so it can open `adventure.dat` (same folder as the executable).

Optional: `-loc` prints your maze location while playing (helps with mapping), for example `./adventure -loc`.

`make clean` removes the built `adventure` binary.

Downloaded from Wayback Machine archive of

```
http://www.icynic.com/~don/jerz/advf4.77-03-31
```
and
```
http://www.icynic.com/~don/jerz/advdat.77-03-31
```

# Code changes:

- Eliminated tabs from Fortran code; aligned statements to follow legacy
  fixed format layout.

- Moved DATA statements out of executable code section into declaration section.

- Apparently, the DEC system this program was developed on initialized all
  program storage to zero when loaded; contemporary systems do not, generally,
  do this.  Consequently, explicitly zeroed variables and arrays that assume a
  zero initial value: SETUP, KEY, DSEEN, DLOC, ODLOC.  Also set uninitialized
  values of DTRAV array to zero.

- Changed all TYPE commands to PRINT and ACCEPT commands to READ.

- Changed A5 formats to A4 to reflect 32 bit char capacity of an integer word.
  Defined an integer constant BLNK for checking if at end of text by
  equivalencing it to a CHARACTER*4 string of that value.

- Changed G formats to I<i>n</i>, added OPEN statement to read data file, and
  forced BLANK='NULL' so that left-justified integer fields could be read.

- Removed most of the functionality of the GETIN subroutine associated with
  packing of 5 7-bit ASCII chars into a 36 bit word (DEC PDP-10 architecture),
  changing relevant variables to CHARACTER*5 for string comparisons.  This also
  makes the SHIFT subroutine superfluous, though the functionality was
  maintained by using more modern ANSI built-in functions IAND, IOR, ISHIFT.

- Changed the program to not PAUSE when the game is over.  The code assumes that
  resumption after PAUSE will restart the game (reset it to its initial
  conditions), but whether one can resume after a pause is system dependent.
  Instead, changed the code to ask whether you want to play again, and, if not,
  stop.

- Fixed a bug in the code which did not recognize the special destination code
  314, which was used in the database.  It appears that the computed GOTO to
  reach code labeled 39 left out that jump condition; the fix restores it.  The
  code at 39 appears to choose destinations compatible with the location that
  uses destination code 314.

- Fixed a bug in the code that controls dwarf attacks.  A mis-coded check led
  to access of element 0 of the DTRAV array.

- Added command line option -loc which prints out location in maze (to help
  mapping/route finding for the frustrated).

# Database changes:

- Eliminated a blank line among the location descriptions, which triggered
  a bug in the main line code (zero array index).

- Replaced tabs with blanks to reformat numeric fields to fixed-length.

- Deleted motion codes 305 in two places, which was a mistake; there is no
  motion word with that key, nor do motion codes have any special encoding
  schemes like destination codes have.  Seems to have been a problem setting up
  the motion database originally by Will Crowther.

- Fixed typos in some messages.

- Changed action word EXCIV to EXCAV (Crowther probably meant "excavate" because
  it is a synonym of "dig").

- The CHEST/TREAS/BOX object, probably meant to be a treasure
  chest, is not put anywhere in the maze, nor does any denizen or action cause
  it to be dropped or created.  This probably represents a new feature that
  Crowther didn't fully implement.  (No changes made.)

# Assumptions:

- Database must be in the same directory as executable and named adventure.dat.

- Built-in function RAN(I) returns a pseudo-random REAL variable 0 <= X <= 1.
  (This is a built-in library function in GNU Fortran.)

- Addition of -loc command line option uses GNU Fortran built-in function
  IARGC() and procedure GETARG(N,VAR) to respectively get number of command
  line arguments, and command argument N's text as character string VAR.
