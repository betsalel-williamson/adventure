import type { createDashboardApi } from "./dashboardApi.js";

export function resolveStatelyInspectOption(
  ports: { location: Pick<Location, "protocol" | "host"> },
  mod: {
    createWebSocketInspector?: (opts: { url: string }) => { inspect: unknown };
  },
): unknown | undefined;

export function wireBrowserAutoplayOrchestrator(
  ports: {
    fetch: typeof fetch;
    location: Location;
    localStorage: Storage;
  },
  api: ReturnType<typeof createDashboardApi>,
  es: EventSource,
): void;
