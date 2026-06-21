/** How the shell talks to the game oracle / run coordinator. */
export type GameBackendKind = "v2-http" | "nl-dashboard" | "mock";

/** How draft map and agent hints are produced. */
export type AssistBackendKind =
  | "langgraph"
  | "ag2"
  | "local-map-core"
  | "mock";

/** How NL autoplay / planner loops run (research mode). */
export type AgentBackendKind =
  | "nl-glue-browser"
  | "nl-glue-server"
  | "none";

export type WebclientBackendConfig = {
  readonly game: GameBackendKind;
  readonly assist: AssistBackendKind;
  readonly agent: AgentBackendKind;
  readonly gameBaseUrl: string;
  readonly assistBaseUrl: string;
  readonly nlDashboardBaseUrl: string;
};

export type GameBackend = {
  readonly kind: GameBackendKind;
  readonly baseUrl: string;
};

export type AssistBackend = {
  readonly kind: AssistBackendKind;
  readonly baseUrl: string;
};

export type AgentBackend = {
  readonly kind: AgentBackendKind;
};

export type WebclientBackends = {
  readonly game: GameBackend;
  readonly assist: AssistBackend;
  readonly agent: AgentBackend;
};
