/**
 * Fortran GETIN-compatible tokenizer (adventure.f lines 738–782).
 * First five characters = first word (trimmed at first blank), next five = second word.
 * TWOWDS=1 when there is a space after column 2 (first space index J>2) and remainder non-blank.
 */
export type GetinResult = {
  twowds: boolean;
  /** First word, up to 5 chars (Fortran CHARACTER*5). */
  a: string;
  /** Second word when two-word first line (ENTER + object). */
  wd2: string;
  /** Rest of line after first space when TWOWDS (Fortran C). */
  b: string;
};

export function getin(line: string): GetinResult {
  let upper = "";
  for (let j = 0; j < line.length; j++) {
    const ch = line[j]!;
    if (ch >= "a" && ch <= "z") {
      upper += String.fromCharCode(ch.charCodeAt(0) - 32);
    } else {
      upper += ch;
    }
  }
  let b = upper.slice(0, 5);
  let d = upper.slice(5, 10);
  const ib = b.indexOf(" ");
  if (ib !== -1) {
    b = b.slice(0, ib).padEnd(5, " ");
  }
  const id = d.indexOf(" ");
  if (id !== -1) {
    d = d.slice(0, id).padEnd(5, " ");
  }
  const firstSpace = upper.indexOf(" ");
  let c = "     ";
  let twowds = false;
  if (firstSpace > 2) {
    c = upper.slice(firstSpace + 1);
    if (c.trim() !== "") {
      twowds = true;
    }
  }
  return {
    twowds,
    a: b.slice(0, 5).padEnd(5, " "),
    wd2: d.slice(0, 5).padEnd(5, " "),
    b: c.slice(0, 5).padEnd(5, " "),
  };
}
