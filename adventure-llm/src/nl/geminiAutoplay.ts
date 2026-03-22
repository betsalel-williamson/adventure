import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import {
  AutoplayPlannerResponseSchema,
  type AutoplayPlannerResponse,
} from "./schema.js";
import type { AdventureDatabase } from "../dat/types.js";
import {
  getHelpInstructionText,
  HELP_RTEXT_MESSAGE_ID,
} from "../text/speak.js";
import { resolvedGeminiTextModel } from "./geminiModels.js";
import { appendInteractionLog } from "./llmDebug.js";
import { repairInterpretedCommand } from "./repairInterpreted.js";

export type GeminiAutoplayPlannerOptions = {
  apiKey: string;
  /** Defaults to `resolvedGeminiTextModel()`. */
  model?: string;
  /** Assembled user prompt (memory + vocabulary + transcript). */
  plannerUserPrompt: string;
  /** For {@link repairInterpretedCommand}. */
  recentGameTextForRepair?: string;
};

/**
 * Single Gemini call for self-acting mode: next parser tokens plus optional stop.
 */
export async function chooseNextMoveWithGemini(
  db: AdventureDatabase,
  options: GeminiAutoplayPlannerOptions,
): Promise<AutoplayPlannerResponse> {
  const modelId = options.model ?? resolvedGeminiTextModel();

  process.stderr.write("adventure-llm: autoplay — planning next move…\n");

  const gen = new GoogleGenerativeAI(options.apiKey);
  const model = gen.getGenerativeModel({
    model: modelId,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          primaryToken: {
            type: SchemaType.STRING,
            description: "Up to 5 chars, uppercase",
          },
          secondaryToken: { type: SchemaType.STRING },
          confidence: { type: SchemaType.NUMBER },
          continuePlaying: {
            type: SchemaType.BOOLEAN,
            description:
              "False to end the session (no further commands). Default true.",
          },
        },
        required: ["primaryToken"],
      },
    },
  });

  const helpFromDat = getHelpInstructionText(db);
  const helpBlock =
    helpFromDat.length > 0
      ? `Official in-game HELP (adventure.dat RTEXT ${HELP_RTEXT_MESSAGE_ID}):\n${helpFromDat}\n\n`
      : "";

  const prompt = `${helpBlock}${options.plannerUserPrompt}`;

  await appendInteractionLog({
    event: "gemini_autoplay_request",
    model: modelId,
    promptLength: prompt.length,
    prompt,
  });

  const startedMs = Date.now();
  const res = await model.generateContent(prompt);
  const durationMs = Date.now() - startedMs;
  const text = res.response.text();
  const parsedUnknown = JSON.parse(text) as unknown;
  const raw = AutoplayPlannerResponseSchema.parse(parsedUnknown);
  const continuePlaying = raw.continuePlaying ?? true;
  const repaired = repairInterpretedCommand(
    "autoplay",
    {
      primaryToken: raw.primaryToken,
      secondaryToken: raw.secondaryToken,
      confidence: raw.confidence,
    },
    options.recentGameTextForRepair,
  );

  const out: AutoplayPlannerResponse = {
    ...repaired,
    continuePlaying,
  };

  await appendInteractionLog({
    event: "gemini_autoplay_response",
    model: modelId,
    durationMs,
    rawJson: text,
    parsed: raw,
    repaired: out,
  });

  return out;
}
