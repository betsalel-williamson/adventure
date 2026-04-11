export type TranscriptBlock = { step: number; parts: string[] };

export function blockBodyChronological(b: TranscriptBlock): string;

export function collapseTerminalGameTrailingNewlines(text: string): string;

export function sortTranscriptBlocksChronological(
  blocks: readonly TranscriptBlock[],
): TranscriptBlock[];

export type TerminalEchoMergeEntry = {
  afterStep: number;
  line: string;
  moveNumber?: number | null;
};

export function effectiveTerminalEchoAfterStep(
  e: TerminalEchoMergeEntry,
  sorted: readonly TranscriptBlock[],
  getinByStep: Readonly<Record<number, string>>,
): number;
