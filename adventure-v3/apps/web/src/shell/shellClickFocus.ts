/**
 * Whether a document click should NOT move focus to the CRT `#command-input`.
 * Matches main shell semantics: terminal chrome focuses the command line unless the user
 * clicked another meaningful control.
 */
export function shellClickShouldSkipFocus(target: Element): boolean {
  if (target.closest("#command-input")) {
    return true;
  }
  if (
    target.closest(
      'a[href], button:not([disabled]), summary, textarea, select, input:not(#command-input), [role="button"], [contenteditable="true"]'
    )
  ) {
    return true;
  }
  return false;
}
