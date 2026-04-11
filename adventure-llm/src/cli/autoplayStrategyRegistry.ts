import type { AutoplayPromptMode } from "@adventure-llm/nl-glue";

export type AutoplayStrategyHooks = {
  readonly id: string;
  /** When set, overrides {@link resolveAutoplayPromptMode} for the autoplay planner loop. */
  readonly promptMode?: AutoplayPromptMode;
  /** Merged into project env allowlist on activate (sanitized elsewhere). */
  readonly defaultEnvAllowlist?: Readonly<Record<string, string>>;
};

const registry: Readonly<Record<string, AutoplayStrategyHooks>> = {
  default: { id: "default" },
  explore: {
    id: "explore",
    promptMode: "explore",
    defaultEnvAllowlist: { ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE: "explore" },
  },
  full: {
    id: "full",
    promptMode: "full",
    defaultEnvAllowlist: { ADVENTURE_LLM_AUTOPLAY_PROMPT_MODE: "full" },
  },
};

export function resolveAutoplayStrategyHooks(
  strategyId: string | null | undefined,
): AutoplayStrategyHooks {
  if (strategyId === undefined || strategyId === null || strategyId === "") {
    return registry.default;
  }
  const k = strategyId.trim();
  return registry[k] ?? registry.default;
}

export function listAutoplayStrategyIds(): readonly string[] {
  return Object.keys(registry);
}
