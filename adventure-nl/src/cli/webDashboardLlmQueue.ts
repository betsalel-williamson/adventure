import { runWithWebDashboardLlmLogContext } from "../nl/llmDebug.js";
import type { AdventureDatabase } from "../dat/types.js";
import type {
  AutoplayPlannerResponse,
  InterpretedCommand,
  InterpretPlayerInputOptions,
  PlannerUserPromptInput,
  TextLlm,
  TextLlmProviderId,
} from "@adventure-nl/nl-glue";

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
export type QueuedTextLlmSelection = {
  readonly providerId: () => TextLlmProviderId;
  readonly modelId: () => string;
};

export function createQueuedTextLlm(
  getInner: () => TextLlm | Promise<TextLlm>,
  sessionId: string,
  executor: LlmSequentialExecutor,
  selection: QueuedTextLlmSelection,
): TextLlm {
  const run = <T>(fn: () => Promise<T>) => executor.run(sessionId, fn);
  const resolveInner = () => Promise.resolve(getInner());
  return {
    get providerId() {
      return selection.providerId();
    },
    get modelId() {
      return selection.modelId();
    },
    interpretPlayerInput(
      userText: string,
      db: AdventureDatabase,
      options: InterpretPlayerInputOptions,
    ): Promise<InterpretedCommand> {
      return run(async () => {
        const inner = await resolveInner();
        return inner.interpretPlayerInput(userText, db, options);
      });
    },
    planAutoplay(
      db: AdventureDatabase,
      options: {
        plannerUserPrompt: PlannerUserPromptInput;
        recentGameTextForRepair?: string;
        includeDatHelpInSystem?: boolean;
      },
    ): Promise<AutoplayPlannerResponse> {
      return run(async () => {
        const inner = await resolveInner();
        return inner.planAutoplay(db, options);
      });
    },
    generateUnstructured(prompt: string): Promise<string> {
      return run(async () => {
        const inner = await resolveInner();
        return inner.generateUnstructured(prompt);
      });
    },
  };
}
