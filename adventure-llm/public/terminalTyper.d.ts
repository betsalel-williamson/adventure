export declare const TERMINAL_TYPING_CHAR_DELAY_MS: number;
export declare const TERMINAL_TYPING_PRE_ENTER_MS: number;

export declare function preloadTerminalSounds(): void;
export declare function playTypeSound(): void;

export declare function typeTextIntoPre(
  scrollRoot: HTMLElement | null,
  pre: HTMLPreElement,
  text: string,
  opts?: { charDelayMs?: number; finalPauseMs?: number },
): Promise<void>;

export declare function typeTextIntoInput(
  input: HTMLInputElement | null,
  text: string,
  opts?: {
    charDelayMs?: number;
    finalPauseMs?: number;
    uppercase?: boolean;
  },
): Promise<void>;
