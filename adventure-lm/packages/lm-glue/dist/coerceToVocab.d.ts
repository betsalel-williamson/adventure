import type { AdventureDatabase } from "./dat/types.js";
import type { AutoplayPlannerResponse, InterpretedCommand } from "./schema.js";
/**
 * Map a raw string to a single ATAB vocabulary token (or synthetic QUIT), using prefix
 * shortening so e.g. `BUILDING` → `BUILD` when `BUILD` is in the dictionary.
 */
export declare function coercePrimaryTokenToVocab(db: AdventureDatabase, raw: string): string;
/**
 * Map optional second word to a vocabulary token, or `undefined` if it cannot be matched.
 */
export declare function coerceSecondaryTokenToVocab(db: AdventureDatabase, raw: string | undefined): string | undefined;
/**
 * Receive-side coercion: every token is either a known game word (after prefix / pad
 * matching) or replaced (primary → {@link PRIMARY_FALLBACK}, secondary dropped).
 */
export declare function coerceInterpretedCommandToVocab(db: AdventureDatabase, cmd: InterpretedCommand): InterpretedCommand;
/** Same as {@link coerceInterpretedCommandToVocab} for autoplay; preserves `continuePlaying`. */
export declare function coerceAutoplayPlannerToVocab(db: AdventureDatabase, r: AutoplayPlannerResponse): AutoplayPlannerResponse;
//# sourceMappingURL=coerceToVocab.d.ts.map