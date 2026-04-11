/** One or two GETIN lines: optional automatic retry when the parser rejects the first. */
export type ScriptedGetinLine =
  | string
  | {
      line: string;
      /** Sent once if output after `line` matches transcript rejection heuristics. */
      retryIfRejected?: string;
    };
