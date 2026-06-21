import type {
  AgentBackendKind,
  AssistBackendKind,
  GameBackendKind,
  WebclientBackendConfig,
  WebclientBackends,
} from "./types.js";

const parseKind = <T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T => {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const normalized = raw.trim() as T;
  return allowed.includes(normalized) ? normalized : fallback;
};

const GAME_BACKENDS = ["v2-http", "nl-dashboard", "mock"] as const;
const ASSIST_BACKENDS = [
  "langgraph",
  "ag2",
  "local-map-core",
  "mock",
] as const;
const AGENT_BACKENDS = [
  "nl-glue-browser",
  "nl-glue-server",
  "none",
] as const;

/** Read backend targets from Vite env — keeps UI development independent of a specific server layout. */
export const readBackendConfigFromEnv = (
  env: Record<string, string | undefined> = import.meta.env,
): WebclientBackendConfig => ({
  game: parseKind(env.VITE_WEBCLIENT_GAME_BACKEND, GAME_BACKENDS, "v2-http"),
  assist: parseKind(
    env.VITE_WEBCLIENT_ASSIST_BACKEND,
    ASSIST_BACKENDS,
    "langgraph",
  ),
  agent: parseKind(env.VITE_WEBCLIENT_AGENT_BACKEND, AGENT_BACKENDS, "none"),
  gameBaseUrl: env.VITE_API_URL ?? "http://127.0.0.1:8787",
  assistBaseUrl: env.VITE_ASSIST_URL ?? "http://127.0.0.1:8790",
  nlDashboardBaseUrl:
    env.VITE_NL_DASHBOARD_URL ?? "https://127.0.0.1:8787",
});

export const resolveWebclientBackends = (
  config: WebclientBackendConfig = readBackendConfigFromEnv(),
): WebclientBackends => ({
  game: { kind: config.game, baseUrl: config.gameBaseUrl },
  assist: { kind: config.assist, baseUrl: config.assistBaseUrl },
  agent: { kind: config.agent },
});

export const formatBackendSummary = (
  backends: WebclientBackends = resolveWebclientBackends(),
): string =>
  [
    `game=${backends.game.kind} (${backends.game.baseUrl})`,
    `assist=${backends.assist.kind} (${backends.assist.baseUrl})`,
    `agent=${backends.agent.kind}`,
  ].join(" · ");

export type { GameBackendKind, AssistBackendKind, AgentBackendKind };
