import type { InterpretedCommand } from "./schema.js";

const MOTION_ONLY_PRIMARY = new Set([
  "UP",
  "DOWN",
  "N",
  "S",
  "E",
  "W",
  "NE",
  "NW",
  "SE",
  "SW",
  "NORTH",
  "SOUTH",
  "EAST",
  "WEST",
  "IN",
  "OUT",
  "ENTER",
  "EXIT",
]);

function stripBadSecondary(s: string | undefined): string | undefined {
  if (s === undefined) return undefined;
  const t = s.trim().toUpperCase();
  if (t === "" || t === "NULL" || t === "NONE" || t === "N/A") return undefined;
  return t.slice(0, 5);
}

/**
 * Heuristic fixes for common Gemini mistakes (phrasal "pick up" → motion UP, object-only TAKE lines).
 * Uses recent game text to resolve "them"/"it" when the cave asked about a specific object.
 */
export function repairInterpretedCommand(
  userText: string,
  cmd: InterpretedCommand,
  recentGameText?: string,
): InterpretedCommand {
  const game = (recentGameText ?? "").toUpperCase();
  const primary = cmd.primaryToken.toUpperCase().slice(0, 5).trim();
  const secondary = stripBadSecondary(cmd.secondaryToken);

  const u = userText.toLowerCase();

  // "take/get/grab the X" mapped to primary X only — verb belongs in column 1.
  if (!secondary && /\b(take|get|grab|snatch)\b/.test(u)) {
    const om = u.match(
      /\b(keys|lamp|bottle|bird|cage|rod|rug|food|water|egg|coin|diamond|emerald)\b/,
    );
    if (om) {
      const obj = om[1]!.toUpperCase().slice(0, 5);
      if (primary === obj || primary === obj.slice(0, primary.length)) {
        return {
          primaryToken: "TAKE",
          secondaryToken: obj,
          confidence: cmd.confidence,
        };
      }
    }
  }

  const pickUpPhrasal =
    /\bpick\b/.test(u) &&
    /\bup\b/.test(u) &&
    !/\bgo\b\s+up\b/.test(u) &&
    !/^\s*up\b/i.test(userText.trim());

  if (pickUpPhrasal && (primary === "UP" || MOTION_ONLY_PRIMARY.has(primary))) {
    const obj = inferObjectFromGameText(game) ?? inferObjectFromUserText(u);
    if (obj) {
      return {
        primaryToken: "TAKE",
        secondaryToken: obj,
        confidence: cmd.confidence,
      };
    }
  }

  // "keep them" / "keep it" after a disambiguation prompt — take the object.
  if (/\bkeep\b/.test(u) && /\b(them|it)\b/.test(u)) {
    const obj = inferObjectFromGameText(game);
    if (obj) {
      return {
        primaryToken: "TAKE",
        secondaryToken: obj,
        confidence: cmd.confidence,
      };
    }
  }

  return {
    primaryToken: primary,
    secondaryToken: secondary,
    confidence: cmd.confidence,
  };
}

function inferObjectFromGameText(gameUpper: string): string | undefined {
  const withThe = gameUpper.match(/WITH THE (KEYS|LAMP|BOTTLE|BIRD|CAGE|ROD)/);
  if (withThe) return withThe[1]!;

  const m = gameUpper.match(
    /\b(KEYS|LAMP|BOTTLE|BIRD|CAGE|ROD|RUG|CHAIN|FOOD|WATER|COIN)\b/,
  );
  return m?.[1];
}

function inferObjectFromUserText(u: string): string | undefined {
  const m = u.match(/\b(keys|lamp|bottle|bird|cage|rod)\b/);
  return m ? m[1]!.toUpperCase().slice(0, 5) : undefined;
}
