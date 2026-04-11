const jsonHeaders = { "Content-Type": "application/json" };
const cred = { credentials: "same-origin" };

/**
 * @param {{ fetch: typeof fetch }} ports
 */
export function createDashboardApi(ports) {
  const { fetch: f } = ports;
  return {
    ensureSession: () => f("/api/session", cred),
    postSubsystemSync: (body) =>
      f("/api/subsystem-sync", {
        ...cred,
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(body),
      }),
    getAdventureDatabase: () => f("/api/adventure-database", cred),
    postAutoplayPlan: (body) =>
      f("/api/autoplay-plan", {
        ...cred,
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(body),
      }),
    postAutoplayEngineInput: (body) =>
      f("/api/autoplay-engine-input", {
        ...cred,
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(body),
      }),
    getAutoplayMode: () => f("/api/autoplay-mode", cred),
    postAutoplayMode: (plannerEnabled) =>
      f("/api/autoplay-mode", {
        ...cred,
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ plannerEnabled }),
      }),
    getAutoplaySettings: () => f("/api/autoplay-settings", cred),
    postAutoplaySettings: (body) =>
      f("/api/autoplay-settings", {
        ...cred,
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(body),
      }),
    postManualCommand: (body) =>
      f("/api/manual-command", {
        ...cred,
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(body),
      }),
    getTextLlm: () => f("/api/text-llm", cred),
    postTextLlm: (body) =>
      f("/api/text-llm", {
        ...cred,
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(body),
      }),
    fetchUrl: (url) => f(url, cred),
    postMlxModelCancel: () =>
      f("/api/mlx-model/cancel", { ...cred, method: "POST" }),
  };
}
