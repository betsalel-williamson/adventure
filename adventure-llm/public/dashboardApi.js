const jsonHeaders = { "Content-Type": "application/json" };

/**
 * @param {{ fetch: typeof fetch }} ports
 */
export function createDashboardApi(ports) {
  const { fetch: f } = ports;
  return {
    getAutoplayMode: () => f("/api/autoplay-mode"),
    postAutoplayMode: (plannerEnabled) =>
      f("/api/autoplay-mode", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ plannerEnabled }),
      }),
    getAutoplaySettings: () => f("/api/autoplay-settings"),
    postAutoplaySettings: (body) =>
      f("/api/autoplay-settings", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(body),
      }),
    postManualCommand: (body) =>
      f("/api/manual-command", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(body),
      }),
    getTextLlm: () => f("/api/text-llm"),
    postTextLlm: (body) =>
      f("/api/text-llm", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(body),
      }),
    fetchUrl: (url) => f(url),
    postMlxModelCancel: () => f("/api/mlx-model/cancel", { method: "POST" }),
  };
}
