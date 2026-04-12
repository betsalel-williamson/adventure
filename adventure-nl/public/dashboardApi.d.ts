export function createDashboardApi(ports: { fetch: typeof fetch }): {
  ensureSession: () => ReturnType<typeof fetch>;
  postSubsystemSync: (
    body: Record<string, unknown>,
  ) => ReturnType<typeof fetch>;
  getAdventureDatabase: () => ReturnType<typeof fetch>;
  /** NL interpret: request/response only; client then POSTs /api/engine/input. */
  postNlInterpret: (body: { natural: string }) => ReturnType<typeof fetch>;
  postEngineInput: (body: Record<string, unknown>) => ReturnType<typeof fetch>;
  getAutoplayMode: () => ReturnType<typeof fetch>;
  postAutoplayMode: (plannerEnabled: boolean) => ReturnType<typeof fetch>;
  getAutoplaySettings: () => ReturnType<typeof fetch>;
  postAutoplaySettings: (
    body: Record<string, unknown>,
  ) => ReturnType<typeof fetch>;
  getTextLlm: () => ReturnType<typeof fetch>;
  postTextLlm: (body: {
    providerId: string;
    modelId: string;
  }) => ReturnType<typeof fetch>;
  fetchUrl: (url: string) => ReturnType<typeof fetch>;
  postMlxModelCancel: () => ReturnType<typeof fetch>;
};
