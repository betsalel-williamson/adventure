export function createDashboardApi(ports: { fetch: typeof fetch }): {
  getAutoplayMode: () => ReturnType<typeof fetch>;
  postAutoplayMode: (plannerEnabled: boolean) => ReturnType<typeof fetch>;
  getAutoplaySettings: () => ReturnType<typeof fetch>;
  postAutoplaySettings: (
    body: Record<string, unknown>,
  ) => ReturnType<typeof fetch>;
  postManualCommand: (
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
