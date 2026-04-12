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
    /**
     * NL interpret: thin JSON request/response only. Client derives GETIN and POSTs /api/engine/input.
     */
    postNlInterpret: (body) =>
      f("/api/nl/interpret", {
        ...cred,
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(body),
      }),
    /** Submit GETIN / scripted line to the engine (Fortran); game text arrives on /events. */
    postEngineInput: (body) =>
      f("/api/engine/input", {
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
