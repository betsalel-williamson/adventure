import { runWithWebDashboardLlmLogContext } from "../nl/llmDebug.js";
import type { AdventureDatabase } from "../dat/types.js";
import type {
  InterpretPlayerInputOptions,
  PlannerUserPromptInput,
  TextLlm,
} from "../nl/textLlmContract.js";
import type {
  AutoplayPlannerResponse,
  InterpretedCommand,
} from "../nl/schema.js";

export type LlmSequentialExecutor = {
  run<T>(sessionId: string, fn: () => Promise<T>): Promise<T>;
  flush(): Promise<void>;
};

/**
 * Single FIFO executor for all shared TextLlm calls (MLX stdio / cloud APIs are not concurrent-safe).
 */
export function createLlmSequentialExecutor(): LlmSequentialExecutor {
  let chain: Promise<unknown> = Promise.resolve();
  return {
    run<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
      let result!: T;
      const next = chain.then(async () => {
        result = await runWithWebDashboardLlmLogContext(sessionId, fn);
      });
      chain = next.then(
        () => undefined,
        () => undefined,
      );
      return next.then(() => result);
    },
    flush(): Promise<void> {
      return chain.then(() => undefined);
    },
  };
}

/**
 * Wraps a live TextLlm so interpret/plan/generate run through the global queue with log context.
 */
export function createQueuedTextLlm(
  getInner: () => TextLlm,
  sessionId: string,
  executor: LlmSequentialExecutor,
): TextLlm {
  const run = <T>(fn: () => Promise<T>) => executor.run(sessionId, fn);
  return {
    get providerId() {
      return getInner().providerId;
    },
    get modelId() {
      return getInner().modelId;
    },
    interpretPlayerInput(
      userText: string,
      db: AdventureDatabase,
      options: InterpretPlayerInputOptions,
    ): Promise<InterpretedCommand> {
      return run(() => getInner().interpretPlayerInput(userText, db, options));
    },
    planAutoplay(
      db: AdventureDatabase,
      options: {
        plannerUserPrompt: PlannerUserPromptInput;
        recentGameTextForRepair?: string;
        includeDatHelpInSystem?: boolean;
      },
    ): Promise<AutoplayPlannerResponse> {
      return run(() => getInner().planAutoplay(db, options));
    },
    generateUnstructured(prompt: string): Promise<string> {
      return run(() => getInner().generateUnstructured(prompt));
    },
  };
}
