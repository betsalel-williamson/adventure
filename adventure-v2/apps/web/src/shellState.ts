/**
 * Pure helpers for dev shell transcript accumulation (testable without DOM).
 */

export const appendTranscriptLine = (previous: string, line: string): string =>
  previous ? `${previous}\n${line}` : line;
