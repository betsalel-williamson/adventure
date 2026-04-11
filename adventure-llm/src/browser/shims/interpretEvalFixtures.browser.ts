/** Browser bundle shim: no eval fixtures on disk. */
export function loadInterpretEvalFixtures(): unknown[] {
  return [];
}

export function buildInterpretEvalExamplesSection(
  fixtures: unknown,
  opts: unknown,
): string {
  void fixtures;
  void opts;
  return "";
}
